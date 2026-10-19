import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";

import { assertSuccess, makeTempRoot, repoRoot, runNodeScript } from "./test-utils.mjs";

const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const SLUG = "home";

const TRACKER = `# Tracker

Epic: Home Epic

Next task id: T6

## Task Statuses

- todo
- doing
- on-hold
- done

## Active Roadmap

### Phase 1: Shape

- Phase status: done

- Tasks: 2 closed tasks archived to \`tracker.closed-phases.previous-layer-01.md\`. Read it only if you need this phase's task-level closure context.

### Phase 2: Build

- Phase status: doing

- [x] Kind: implementation | Status: done | T3 · Build the parser
  - Outcome: parses the input.

- [ ] Kind: implementation | Status: doing | T4 · Publish the package
  - Outcome: the package is on npm.
  - Acceptance: npm view shows the version.
  - Docs: \`docs/release.md\`

- [ ] Kind: verification | Status: on-hold | T5 · Verify the release
  - Hold: human-action (H2)
  - Method: install from npm.
`;

const STATE = `# State Of Epic

Epic: Home Epic
Slug: \`home\`
Active phase: Phase 2 - Build
Active task: Phase 2 Task 2 (T4) - Publish the package
`;

let root;
let home;
let port;
const started = new Set();

function writeRuntime(loop) {
  fs.writeFileSync(path.join(root, ".epic-loop", "epics", SLUG, ".runtime", "runtime-state.json"), JSON.stringify({ mode: "implementation", implementation_loop: loop }));
}

before(() => {
  root = fs.realpathSync(makeTempRoot("epic-home"));
  home = makeTempRoot("epic-home-home");
  const epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  fs.mkdirSync(path.join(epicDir, ".runtime"), { recursive: true });
  fs.mkdirSync(path.join(epicDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(epicDir, "tracker.md"), TRACKER);
  fs.writeFileSync(path.join(epicDir, "state-of-epic.md"), STATE);
  fs.writeFileSync(path.join(epicDir, "docs", "problem-framing.md"), "# Epic Problem Framing\n\n## Problem\n\nPublishing by hand is slow and error-prone.\n\n- a list item\n");
  const script = (name, args) => assertSuccess(runNodeScript(name, ["--root", root, "--slug", SLUG, ...args]));
  script("human-queue.mjs", ["add", "--kind", "security-hold", "--ask", "Allow npm publish", "--why", "a guard stopped it", "--blocks", "T4"]);
  script("human-queue.mjs", ["add", "--kind", "human-action", "--ask", "Add the NPM_TOKEN secret", "--why", "CI needs it", "--blocks", "T5"]);
  script("human-queue.mjs", ["add", "--kind", "external-wait", "--ask", "Wait for the registry outage to end", "--why", "npm is down", "--blocks", "T4"]);
  script("agent-decision.mjs", ["add", "--title", "Publish from CI only", "--default", "tag-triggered workflow", "--why", "reproducible"]);
  const reviewDir = path.join(epicDir, "reviews", "2026-10-20-token");
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "page.html"), "<title>Add the token</title><main>x</main>");
  fs.writeFileSync(path.join(reviewDir, "review.json"), JSON.stringify({ id: "2026-10-20-token", title: "Add the token" }));
  writeRuntime({
    active_turn_started_at: new Date(Date.now() - 125000).toISOString(),
    current_role: "manager",
    gates: [{ blocking: true, covers: ["H2"], review: "2026-10-20-token", status: "open" }],
    iteration: 12,
    status: "running",
  });
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--json", "--detach"], {
    encoding: "utf8",
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: home },
  });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  started.add(info.pid);
  port = info.port;
});

after(() => {
  spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--stop", "--json"], { encoding: "utf8", env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: home } });
  for (const pid of started) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
});

function get(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get({ headers: { host: `127.0.0.1:${port}`, ...headers }, host: "127.0.0.1", path: pathname, port }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, text }));
      })
      .on("error", reject);
  });
}

// Opens the event stream and resolves the next `change` event after `action` runs.
function nextChange(action, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ headers: { host: `127.0.0.1:${port}` }, host: "127.0.0.1", path: `/api/${SLUG}/events`, port }, (res) => {
      assert.match(res.headers["content-type"], /text\/event-stream/u);
      let buffer = "";
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error(`no change event within ${timeoutMs} ms`));
      }, timeoutMs + 500);
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.includes(": connected") && !res.acted) {
          res.acted = true;
          setTimeout(action, 100);
        }
        const match = buffer.match(/event: change\ndata: (.+)\n\n/u);
        if (match) {
          clearTimeout(timer);
          req.destroy();
          resolve(JSON.parse(match[1]));
        }
      });
    });
    req.on("error", () => {});
  });
}

const health = async () => JSON.parse((await get("/_health")).text);

