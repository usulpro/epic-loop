import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";

import { assertSuccess, makeTempRoot, repoRoot, runNodeScript } from "./test-utils.mjs";

const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const SLUG = "docs";

const TRACKER = `# Tracker

Epic: Docs Epic

Next task id: T3

## Active Roadmap

### Phase 1: Build

- Phase status: doing

- [ ] Kind: implementation | Status: doing | T1 · Render the docs
  - Docs: \`docs/guide.md\`

- [ ] Kind: verification | Status: todo | T2 · Verify the docs
`;

const DECISIONS = `# Decision Log

## Active Decisions

- **D16 — Render markdown on the server** (2026-10-20).
  - Why: links and ids need the epic's index.

## Open Questions

- **Q2 — Which second language.** Open.
`;

const RISKS = `# Risk Register

| ID | Risk | Status |
|---|---|---|
| R1 | Links rot when docs move | open |
`;

const GUIDE = `# The Guide

See [the decisions](../decision-log.md#d16), [the tracker](tracker.md), [a heading](#the-guide), [a missing doc](missing.md), [repo code](../../../../src/app.mjs) and [the web](https://example.com/page).

The default is D-16; T1 renders, H1 waits, R1 and Q2 stay, D99 is unknown, \`D16\` is code and [D16](../decision-log.md) is a link.

| Column | Value |
|---|---|
| one | 1 |

- outer
  - inner

\`\`\`js
const D16 = "code";
\`\`\`

<script>alert("x")</script>

![diagram](diagram.svg)
`;

let root;
let home;
let port;
let epicDir;
const started = new Set();

before(() => {
  root = fs.realpathSync(makeTempRoot("epic-docs"));
  home = makeTempRoot("epic-docs-home");
  epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  fs.mkdirSync(path.join(epicDir, ".runtime"), { recursive: true });
  fs.mkdirSync(path.join(epicDir, "docs"), { recursive: true });
  fs.mkdirSync(path.join(epicDir, "stop-reports"), { recursive: true });
  fs.writeFileSync(path.join(epicDir, "tracker.md"), TRACKER);
  fs.writeFileSync(path.join(epicDir, "decision-log.md"), DECISIONS);
  fs.writeFileSync(path.join(epicDir, "risk-register.md"), RISKS);
  fs.writeFileSync(path.join(epicDir, "state-of-epic.md"), "# State Of Epic\n\nEpic: Docs Epic\nActive task: T1\n");
  fs.writeFileSync(path.join(epicDir, "docs", "guide.md"), GUIDE);
  fs.writeFileSync(path.join(epicDir, "docs", "diagram.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(epicDir, "stop-reports", "01-class-A.md"), "# Stop report 01\n\nThe epic is done; see T2.\n");
  fs.writeFileSync(path.join(epicDir, ".runtime", "runtime-state.json"), JSON.stringify({ mode: "implementation" }));
  fs.writeFileSync(path.join(epicDir, ".runtime", "notes.md"), "# hidden\n");
  fs.writeFileSync(path.join(root, "secret.md"), "# secret outside the epic\n");
  fs.symlinkSync(path.join(root, "secret.md"), path.join(epicDir, "docs", "escape.md"));
  assertSuccess(
    runNodeScript("human-queue.mjs", [
      "--root",
      root,
      "--slug",
      SLUG,
      "add",
      "--kind",
      "human-action",
      "--ask",
      "Approve the docs host",
      "--why",
      "it is public",
      "--blocks",
      "T2",
    ]),
  );
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

function get(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ headers: { host: `127.0.0.1:${port}` }, host: "127.0.0.1", path: pathname, port }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, text, type: res.headers["content-type"] }));
      })
      .on("error", reject);
  });
}

