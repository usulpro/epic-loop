import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";

import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const started = new Set();

function env(home) {
  const value = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: home };
  delete value.EPIC_LOOP_CLI;
  delete value.EPIC_LOOP_SKILL_DIR;
  return value;
}

function makeProject() {
  const root = fs.realpathSync(makeTempRoot("serve"));
  const review = path.join(root, ".epic-loop", "epics", "demo", "reviews", "r1");
  fs.mkdirSync(path.join(review, "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", "epics", "demo", "state-of-epic.md"), "# State Of Epic\n\nEpic: Demo Epic\n");
  fs.writeFileSync(
    path.join(review, "page.html"),
    '<!doctype html><html><head><title>Pick a doorbell</title></head><body><h1>Pick</h1><img src="assets/shot.txt" alt="shot"><script>throw new Error("page script is broken")</script></body></html>\n',
  );
  fs.writeFileSync(path.join(review, "assets", "shot.txt"), "asset-bytes\n");
  return { root, review, home: makeTempRoot("serve-home") };
}

function serve(project, ...args) {
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", project.root, "--json", ...args], { encoding: "utf8", env: env(project.home) });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const info = JSON.parse(result.stdout);
  if (info.pid) started.add(info.pid);
  return info;
}

function request(port, pathname, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: pathname, method, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", reject);
    if (body !== undefined) req.end(typeof body === "string" ? body : JSON.stringify(body));
    else req.end();
  });
}

const json = (body) => ({ body, headers: { "content-type": "application/json" } });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let project;
let port;

before(() => {
  project = makeProject();
  port = serve(project, "--detach").port;
});

after(() => {
  for (const pid of started) {
    if (alive(pid)) process.kill(pid, "SIGKILL");
  }
});

test("serve --detach writes server.json, a second serve reuses it, and --status reports it", () => {
  const info = JSON.parse(fs.readFileSync(path.join(project.root, ".epic-loop", ".runtime", "server.json"), "utf8"));
  assert.equal(info.port, port);
  assert.equal(info.root, project.root);
  assert.ok(alive(info.pid));
  assert.equal(info.url, `http://127.0.0.1:${port}/`);
  const again = serve(project, "--detach");
  assert.equal(again.reused, true);
  assert.equal(again.pid, info.pid);
  assert.equal(again.port, port);
  assert.equal(serve(project, "--status").running, true);
});

test("epic list, epic home and the review page render with the pending count and the injected problem control", async () => {
  const list = await request(port, "/");
  assert.equal(list.status, 200);
  assert.match(list.text, /Demo Epic/u);
  assert.match(list.text, /title="1 pending">1</u);
  const home = await request(port, "/demo");
  assert.match(home.text, /el-notice/u);
  assert.match(home.text, /Pick a doorbell/u);
  assert.match(home.text, /href="\/demo\/reviews\/r1\/"/u);
  const redirect = await request(port, "/demo/reviews/r1");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.location, "/demo/reviews/r1/");
  const page = await request(port, "/demo/reviews/r1/");
  assert.equal(page.status, 200);
  assert.match(page.text, /\/_runtime\/tokens\.css/u);
  assert.match(page.text, /\/_runtime\/base\.css/u);
  assert.match(page.text, /<form method="post" action="\/api\/demo\/reviews\/r1\/problem"/u);
  assert.match(page.text, /<script type="module" src="\/_runtime\/runtime\.js"><\/script>/u);
  assert.match(page.text, /<meta name="epic-loop-review" content="demo\/r1" \/>/u);
  assert.match(page.text, /page script is broken/u, "the page's own script is served unchanged");
  assert.ok(page.text.indexOf("Something is wrong with this page") > page.text.indexOf("page script is broken"), "the control comes after the page body");
  const css = await request(port, "/_runtime/tokens.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /text\/css/u);
  const vendorInstalled = fs.existsSync(path.join(repoRoot, "packages", "cli", "node_modules", "mermaid", "dist", "mermaid.min.js"));
  if (vendorInstalled) {
    const mermaid = await request(port, "/_runtime/vendor/mermaid.min.js");
    assert.equal(mermaid.status, 200);
    assert.match(mermaid.headers["content-type"], /text\/javascript/u);
    assert.match(mermaid.text, /globalThis\["mermaid"\]/u);
  }
  for (const attempt of ["/_runtime/vendor/../tokens.css", "/_runtime/vendor/%2e%2e%2fpaths.mjs", "/_runtime/vendor/package.json", "/_runtime/vendor/mermaid.js"]) {
    assert.equal((await request(port, attempt)).status, attempt.includes("../tokens.css") ? 200 : 404, attempt);
  }
  const missing = await request(port, "/nope/at/all");
  assert.equal(missing.status, 404);
  assert.match(missing.text, /Not found/u);
});