test("the epic home shows intent, loop state, what waits, agent decisions, and phases with tasks", async () => {
  const page = await get(`/${SLUG}`);
  assert.equal(page.status, 200);
  const html = page.text;
  assert.match(html, /<h1>Home Epic<\/h1>/u);
  assert.match(html, /<p class="el-intent">Publishing by hand is slow and error-prone\.<\/p>/u);
  // Loop state: status label, mode, phase, task with its id, role with the ticking elapsed time, iteration.
  assert.match(html, /data-loop-status="running">running<\/span>/u);
  assert.match(html, /<dt>mode<\/dt><dd>implementation<\/dd>/u);
  assert.match(html, /<dt>task<\/dt><dd>Phase 2 Task 2 \(T4\) - Publish the package<\/dd>/u);
  assert.match(html, /<dt>role<\/dt><dd>manager · <time class="el-elapsed" data-since="[^"]+"[^>]*>2m 0[4-9]s<\/time><\/dd>/u);
  assert.match(html, /<dt>iteration<\/dt><dd>12<\/dd>/u);
  // What waits: the gate, holds grouped with security-hold first, the held task and the review link, external waits.
  assert.match(html, /data-gate="2026-10-20-token" data-blocking="true"/u);
  const security = html.indexOf('data-hold-kind="security-hold"');
  const action = html.indexOf('data-hold-kind="human-action"');
  assert.ok(security !== -1 && action !== -1 && security < action, "security-hold first");
  assert.match(
    html,
    /<li data-item="H2"><span class="el-id">H2<\/span> Add the NPM_TOKEN secret<div class="el-meta">blocks T5 · holds T5 Verify the release<\/div> <a href="\/home\/reviews\/2026-10-20-token\/">answer on its page<\/a><\/li>/u,
  );
  assert.match(html, /data-hold-kind="external-wait"[\s\S]*Wait for the registry outage to end/u);
  // Unconfirmed agent-made decisions.
  assert.match(html, /<li data-decision="D1"><span class="el-id">D1<\/span> Publish from CI only<div class="el-meta">default taken: tag-triggered workflow<\/div><\/li>/u);
  // Phases: archived tasks count in the totals; the active phase is open, the closed one is not.
  assert.match(
    html,
    /<details class="el-phase" id="phase-1" data-phase="phase-1">\s*<summary><span class="el-phase__title">Phase 1: Shape<\/span> <span class="el-tag">done<\/span> <span class="el-meta">2 \/ 2 done<\/span>/u,
  );
  assert.match(html, /<details class="el-phase" id="phase-2" data-phase="phase-2" open>[\s\S]*1 \/ 3 done/u);
  assert.match(html, /data-task="T4" data-status="doing"><details id="task-T4"><summary><span class="el-id">T4<\/span> <span class="el-tag el-tag--accent">doing<\/span>/u);
  assert.match(html, /<dt>Acceptance<\/dt><dd>npm view shows the version\.<\/dd>/u);
  assert.match(html, /data-task="T5" data-status="on-hold">[\s\S]*<dt>Hold<\/dt><dd>human-action \(H2\)<\/dd>/u);
  // The live script, the paused marker, and the inbox form stay.
  assert.match(html, /<main class="el-main" data-epic="home" data-live-main>/u);
  assert.match(html, /<script type="module" src="\/_runtime\/home\.js"><\/script>/u);
  assert.match(html, /<span class="el-live el-meta" data-live="connecting"/u);
  assert.match(html, /action="\/api\/home\/inbox"/u);
  assert.equal((await get("/_runtime/home.js")).status, 200);

  const fragment = await get(`/${SLUG}?fragment=main`);
  assert.equal(fragment.status, 200);
  assert.doesNotMatch(fragment.text, /<html|<main|<header|<script/u);
  assert.match(fragment.text, /^\s*<div class="el-page-head">/u);
  assert.match(fragment.text, /data-task="T4"/u);
});

test("the event stream reports changes to the tracker, the loop state and the decision log", { timeout: 20000 }, async () => {
  const trackerPath = path.join(root, ".epic-loop", "epics", SLUG, "tracker.md");
  const tracker = await nextChange(() => fs.writeFileSync(trackerPath, fs.readFileSync(trackerPath, "utf8").replace("Status: doing | T4", "Status: done | T4")));
  assert.equal(tracker.file, "tracker.md");
  assert.match((await get(`/${SLUG}?fragment=main`)).text, /data-task="T4" data-status="done"/u);

  const runtime = await nextChange(() => writeRuntime({ iteration: 13, status: "awaiting-review" }));
  assert.match(runtime.file, /runtime-state\.json/u);
  assert.match((await get(`/${SLUG}?fragment=main`)).text, /data-loop-status="awaiting-review">waiting for the human/u);

  const decision = await nextChange(() =>
    assertSuccess(runNodeScript("agent-decision.mjs", ["--root", root, "--slug", SLUG, "add", "--title", "Keep npm provenance on", "--default", "on", "--why", "supply chain"])),
  );
  assert.equal(decision.file, "decision-log.md");
  assert.match((await get(`/${SLUG}?fragment=main`)).text, /data-decision="D2"/u);
});

test("the event stream applies the Origin guard and leaves no watcher behind", { timeout: 20000 }, async () => {
  assert.equal((await get(`/api/${SLUG}/events`, { origin: "http://evil.example" })).status, 403);
  assert.equal((await get("/api/nope/events")).status, 404);
  const baseline = (await health()).watchers;
  await new Promise((resolve) => {
    const req = http.get({ headers: { host: `127.0.0.1:${port}` }, host: "127.0.0.1", path: `/api/${SLUG}/events`, port }, (res) => {
      res.once("data", async () => {
        assert.equal((await health()).watchers, baseline + 1);
        req.destroy();
        resolve();
      });
    });
  });
  for (let index = 0; index < 50 && (await health()).watchers !== baseline; index += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal((await health()).watchers, baseline);
});
