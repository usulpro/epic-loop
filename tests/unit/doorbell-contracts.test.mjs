import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, repoRoot, runNodeScript, scriptPath, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const SLUG = "bell";
const SESSION = "bell-session";
const REVIEW = "2026-10-20-header";
const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const started = new Set();

after(() => {
  for (const pid of started) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
});

// A bound driver loop on the platform, with a checked review that is an open gate; `status`
// sets the loop status (awaiting-review leaves no open turn).
function setupProject(prefix, platform, status = "awaiting-review") {
  const root = makeTempRoot(prefix);
  const epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  const reviewDir = path.join(epicDir, "reviews", REVIEW);
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bell project", "--slug", SLUG, "--no-gitignore"]));
  writeOpenImplementationTurn(root, SLUG, "manager", {
    driver_session_id: SESSION,
    gates: [{ blocking: true, covers: [], opened_at: "2026-10-20T09:00:00Z", opened_iteration: 2, review: REVIEW, status: "open" }],
    ...(status === "running" ? {} : { active_turn_stopped_at: "2026-07-01T00:01:00+00:00", status }),
  });
  writeSessionBinding(root, SLUG, SESSION);
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "page.html"), '<main class="el-main"><h1>Header</h1></main>\n', "utf8");
  fs.writeFileSync(
    path.join(reviewDir, "review.json"),
    `${JSON.stringify({ id: REVIEW, title: "Header", schema: { controls: [{ name: "layout", kind: "choice", options: [{ value: "a" }, { value: "b" }] }] } })}\n`,
    "utf8",
  );
  const runtimePath = path.join(epicDir, ".runtime", "runtime-state.json");
  return {
    epicDir,
    events: (action) => {
      const file = path.join(epicDir, ".runtime", "progress-log.jsonl");
      if (!fs.existsSync(file)) return [];
      return fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.action === action);
    },
    loop: () => readJsonFile(runtimePath).implementation_loop,
    reviewDir,
    root,
    setStatus: (next) => {
      const runtime = readJsonFile(runtimePath);
      fs.writeFileSync(runtimePath, JSON.stringify({ ...runtime, implementation_loop: { ...runtime.implementation_loop, status: next } }));
    },
    submit: (submittedAt) => fs.writeFileSync(path.join(reviewDir, "answers.json"), `${JSON.stringify({ controls: { layout: "b" }, submittedAt })}\n`, "utf8"),
  };
}

const cleanup = (...contexts) => {
  for (const ctx of contexts) fs.rmSync(ctx.root, { force: true, recursive: true });
};