test("the epic home shows open gates from the loop state and survives a missing or broken state", async () => {
  const runtimeDir = path.join(project.root, ".epic-loop", "epics", "demo", ".runtime");
  const statePath = path.join(runtimeDir, "runtime-state.json");
  fs.mkdirSync(runtimeDir, { recursive: true });
  try {
    const gates = [
      { review: "r1", blocking: true, covers: ["H1"], status: "open" },
      { review: "r-gone", blocking: false, covers: [], status: "closed" },
    ];
    fs.writeFileSync(statePath, JSON.stringify({ implementation_loop: { status: "awaiting-review", gates } }));
    const blocking = await request(port, "/demo");
    assert.equal(blocking.status, 200);
    assert.match(blocking.text, /<h2>Gates<\/h2>/u);
    assert.match(blocking.text, /data-gate="r1" data-blocking="true"/u);
    assert.match(blocking.text, /The loop waits for this review\./u);
    assert.match(blocking.text, /Pick a doorbell <span class="el-tag el-tag--accent">gate<\/span>/u);
    assert.doesNotMatch(blocking.text, /r-gone/u, "closed gates are not shown");

    fs.writeFileSync(statePath, JSON.stringify({ implementation_loop: { status: "running", gates: [{ ...gates[0], blocking: false }] } }));
    assert.match((await request(port, "/demo")).text, /The loop keeps working; answer when you can\./u);

    fs.writeFileSync(statePath, "{ not json");
    const broken = await request(port, "/demo");
    assert.equal(broken.status, 200);
    assert.doesNotMatch(broken.text, /<h2>Gates<\/h2>/u);
  } finally {
    fs.rmSync(statePath, { force: true });
  }
  const missing = await request(port, "/demo");
  assert.equal(missing.status, 200);
  assert.doesNotMatch(missing.text, /<h2>Gates<\/h2>/u);
});

test("the inbox endpoint appends numbered entries from JSON and the plain form, and the epic home shows the form and the entries", async () => {
  const inboxPath = path.join(project.root, ".epic-loop", "epics", "demo", "inbox.jsonl");
  try {
    const home = await request(port, "/demo");
    assert.match(home.text, /<form class="el-card el-inbox__form" method="post" action="\/api\/demo\/inbox"/u);
    assert.match(home.text, /<textarea id="el-inbox-text" class="el-comment" name="text"/u);

    const first = await request(port, "/api/demo/inbox", { method: "POST", ...json({ text: "  Keep the footer links.  " }) });
    assert.equal(first.status, 201);
    const entry = JSON.parse(first.text);
    assert.equal(entry.id, "I1");
    assert.equal(entry.text, "Keep the footer links.");
    assert.ok(entry.createdAt);

    const form = await request(port, "/api/demo/inbox", { method: "POST", body: "text=No+carousel%2C+please.", headers: { "content-type": "application/x-www-form-urlencoded" } });
    assert.equal(form.status, 200);
    assert.match(form.text, /Sent to the loop/u);
    assert.match(form.text, /<span class="el-id">I2<\/span>/u);
    assert.match(form.text, /href="\/demo"/u);

    assert.equal((await request(port, "/api/demo/inbox", { method: "POST", ...json({ text: "   " }) })).status, 400);
    const crossOrigin = await request(port, "/api/demo/inbox", {
      method: "POST",
      body: JSON.stringify({ text: "evil" }),
      headers: { "content-type": "application/json", origin: "http://evil.example" },
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await request(port, "/api/nope/inbox", { method: "POST", ...json({ text: "x" }) })).status, 404);
    assert.equal((await request(port, "/api/demo/inbox")).status, 405);

    const lines = fs
      .readFileSync(inboxPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      lines.map((line) => [line.id, line.text]),
      [
        ["I1", "Keep the footer links."],
        ["I2", "No carousel, please."],
      ],
    );

    const homeAfter = await request(port, "/demo");
    assert.ok(homeAfter.text.indexOf("No carousel, please.") < homeAfter.text.indexOf("Keep the footer links."), "newest entry first");
  } finally {
    fs.rmSync(inboxPath, { force: true });
  }
});

test("review assets are served and traversal is refused", async () => {
  const asset = await request(port, "/demo/reviews/r1/assets/shot.txt");
  assert.equal(asset.status, 200);
  assert.equal(asset.text, "asset-bytes\n");
  for (const attempt of [
    "/demo/reviews/r1/../../state-of-epic.md",
    "/demo/reviews/r1/%2e%2e/%2e%2e/state-of-epic.md",
    "/demo/reviews/r1/%2E%2E%2F%2E%2E%2Fstate-of-epic.md",
    "/demo/reviews/r1//etc/passwd",
    "/_runtime/..%2f..%2fpaths.mjs",
    "/demo/reviews/..%2f..%2fdemo/page.html",
  ]) {
    const response = await request(port, attempt);
    assert.equal(response.status, 404, attempt);
    assert.doesNotMatch(response.text, /Epic: Demo Epic|root:|ENTRY_DIR/u, attempt);
  }
});