test("a doc page renders tables, nested lists and code fences, and shows raw HTML as text", async () => {
  const page = await get(`/${SLUG}/docs/docs/guide.md`);
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>The Guide · epic-loop<\/title>/u);
  assert.match(
    page.text,
    /<nav class="el-nav" aria-label="Breadcrumb">.*<a href="\/docs">docs<\/a>.*<a href="\/docs\/docs\/">docs<\/a>.*aria-current="page">docs\/guide\.md<\/a>/u,
  );
  assert.match(page.text, /<h1 id="the-guide">The Guide<\/h1>/u);
  assert.match(page.text, /<div class="el-table-wrap"><table class="el-table">\s*<thead>\s*<tr>\s*<th>Column<\/th>/u);
  assert.match(page.text, /<li>outer\s*<ul>\s*<li>inner<\/li>/u);
  assert.match(page.text, /<pre><code class="language-js">const D16 = &quot;code&quot;;/u);
  assert.match(page.text, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/u);
  assert.doesNotMatch(page.text, /<script>alert/u);
  assert.match(page.text, /<img src="\/docs\/docs\/docs\/diagram\.svg" alt="diagram">/u);
  assert.match(page.text, /<main class="el-main" data-epic="docs" data-live-main data-live-file="docs\/guide\.md">/u);
  assert.match(page.text, /<script type="module" src="\/_runtime\/refs\.js"><\/script>/u);
  const image = await get(`/${SLUG}/docs/docs/diagram.svg`);
  assert.equal(image.status, 200);
  assert.equal(image.type, "image/svg+xml");
});

test("relative links go to doc pages with their anchors; other links are plain text or external", async () => {
  const { text } = await get(`/${SLUG}/docs/docs/guide.md`);
  assert.match(text, /<a href="\/docs\/docs\/decision-log\.md#D16">the decisions<\/a>/u);
  assert.match(text, /<a href="\/docs\/docs\/tracker\.md">the tracker<\/a>/u, "a path relative to the epic root resolves too");
  assert.match(text, /<a href="#the-guide">a heading<\/a>/u);
  assert.match(text, /<span class="el-path" title="not found in this epic">a missing doc <span class="el-meta">\(missing\.md\)<\/span><\/span>/u);
  assert.match(text, /<span class="el-path" title="outside this epic">repo code <span class="el-meta">\(\.\.\/\.\.\/\.\.\/\.\.\/src\/app\.mjs\)<\/span><\/span>/u);
  assert.match(text, /<a href="https:\/\/example\.com\/page" rel="noopener noreferrer">the web<\/a>/u);
  // A code span that names an epic file links to it.
  const tracker = (await get(`/${SLUG}/docs/tracker.md`)).text;
  assert.match(tracker, /<a href="\/docs\/docs\/docs\/guide\.md"><code>docs\/guide\.md<\/code><\/a>/u);
});

test("paths outside the epic, hidden runtime files and escaping symlinks are 404", async () => {
  for (const pathname of [
    `/${SLUG}/docs/../secret.md`,
    `/${SLUG}/docs/%2e%2e/%2e%2e/secret.md`,
    `/${SLUG}/docs/docs/..%2f..%2fsecret.md`,
    `/${SLUG}/docs/.runtime/notes.md`,
    `/${SLUG}/docs/.runtime/runtime-state.json`,
    `/${SLUG}/docs/docs/escape.md`,
    `/${SLUG}/docs/reviews/x/page.html`,
    `/${SLUG}/docs/nope.md`,
    `/nope/docs/tracker.md`,
  ]) {
    const page = await get(pathname);
    assert.notEqual(page.status, 200, pathname);
    assert.doesNotMatch(page.text, /secret outside the epic|hidden/u, pathname);
  }
  const index = await get(`/${SLUG}/docs/`);
  assert.equal(index.status, 200);
  assert.match(index.text, /data-docs-group="artifacts"[\s\S]*href="\/docs\/docs\/tracker\.md"/u);
  assert.match(index.text, /data-docs-group="stopReports"[\s\S]*01-class-A\.md/u);
  assert.doesNotMatch(index.text, /escape\.md|notes\.md/u);
});

