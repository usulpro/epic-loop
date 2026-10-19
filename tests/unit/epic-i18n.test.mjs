import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, test } from "node:test";

import { makeTempRoot, repoRoot } from "./test-utils.mjs";

// Presentation-layer localization (Phase 5 Task 5) with a fake headless translator: never a model.
const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const fake = path.join(repoRoot, "tests", "fixtures", "translate", "fake-translator.mjs");
const COOKIE = "el-lang=ru";

const GUIDE = `# The Guide

See [the decisions](../decision-log.md#d16) and \`docs/other.md\`.

## The waiter

The default is D16 and T1 renders.

\`\`\`js
const D16 = "code";
\`\`\`
`;

const servers = [];

function setupProject(platform, env = {}) {
  const root = fs.realpathSync(makeTempRoot("epic-i18n"));
  const home = makeTempRoot("epic-i18n-home");
  const log = path.join(home, "fake-calls.jsonl");
  fs.mkdirSync(path.join(root, ".epic-loop", ".runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", ".runtime", "platform.json"), JSON.stringify({ platform }));
  for (const [slug, second] of [
    ["intl", "ru"],
    ["plain", null],
  ]) {
    const dir = path.join(root, ".epic-loop", "epics", slug);
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "state-of-epic.md"),
      `# State Of Epic\n\nEpic: ${slug} epic\nSlug: \`${slug}\`\n${second ? `Second language: ${second}\n` : ""}\n## Read First\n`,
    );
    fs.writeFileSync(
      path.join(dir, "tracker.md"),
      "# Tracker\n\nEpic: Intl Epic\n\nNext task id: T2\n\n## Active Roadmap\n\n### Phase 1: Build\n\n- Phase status: doing\n\n- [ ] Kind: implementation | Status: doing | T1 · Render the docs\n",
    );
    fs.writeFileSync(path.join(dir, "decision-log.md"), "# Decision Log\n\n## Active Decisions\n\n- **D16 — Render markdown on the server** (2026-10-20).\n");
    fs.writeFileSync(path.join(dir, "docs", "guide.md"), GUIDE);
    fs.writeFileSync(path.join(dir, "docs", "other.md"), "# Other\n\nA second doc about T1.\n");
  }
  const childEnv = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", FAKE_TRANSLATOR_LOG: log, HOME: home, ...env };
  childEnv[platform === "codex" ? "EPIC_LOOP_CODEX_BIN" : "EPIC_LOOP_CLAUDE_BIN"] = fake;
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--json", "--detach"], { encoding: "utf8", env: childEnv });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  const server = {
    calls: () =>
      fs.existsSync(log)
        ? fs
            .readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [],
    env: childEnv,
    pid: info.pid,
    port: info.port,
    root,
  };
  servers.push(server);
  return server;
}

after(() => {
  for (const server of servers) {
    spawnSync(process.execPath, [cliEntry, "serve", "--root", server.root, "--stop", "--json"], { encoding: "utf8", env: server.env });
    try {
      process.kill(server.pid, "SIGKILL");
    } catch {}
  }
});

function get(server, pathname, cookie = COOKIE) {
  return new Promise((resolve, reject) => {
    http
      .get({ headers: { host: `127.0.0.1:${server.port}`, ...(cookie ? { cookie } : {}) }, host: "127.0.0.1", path: pathname, port: server.port }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ headers: res.headers, status: res.statusCode, text }));
      })
      .on("error", reject);
  });
}

// Runs `action` once the event stream is connected and resolves on the next `translated` event.
function nextTranslated(server, slug, action, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ headers: { host: `127.0.0.1:${server.port}` }, host: "127.0.0.1", path: `/api/${slug}/events`, port: server.port }, (res) => {
      let buffer = "";
      let acted = false;
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error("no translated event"));
      }, timeoutMs);
      res.setEncoding("utf8");
      res.on("data", async (chunk) => {
        buffer += chunk;
        if (buffer.includes(": connected") && !acted) {
          acted = true;
          await action();
        }
        if (buffer.includes("event: translated\n")) {
          clearTimeout(timer);
          req.destroy();
          resolve();
        }
      });
    });
    req.on("error", () => {});
  });
}

const jobs = (server, slug = "intl") => {
  const file = path.join(server.root, ".epic-loop", "epics", slug, ".runtime", "translations", "ru", "jobs.jsonl");
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
};