test("concurrent PATCHes merge per control and the last write to one control wins", async () => {
  await Promise.all([
    request(port, "/api/demo/reviews/r1/answers", { method: "PATCH", ...json({ controls: { mechanism: "hook" } }) }),
    request(port, "/api/demo/reviews/r1/answers", { method: "PATCH", ...json({ controls: { comment: "fine" } }) }),
  ]);
  await request(port, "/api/demo/reviews/r1/answers", { method: "PATCH", ...json({ controls: { comment: "fine, ship it" } }) });
  const answers = JSON.parse((await request(port, "/api/demo/reviews/r1/answers")).text);
  assert.deepEqual(answers.controls, { mechanism: "hook", comment: "fine, ship it" });
  assert.ok(answers.savedAt);
  const onDisk = JSON.parse(fs.readFileSync(path.join(project.review, "answers.json"), "utf8"));
  assert.deepEqual(onDisk.controls, answers.controls);
  const bad = await request(port, "/api/demo/reviews/r1/answers", { method: "PATCH", ...json({ controls: ["x"] }) });
  assert.equal(bad.status, 400);
});

test("submit sets submittedAt once unless resubmitted, and clears the pending count", async () => {
  const first = JSON.parse((await request(port, "/api/demo/reviews/r1/submit", { method: "POST", ...json({}) })).text);
  assert.ok(first.submittedAt);
  const second = JSON.parse((await request(port, "/api/demo/reviews/r1/submit", { method: "POST", ...json({}) })).text);
  assert.equal(second.submittedAt, first.submittedAt);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const third = JSON.parse((await request(port, "/api/demo/reviews/r1/submit", { method: "POST", ...json({ resubmit: true }) })).text);
  assert.notEqual(third.submittedAt, first.submittedAt);
  assert.match((await request(port, "/")).text, /title="nothing pending">0</u);
});

test("problem reports append to problems.jsonl from JSON and from the plain form", async () => {
  const fromJson = await request(port, "/api/demo/reviews/r1/problem", { method: "POST", ...json({ text: "image missing", url: "/demo/reviews/r1/" }) });
  assert.equal(fromJson.status, 200);
  const fromForm = await request(port, "/api/demo/reviews/r1/problem", {
    method: "POST",
    body: "text=layout+broken&url=%2Fdemo%2Freviews%2Fr1%2F",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: `http://127.0.0.1:${port}`, "user-agent": "test-agent" },
  });
  assert.equal(fromForm.status, 200);
  assert.match(fromForm.text, /href="\/demo\/reviews\/r1\/"/u);
  const lines = fs
    .readFileSync(path.join(project.review, "problems.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map((line) => line.text),
    ["image missing", "layout broken"],
  );
  assert.equal(lines[1].userAgent, "test-agent");
  assert.ok(lines.every((line) => line.at));
});

test("foreign Host and cross-origin writes are refused, and oversized bodies are rejected", async () => {
  assert.equal((await request(port, "/", { headers: { host: "evil.example" } })).status, 403);
  assert.equal((await request(port, "/", { headers: { host: `evil.example:${port}` } })).status, 403);
  const crossOrigin = await request(port, "/api/demo/reviews/r1/answers", {
    method: "PATCH",
    body: JSON.stringify({ controls: { x: 1 } }),
    headers: { "content-type": "application/json", origin: "http://evil.example" },
  });
  assert.equal(crossOrigin.status, 403);
  const answers = JSON.parse((await request(port, "/api/demo/reviews/r1/answers")).text);
  assert.equal(answers.controls.x, undefined);
  const localhost = await request(port, "/", { headers: { host: `localhost:${port}` } });
  assert.equal(localhost.status, 200);
  const huge = await request(port, "/api/demo/reviews/r1/problem", {
    method: "POST",
    body: JSON.stringify({ text: "x".repeat(1024 * 1024 + 10) }),
    headers: { "content-type": "application/json" },
  }).catch(() => ({ status: 413 }));
  assert.equal(huge.status, 413);
});

test("--stop stops the server and removes server.json; a stale record is replaced on the next start", async () => {
  const info = JSON.parse(fs.readFileSync(path.join(project.root, ".epic-loop", ".runtime", "server.json"), "utf8"));
  assert.equal(serve(project, "--stop").stopped, true);
  assert.equal(alive(info.pid), false);
  assert.equal(fs.existsSync(path.join(project.root, ".epic-loop", ".runtime", "server.json")), false);
  assert.equal(serve(project, "--status").running, false);

  fs.writeFileSync(path.join(project.root, ".epic-loop", ".runtime", "server.json"), JSON.stringify({ pid: 999999, port: 1, url: "http://127.0.0.1:1/", root: project.root }));
  assert.equal(serve(project, "--status").stale, true);
  const fresh = serve(project, "--detach");
  assert.equal(fresh.reused, false);
  assert.notEqual(fresh.pid, 999999);
  assert.equal((await request(fresh.port, "/_health")).status, 200);
  assert.equal(serve(project, "--stop").stopped, true);
  assert.equal(alive(fresh.pid), false);
});