// Starts the waiter as Claude Code would (payload on stdin) and resolves with its exit and stderr.
function startWaiter(ctx, sessionId = SESSION, graceMs = "300") {
  const child = spawn(process.execPath, [scriptPath("doorbell-waiter.mjs"), "--root", ctx.root], {
    env: { ...process.env, EPIC_LOOP_DOORBELL_GRACE_MS: graceMs, EPIC_LOOP_DOORBELL_POLL_MS: "50" },
    stdio: ["pipe", "ignore", "pipe"],
  });
  started.add(child.pid);
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const done = new Promise((resolve) => child.on("close", (code) => resolve({ code, stderr })));
  child.stdin.end(JSON.stringify({ cwd: ctx.root, hook_event_name: "Stop", session_id: sessionId }));
  return { child, done };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lockPath = (ctx) => path.join(ctx.epicDir, ".runtime", "doorbell-waiter.lock");

async function waitForLock(ctx, pid) {
  for (let index = 0; index < 100; index += 1) {
    if (fs.existsSync(lockPath(ctx)) && fs.readFileSync(lockPath(ctx), "utf8").trim() === String(pid)) return;
    await sleep(20);
  }
  throw new Error("waiter never took the lock");
}

test("the waiter exits at once unless its session drives a loop that awaits a review", { timeout: 30000 }, async () => {
  const running = setupProject("bell-waiter-running", "claude-code", "running");
  const awaiting = setupProject("bell-waiter-other", "claude-code");
  try {
    assert.equal((await startWaiter(running).done).code, 0);
    assert.equal((await startWaiter(awaiting, "someone-else").done).code, 0);
    assert.equal(fs.existsSync(lockPath(awaiting)), false);
  } finally {
    cleanup(running, awaiting);
  }
});

test("the waiter rings with a pointer on stderr when the answers arrive, and only one waiter holds the lock", { timeout: 30000 }, async () => {
  const ctx = setupProject("bell-waiter-ring", "claude-code");
  try {
    const first = startWaiter(ctx);
    await waitForLock(ctx, first.child.pid);
    const second = await startWaiter(ctx).done;
    assert.equal(second.code, 0, "a second waiter leaves");

    ctx.submit("2026-10-20T10:00:00.000Z");
    const rung = await first.done;
    assert.equal(rung.code, 2);
    assert.match(
      rung.stderr,
      /^\[epic-loop doorbell\] epic bell: the human's input arrived \(answered reviews 2026-10-20-header\)\. Reply in one line and end the turn; the loop ingests it now\.\n$/u,
    );
    assert.equal(fs.existsSync(lockPath(ctx)), false);
    const [ring] = ctx.events("doorbell-ring");
    assert.deepEqual({ inbox: ring.inbox_ids, reviews: ring.reviews }, { inbox: [], reviews: [REVIEW] });
  } finally {
    cleanup(ctx);
  }
});

test("the waiter rings for an inbox entry, leaves when the loop moves on, and takes over a stale lock", { timeout: 30000 }, async () => {
  const ctx = setupProject("bell-waiter-inbox", "claude-code");
  try {
    fs.mkdirSync(path.dirname(lockPath(ctx)), { recursive: true });
    fs.writeFileSync(lockPath(ctx), "999999999");
    const waiter = startWaiter(ctx);
    await waitForLock(ctx, waiter.child.pid);
    fs.writeFileSync(path.join(ctx.epicDir, "inbox.jsonl"), `${JSON.stringify({ id: "I1", text: "hi", createdAt: "2026-10-20T10:00:00Z" })}\n`);
    const rung = await waiter.done;
    assert.equal(rung.code, 2);
    assert.match(rung.stderr, /\(inbox I1\)/u);

    // I1 is still pending, so the next waiter would ring at once: mark it ingested first.
    const runtimePath = path.join(ctx.epicDir, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(runtimePath, JSON.stringify({ ...runtime, implementation_loop: { ...runtime.implementation_loop, inbox_through: 1 } }));

    const waiting = startWaiter(ctx);
    await waitForLock(ctx, waiting.child.pid);
    ctx.setStatus("running");
    assert.equal((await waiting.done).code, 0);
    assert.equal(fs.existsSync(lockPath(ctx)), false);
  } finally {
    cleanup(ctx);
  }
});

test("a waiter started by the Stop of the manager turn that opened a blocking gate waits for awaiting-review instead of leaving", { timeout: 30000 }, async () => {
  // Regression (sandbox run 16): the waiter and the main Stop hook run on the same event; the main
  // hook sets awaiting-review a moment after the waiter reads the state.
  const ctx = setupProject("bell-waiter-race", "claude-code", "running");
  try {
    const waiter = startWaiter(ctx, SESSION, "5000");
    await sleep(300);
    assert.equal(waiter.child.exitCode, null, "the waiter is still there during the grace");
    ctx.setStatus("awaiting-review");
    await waitForLock(ctx, waiter.child.pid);
    ctx.submit("2026-10-20T10:00:00.000Z");
    const rung = await waiter.done;
    assert.equal(rung.code, 2);
    assert.match(rung.stderr, /answered reviews 2026-10-20-header/u);
  } finally {
    cleanup(ctx);
  }
});

test("a waiter with no blocking gate about to wait leaves at once", { timeout: 30000 }, async () => {
  const ctx = setupProject("bell-waiter-nogate", "claude-code", "running");
  try {
    const runtimePath = path.join(ctx.epicDir, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(runtimePath, JSON.stringify({ ...runtime, implementation_loop: { ...runtime.implementation_loop, gates: [] } }));
    const started = Date.now();
    assert.equal((await startWaiter(ctx, SESSION, "5000").done).code, 0);
    assert.ok(Date.now() - started < 3000, "no grace wait without a blocking gate opened in this turn");
  } finally {
    cleanup(ctx);
  }
});

test("install-hooks writes the waiter hooks for Claude Code once, and none for Codex", () => {
  const claude = setupProject("bell-install-claude", "claude-code");
  const codex = setupProject("bell-install-codex", "codex");
  try {
    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", claude.root]));
    const settingsPath = path.join(claude.root, ".claude", "settings.json");
    const first = fs.readFileSync(settingsPath, "utf8");
    const hooks = JSON.parse(first).hooks;
    for (const event of ["Stop", "SessionStart"]) {
      const waiters = hooks[event].flatMap((group) => group.hooks).filter((hook) => hook.command.includes("doorbell-waiter.mjs"));
      assert.equal(waiters.length, 1, event);
      assert.deepEqual({ ...waiters[0], command: undefined }, { asyncRewake: true, command: undefined, rewakeMessage: "epic-loop:", timeout: 86400, type: "command" });
      assert.match(waiters[0].command, /doorbell-waiter\.mjs' --root '/u);
    }
    assert.equal(hooks.UserPromptSubmit.flatMap((group) => group.hooks).filter((hook) => hook.command.includes("doorbell-waiter.mjs")).length, 0);
    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", claude.root]));
    assert.equal(fs.readFileSync(settingsPath, "utf8"), first, "a second install changes nothing");

    // A waiter without a timeout is replaced by the current one.
    const broken = JSON.parse(first);
    broken.hooks.Stop = broken.hooks.Stop.map((group) => ({
      ...group,
      hooks: group.hooks.map((hook) => (hook.command.includes("doorbell-waiter.mjs") ? { ...hook, timeout: undefined } : hook)),
    }));
    fs.writeFileSync(settingsPath, JSON.stringify(broken));
    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", claude.root]));
    assert.equal(fs.readFileSync(settingsPath, "utf8"), first);

    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", codex.root]));
    assert.doesNotMatch(fs.readFileSync(path.join(codex.root, ".codex", "hooks.json"), "utf8"), /doorbell-waiter/u);
  } finally {
    cleanup(claude, codex);
  }
});

function runHook(ctx, event, fields = {}) {
  const transcript = path.join(ctx.root, "transcript.jsonl");
  fs.writeFileSync(transcript, `${JSON.stringify({ type: "assistant", message: { content: "Role report in this turn" } })}\n`);
  const result = runNodeScript("hook.mjs", ["--root", ctx.root], {
    input: JSON.stringify({
      cwd: ctx.root,
      hook_event_name: event,
      last_assistant_message: "Role report in this turn",
      session_id: SESSION,
      transcript_path: transcript,
      turn_id: "turn-bell",
      ...fields,
    }),
  });
  assertSuccess(result);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

const context = (output) => output?.hookSpecificOutput?.additionalContext ?? "";

for (const platform of ["claude-code", "codex"]) {
  test(`${platform}: a doorbell wake while awaiting a review is logged and the next Stop starts the ingest`, () => {
    const ctx = setupProject(`bell-wake-${platform}`, platform);
    try {
      ctx.submit("2026-10-20T10:00:00.000Z");
      const pointer =
        "[epic-loop doorbell] epic bell: the human's input arrived (answered reviews 2026-10-20-header). Reply in one line and end the turn; the loop ingests it now.";
      const prompt = platform === "claude-code" ? `<task-notification>\n<summary>epic-loop: ${pointer}</summary>\n</task-notification>` : pointer;
      const note = context(runHook(ctx, "UserPromptSubmit", { prompt, prompt_id: "prompt-wake" }));
      assert.match(note, /the doorbell rang: the human's input arrived/u);
      const [wake] = ctx.events("doorbell-wake");
      assert.deepEqual(wake.reviews, [REVIEW]);
      assert.equal(ctx.loop().status, "awaiting-review", "the wake itself does not resume");

      const ingest = runHook(ctx, "Stop", { prompt_id: "prompt-wake", stop_hook_active: false });
      assert.match(ingest.reason, /manager ingest turn 3/u);
      assert.equal(ctx.loop().status, "running");
    } finally {
      cleanup(ctx);
    }
  });
}

test("the fallback names pending input on a human message, whatever the loop status", () => {
  const running = setupProject("bell-fallback-running", "claude-code", "running");
  const idle = setupProject("bell-fallback-idle", "claude-code", "idle");
  const awaiting = setupProject("bell-fallback-awaiting", "claude-code");
  const quiet = setupProject("bell-fallback-quiet", "claude-code", "running");
  try {
    for (const ctx of [running, idle, awaiting]) ctx.submit("2026-10-20T10:00:00.000Z");
    const inTurn = context(runHook(running, "UserPromptSubmit", { prompt: "how is it going?", prompt_id: "prompt-other" }));
    assert.match(inTurn, /Pending human input \(answered reviews 2026-10-20-header\) is picked up by a manager ingest turn at the next role transition\./u);

    const idleNote = context(runHook(idle, "UserPromptSubmit", { prompt: "hello", prompt_id: "prompt-idle" }));
    assert.match(
      idleNote,
      /Pending human input \(answered reviews 2026-10-20-header\) waits until the loop is resumed: node .*bind-session\.mjs --current --slug bell --mode implementation/u,
    );

    const awaitingNote = context(runHook(awaiting, "UserPromptSubmit", { prompt: "hello", prompt_id: "prompt-awaiting" }));
    assert.match(awaitingNote, /The human's input has arrived; answer the user briefly and end your reply/u);

    const nothing = context(runHook(quiet, "UserPromptSubmit", { prompt: "hello", prompt_id: "prompt-quiet" }));
    assert.doesNotMatch(nothing, /Pending human input/u);
  } finally {
    cleanup(running, idle, awaiting, quiet);
  }
});

// ---------- server (Codex rings with codex queue) ----------

function serveEnv(home, binDir) {
  const env = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: home, PATH: `${binDir}${path.delimiter}${process.env.PATH}` };
  delete env.EPIC_LOOP_CODEX_BIN;
  delete env.EPIC_LOOP_CLI;
  delete env.EPIC_LOOP_SKILL_DIR;
  return env;
}

function serve(ctx, env, ...args) {
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", ctx.root, "--json", ...args], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const info = JSON.parse(result.stdout);
  if (info.pid) started.add(info.pid);
  return info;
}

function post(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: pathname, method: "POST", headers: { host: `127.0.0.1:${port}`, "content-type": "application/json" } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

async function readRecords(ctx, count) {
  const file = path.join(ctx.epicDir, ".runtime", "doorbell.jsonl");
  for (let index = 0; index < 100; index += 1) {
    const records = fs.existsSync(file)
      ? fs
          .readFileSync(file, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
    if (records.length >= count) return records;
    await sleep(50);
  }
  throw new Error(`expected ${count} doorbell records`);
}

function fakeCodex(dir) {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(dir, "codex-calls.jsonl");
  fs.writeFileSync(path.join(bin, "codex"), `#!${process.execPath}\nrequire("node:fs").appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + "\\n");\n`, {
    mode: 0o755,
  });
  return {
    bin,
    calls: () =>
      fs.existsSync(log)
        ? fs
            .readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
        : [],
  };
}

test("on Codex the server rings the driver thread with codex queue on a submit and an inbox entry, only while awaiting a review", { timeout: 30000 }, async () => {
  const ctx = setupProject("bell-serve-codex", "codex");
  const fake = fakeCodex(ctx.root);
  const env = serveEnv(makeTempRoot("bell-serve-home"), fake.bin);
  try {
    const { port } = serve(ctx, env, "--detach");
    const submit = await post(port, `/api/${SLUG}/reviews/${REVIEW}/submit`, {});
    assert.equal(submit.status, 200);
    assert.equal(JSON.parse(submit.text).doorbell, "codex-queue");
    assert.equal((await post(port, `/api/${SLUG}/inbox`, { text: "also this" })).status, 201);
    // The two rings run in the background and may finish in either order.
    const records = (await readRecords(ctx, 2)).toSorted((left, right) => left.reason.localeCompare(right.reason));
    assert.deepEqual(
      records.map(({ exitCode, reason, ring }) => ({ exitCode, reason, ring })),
      [
        { exitCode: 0, reason: "inbox", ring: "codex-queue" },
        { exitCode: 0, reason: "submit", ring: "codex-queue" },
      ],
    );
    const calls = fake.calls();
    assert.equal(calls.length, 2);
    for (const call of calls) assert.deepEqual(call.slice(0, 4), ["queue", "--thread", SESSION, "--message"]);
    const messages = calls.map((call) => call[4]);
    assert.ok(messages.some((message) => message.startsWith("[epic-loop doorbell] epic bell: the human's input arrived (answered reviews 2026-10-20-header)")));
    assert.ok(messages.some((message) => /\(inbox I1\)/u.test(message)));

    ctx.setStatus("running");
    const whileRunning = await post(port, `/api/${SLUG}/reviews/${REVIEW}/submit`, { resubmit: true });
    assert.equal(JSON.parse(whileRunning.text).doorbell, "loop-running");
    ctx.setStatus("idle");
    assert.equal(JSON.parse((await post(port, `/api/${SLUG}/reviews/${REVIEW}/submit`, { resubmit: true })).text).doorbell, "none");
    const later = await readRecords(ctx, 4);
    assert.deepEqual(
      later.slice(2).map((record) => record.ring),
      ["loop-running", "none"],
    );
    assert.equal(fake.calls().length, 2, "no ring while running or idle");

    // A problem report rings like a submit while the loop awaits the review.
    ctx.setStatus("awaiting-review");
    assert.equal((await post(port, `/api/${SLUG}/reviews/${REVIEW}/problem`, { text: "the image is broken" })).status, 200);
    const problem = (await readRecords(ctx, 5)).at(-1);
    assert.deepEqual({ reason: problem.reason, review: problem.review, ring: problem.ring }, { reason: "problem", review: REVIEW, ring: "codex-queue" });
    for (let index = 0; index < 100 && fake.calls().length < 3; index += 1) await sleep(50);
    assert.match(fake.calls()[2][4], /\(problem reports on 2026-10-20-header\)/u);
  } finally {
    serve(ctx, env, "--stop");
    cleanup(ctx);
  }
});

test("a missing codex still answers the submit and records why the ring failed; Claude Code leaves the ring to the waiter", { timeout: 30000 }, async () => {
  const codex = setupProject("bell-serve-nocodex", "codex");
  const claude = setupProject("bell-serve-claude", "claude-code");
  const emptyBin = path.join(codex.root, "empty-bin");
  fs.mkdirSync(emptyBin);
  const env = { ...serveEnv(makeTempRoot("bell-serve-home2"), emptyBin), PATH: `${emptyBin}${path.delimiter}${path.dirname(process.execPath)}` };
  try {
    const { port } = serve(codex, env, "--detach");
    const submit = await post(port, `/api/${SLUG}/reviews/${REVIEW}/submit`, {});
    assert.equal(submit.status, 200);
    const [record] = await readRecords(codex, 1);
    assert.equal(record.ring, "codex-queue");
    assert.equal(record.exitCode, null);
    assert.match(record.error, /codex not found on PATH/u);
    serve(codex, env, "--stop");

    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", claude.root]));
    const claudeServer = serve(claude, env, "--detach");
    const claudeSubmit = await post(claudeServer.port, `/api/${SLUG}/reviews/${REVIEW}/submit`, {});
    assert.equal(JSON.parse(claudeSubmit.text).doorbell, "waiter");
    const [claudeRecord] = await readRecords(claude, 1);
    assert.deepEqual({ platform: claudeRecord.platform, reason: claudeRecord.reason, ring: claudeRecord.ring }, { platform: "claude-code", reason: "submit", ring: "waiter" });
    serve(claude, env, "--stop");
  } finally {
    cleanup(codex, claude);
  }
});

// ---------- doctor ----------

function doctor(ctx, platform, extraEnv = {}) {
  const env = {
    ...process.env,
    CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
    EPIC_LOOP_NO_UPDATE_CHECK: "1",
    EPIC_LOOP_SKILL_DIR: path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop"),
    HOME: ctx.root,
    ...extraEnv,
  };
  delete env.EPIC_LOOP_CLI;
  const result = spawnSync(process.execPath, [cliEntry, "doctor", "--platform", platform, "--json", "--root", ctx.root], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("doctor reports a waiter hook without a timeout and a missing codex", () => {
  const claude = setupProject("bell-doctor-claude", "claude-code");
  const codex = setupProject("bell-doctor-codex", "codex");
  try {
    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", claude.root]));
    const absent = path.join(claude.root, "no-such-cli");
    const ready = doctor(claude, "claude-code", { EPIC_LOOP_CLAUDE_BIN: absent });
    assert.equal(ready.ready, true);
    assert.equal(ready.doorbell.ready, true);
    assert.equal(ready.doorbell.versionStatus, "unknown");
    assert.match(ready.doorbell.note, /headless claude -p driver relies on the UserPromptSubmit fallback/u);

    const settingsPath = path.join(claude.root, ".claude", "settings.json");
    const settings = readJsonFile(settingsPath);
    for (const event of ["Stop", "SessionStart"]) {
      settings.hooks[event] = settings.hooks[event].map((group) => ({
        ...group,
        hooks: group.hooks.map((item) => (item.command.includes("doorbell-waiter.mjs") ? { ...item, timeout: undefined } : item)),
      }));
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
    const broken = doctor(claude, "claude-code", { EPIC_LOOP_CLAUDE_BIN: absent });
    assert.equal(broken.ready, false);
    assert.deepEqual(broken.doorbell.waiter.timeoutMissing, ["Stop", "SessionStart"]);
    assert.ok(broken.warnings.some((warning) => /no explicit timeout; the default 600 s kills it/u.test(warning)));

    const old = path.join(claude.root, "old-claude");
    fs.writeFileSync(old, `#!${process.execPath}\nconsole.log("2.1.100 (Claude Code)");\n`, { mode: 0o755 });
    assert.equal(doctor(claude, "claude-code", { EPIC_LOOP_CLAUDE_BIN: old }).doorbell.versionStatus, "too-old");

    const missing = doctor(codex, "codex", { EPIC_LOOP_CODEX_BIN: absent });
    assert.equal(missing.doorbell.ready, false);
    assert.equal(missing.doorbell.codex.found, false);
    assert.match(missing.doorbell.fix, /Install the Codex CLI \(0\.149\.0 or newer\)/u);
    assert.ok(missing.warnings.some((warning) => /Doorbell not ready/u.test(warning)));

    const fake = path.join(codex.root, "fake-codex");
    fs.writeFileSync(fake, `#!${process.execPath}\nconsole.log(process.argv[2] === "--version" ? "codex-cli 0.162.0" : "Usage: codex queue");\n`, { mode: 0o755 });
    const present = doctor(codex, "codex", { EPIC_LOOP_CODEX_BIN: fake });
    assert.deepEqual(
      { found: present.doorbell.codex.found, queue: present.doorbell.queue.ok, ready: present.doorbell.ready, version: present.doorbell.codex.version },
      { found: true, queue: true, ready: true, version: "0.162.0" },
    );
  } finally {
    cleanup(claude, codex);
  }
});