test("the switch shows only with a second language and sets a SameSite cookie through a redirect", async () => {
  const server = setupProject("claude-code");
  const plain = await get(server, "/plain", null);
  assert.doesNotMatch(plain.text, /el-lang/u);
  assert.match(plain.text, /<html lang="en">/u);
  const english = await get(server, "/intl/docs/docs/guide.md", null);
  assert.match(
    english.text,
    /<div class="el-seg el-lang" role="group" aria-label="Language"><a href="\/intl\/docs\/docs\/guide\.md\?lang=en" hreflang="en" data-lang="en" aria-current="true">EN<\/a><a href="\/intl\/docs\/docs\/guide\.md\?lang=ru" hreflang="ru" data-lang="ru">RU<\/a><\/div>/u,
  );
  assert.doesNotMatch(english.text, /Translating/u);
  // Content-Language is the chosen language, so a live page notices a switch made in another tab.
  assert.equal(english.headers["content-language"], "en");
  assert.equal((await get(server, "/intl?fragment=main")).headers["content-language"], "ru");
  assert.equal((await get(server, "/intl/docs/docs/guide.md?fragment=main")).headers["content-language"], "ru");
  const set = await get(server, "/intl/docs/docs/guide.md?lang=ru", null);
  assert.equal(set.status, 303);
  assert.equal(set.headers.location, "/intl/docs/docs/guide.md");
  assert.match(set.headers["set-cookie"][0], /^el-lang=ru; Path=\/; SameSite=Strict/u);
  assert.equal((await get(server, "/intl?lang=de", null)).status, 400);
  assert.ok(server.calls().length <= 2, "only the two RU fragment requests above queued jobs");
});

test("a doc translates in the background, renders through the same renderer, and is cached by content", { timeout: 30000 }, async () => {
  const server = setupProject("claude-code");
  let first;
  await nextTranslated(server, "intl", async () => {
    first = await get(server, "/intl/docs/docs/guide.md");
  });
  assert.match(first.text, /<p class="el-meta el-doc__note" data-translating role="status">Translating…<\/p>/u);
  assert.match(first.text, /<h1 id="the-guide">The Guide<\/h1>/u, "English while the job runs");

  const page = await get(server, "/intl/docs/docs/guide.md");
  assert.match(page.text, /<html lang="ru">/u);
  assert.match(page.text, /<h1 id="the-guide">\[ru\] The Guide<\/h1>/u, "the English heading id stays");
  assert.match(page.text, /<h2 id="the-waiter">\[ru\] The waiter<\/h2>/u);
  assert.match(page.text, /\[ru\] The default is <a class="el-ref" data-ref="D16" href="\/intl\/docs\/decision-log\.md#D16">D16<\/a>/u);
  assert.match(page.text, /<a href="\/intl\/docs\/decision-log\.md#D16">the decisions<\/a>/u);
  assert.match(page.text, /<a href="\/intl\/docs\/docs\/other\.md"><code>docs\/other\.md<\/code><\/a>/u);
  assert.match(page.text, /const D16 = &quot;code&quot;;/u);
  assert.doesNotMatch(page.text, /Translating/u);
  assert.match(page.text, /data-lang="ru" aria-current="true"/u);

  const calls = server.calls();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [
    "-p",
    "--model",
    "haiku",
    "--tools",
    "",
    "--output-format",
    "text",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--disable-slash-commands",
  ]);
  assert.ok(!calls[0].cwd.startsWith(server.root), "the translator runs outside the project");
  const [job] = jobs(server);
  assert.equal(job.kind, "doc");
  assert.equal(job.ok, true);
  assert.equal(job.platform, "claude-code");
  assert.equal(job.model, "haiku");
  assert.match(job.key, /^[0-9a-f]{64}$/u);
  assert.ok(fs.existsSync(path.join(server.root, ".epic-loop", "epics", "intl", ".runtime", "translations", "ru", "docs", `${job.key}.md`)));

  await get(server, "/intl/docs/docs/guide.md");
  assert.equal(server.calls().length, 1, "served from the cache");

  await nextTranslated(server, "intl", () => get(server, "/intl/docs/docs/other.md"));
  assert.equal(server.calls().length, 2);
  fs.appendFileSync(path.join(server.root, ".epic-loop", "epics", "intl", "docs", "guide.md"), "\nA new closing line.\n");
  await nextTranslated(server, "intl", () => get(server, "/intl/docs/docs/guide.md"));
  assert.match((await get(server, "/intl/docs/docs/guide.md")).text, /\[ru\] A new closing line\./u);
  await get(server, "/intl/docs/docs/other.md");
  assert.equal(server.calls().length, 3, "only the edited doc was translated again");

  for (const pathname of ["/intl/docs/.runtime/translations/ru/jobs.jsonl", `/intl/docs/.runtime/translations/ru/docs/${job.key}.md`])
    assert.equal((await get(server, pathname)).status, 404);
});