test("the ids API resolves every kind, including the hyphenated alias", async () => {
  const index = JSON.parse((await get(`/api/${SLUG}/ids`)).text);
  assert.equal(index.ids.T1.title, "Render the docs");
  assert.equal(index.ids.T1.file, "tracker.md");
  assert.equal(index.ids.D16.kind, "decision");
  assert.equal(index.ids.D16.file, "decision-log.md");
  assert.equal(index.ids.Q2.kind, "open-question");
  assert.equal(index.ids.R1.title, "Links rot when docs move");
  assert.equal(index.ids.H1.title, "Approve the docs host");
  assert.equal(index.ids.H1.status, "open");
  assert.equal(index.aliases["D-16"], "D16");
  assert.equal(index.ids.D99, undefined);
});

const ref = (id, label, file) => `<a class="el-ref" data-ref="${id}" href="/docs/docs/${file}#${id}">${label}</a>`;

test("id mentions link to their definition, which carries a matching anchor", async () => {
  const { text } = await get(`/${SLUG}/docs/docs/guide.md`);
  assert.ok(text.includes(`The default is ${ref("D16", "D-16", "decision-log.md")}; ${ref("T1", "T1", "tracker.md")} renders, ${ref("H1", "H1", "human-queue.md")} waits,`));
  assert.ok(
    text.includes(
      `${ref("R1", "R1", "risk-register.md")} and ${ref("Q2", "Q2", "decision-log.md")} stay, D99 is unknown, <code>D16</code> is code and <a href="/docs/docs/decision-log.md">D16</a> is a link.`,
    ),
  );
  assert.doesNotMatch(text, /<code[^>]*>[^<]*el-ref/u);

  const decisions = (await get(`/${SLUG}/docs/decision-log.md`)).text;
  assert.match(decisions, /<li><span class="el-anchor" id="D16"><\/span><strong>D16 — Render markdown on the server<\/strong>/u, "no self-link on the defining line");
  assert.match(decisions, /<span class="el-anchor" id="Q2"><\/span><strong>Q2 — Which second language\.<\/strong>/u);
  assert.match(
    (await get(`/${SLUG}/docs/tracker.md`)).text,
    /<li>\s*<p><span class="el-anchor" id="T1"><\/span>\[ \] Kind: implementation \| Status: doing \| T1 · Render the docs/u,
  );
  assert.match((await get(`/${SLUG}/docs/risk-register.md`)).text, /<td><span class="el-anchor" id="R1"><\/span>R1<\/td>/u);
  assert.match((await get(`/${SLUG}/docs/human-queue.md`)).text, /<span class="el-anchor" id="H1"><\/span><strong>H1<\/strong>/u);
  assert.match((await get(`/${SLUG}/docs/stop-reports/01-class-A.md`)).text, /see <a class="el-ref" data-ref="T2" href="\/docs\/docs\/tracker\.md#T2">T2<\/a>/u);
  // The home links to the docs.
  assert.match((await get(`/${SLUG}`)).text, /<section class="el-section el-docs-section" id="docs">[\s\S]*href="\/docs\/docs\/docs\/guide\.md"/u);
});

test("a changed doc produces a change event, and the page fragment shows the new text", { timeout: 20000 }, async () => {
  const guide = path.join(epicDir, "docs", "guide.md");
  const event = await new Promise((resolve, reject) => {
    const req = http.get({ headers: { host: `127.0.0.1:${port}` }, host: "127.0.0.1", path: `/api/${SLUG}/events`, port }, (res) => {
      let buffer = "";
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error("no change event"));
      }, 2500);
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.includes(": connected") && !res.acted) {
          res.acted = true;
          setTimeout(() => fs.appendFileSync(guide, "\nA new closing paragraph about T2.\n"), 100);
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
  assert.equal(event.file, "docs/guide.md");
  const fragment = await get(`/${SLUG}/docs/docs/guide.md?fragment=main`);
  assert.doesNotMatch(fragment.text, /<html|<main|<script/u);
  assert.match(fragment.text, /<article class="el-doc">[\s\S]*A new closing paragraph about <a class="el-ref" data-ref="T2"/u);
});