test("the home translates its segments in one batched call and keeps ids, times and the feed", { timeout: 30000 }, async () => {
  const server = setupProject("claude-code");
  let first;
  await nextTranslated(server, "intl", async () => {
    first = await get(server, "/intl");
  });
  assert.match(first.text, /<h2 id="el-loop-title">Loop<\/h2>/u, "English until the batch arrives");
  assert.equal(server.calls().length, 1);
  const page = await get(server, "/intl");
  assert.match(page.text, /<html lang="ru">/u);
  assert.match(page.text, /<h2 id="el-loop-title">\[ru\] Loop<\/h2>/u);
  assert.match(page.text, /<span class="el-task__title">\[ru\] Render the docs<\/span>/u);
  assert.match(page.text, /<span class="el-id"><a class="el-ref" data-ref="T1" href="\/intl\/docs\/tracker\.md#T1">T1<\/a><\/span>/u);
  assert.match(page.text, /<p class="el-muted">\[ru\] No activity recorded yet\.<\/p>/u);
  const [job] = jobs(server);
  assert.equal(job.kind, "segments");
  assert.ok(job.count > 5);
  await get(server, "/intl");
  await get(server, "/intl?fragment=main");
  assert.equal(server.calls().length, 1, "segments come from the cache");
});

test("on Codex the translator runs codex exec read-only on the cheap model", { timeout: 30000 }, async () => {
  const server = setupProject("codex");
  await nextTranslated(server, "intl", () => get(server, "/intl/docs/docs/other.md"));
  assert.match((await get(server, "/intl/docs/docs/other.md")).text, /<h1 id="other">\[ru\] Other<\/h1>/u);
  const [call] = server.calls();
  const output = call.args[call.args.indexOf("-o") + 1];
  assert.deepEqual(call.args, [
    "exec",
    "-m",
    "gpt-6-luna",
    "-c",
    'model_reasoning_effort="low"',
    "-s",
    "read-only",
    "--skip-git-repo-check",
    "--ephemeral",
    "--color",
    "never",
    "-C",
    call.cwd,
    "-o",
    output,
    "-",
  ]);
  assert.equal(jobs(server)[0].platform, "codex");
});

test("a translation that drops an id is rejected and English is served without a retry", { timeout: 30000 }, async () => {
  const server = setupProject("claude-code", { FAKE_TRANSLATOR_MODE: "drop-id" });
  await nextTranslated(server, "intl", () => get(server, "/intl/docs/docs/guide.md"));
  const page = await get(server, "/intl/docs/docs/guide.md");
  assert.match(page.text, /Translation unavailable; showing English\./u);
  assert.match(page.text, /<h1 id="the-guide">The Guide<\/h1>/u);
  assert.match(page.text, /<html lang="en">/u);
  const [job] = jobs(server);
  assert.equal(job.ok, false);
  assert.match(job.reason, /^ids changed: -(D16|T1)/u);
  await get(server, "/intl/docs/docs/guide.md");
  assert.equal(server.calls().length, 1, "no retry loop");
});

test("a hanging translator times out and its process group is killed", { timeout: 30000 }, async () => {
  const server = setupProject("claude-code", { EPIC_LOOP_TRANSLATE_TIMEOUT_MS: "600", FAKE_TRANSLATOR_MODE: "hang" });
  await nextTranslated(server, "intl", () => get(server, "/intl/docs/docs/other.md"));
  const [job] = jobs(server);
  assert.equal(job.ok, false);
  assert.match(job.reason, /^timeout after 600 ms/u);
  const [call] = server.calls();
  let alive = true;
  for (let index = 0; index < 20 && alive; index += 1) {
    try {
      process.kill(call.pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch {
      alive = false;
    }
  }
  assert.equal(alive, false, "the fake translator process is gone");
  assert.match((await get(server, "/intl/docs/docs/other.md")).text, /Translation unavailable; showing English\./u);
});
