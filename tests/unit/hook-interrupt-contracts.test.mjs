import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const TURN_KEY = "prompt-loop";

// Shape captured from a real Claude Code session: the prompt is one bare block, no human text.
const TASK_NOTIFICATION = [
  "<task-notification>",
  "<task-id>ba9rhujkq</task-id>",
  "<tool-use-id>toolu_017QKbcnJ9Fanq6xB784ssrF</tool-use-id>",
  "<output-file>/tmp/claude/tasks/ba9rhujkq.output</output-file>",
  "<status>completed</status>",
  '<summary>Background command "slow check" completed (exit code 0)</summary>',
  "</task-notification>",
].join("\n");

function setupDriverLoop(prefix, { platform = "claude-code", role = "engineer", extra = {} } = {}) {
  const root = makeTempRoot(prefix);
  const slug = "user-prompt";
  const sessionId = "driver-session";
  const transcriptPath = path.join(root, "transcript.jsonl");
  const epicRuntime = path.join(root, ".epic-loop", "epics", slug, ".runtime");

  fs.writeFileSync(transcriptPath, `${JSON.stringify({ type: "assistant", message: { content: "Assistant reply in this turn" } })}\n`, "utf8");
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "User prompt contract project", "--slug", slug, "--no-gitignore"]));
  fs.writeFileSync(path.join(epicRuntime, "current-engineer-prompt.md"), "Add mean(values) to src/stats.mjs.\n", "utf8");
  writeOpenImplementationTurn(root, slug, role, { prompt_file: `.epic-loop/epics/${slug}/.runtime/current-engineer-prompt.md`, turn_key: TURN_KEY, ...extra });
  writeSessionBinding(root, slug, sessionId);

  const hook = (event, fields = {}) => {
    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({ cwd: root, hook_event_name: event, session_id: sessionId, transcript_path: transcriptPath, ...fields }),
    });
    assertSuccess(result);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  const prompt = (text, key = TURN_KEY) => hook("UserPromptSubmit", { prompt: text, prompt_id: key });
  const stop = (key = TURN_KEY) => hook("Stop", { prompt_id: key, stop_hook_active: true });

  return {
    context: (output) => output?.hookSpecificOutput?.additionalContext ?? null,
    epicRuntime,
    hook,
    loop: () => readJsonFile(path.join(epicRuntime, "runtime-state.json")).implementation_loop,
    progress: () => fs.readFileSync(path.join(epicRuntime, "progress-log.jsonl"), "utf8"),
    prompt,
    root,
    sessionId,
    slug,
    stop,
  };
}

test("non-driver UserPromptSubmit does not touch the driver's open turn", () => {
  const ctx = setupDriverLoop("hook-non-driver-");

  try {
    const bindingsPath = path.join(ctx.root, ".epic-loop", ".runtime", "session-bindings.json");
    const bindings = readJsonFile(bindingsPath);
    bindings.sessions["observer-session"] = { active: true, epic_slug: ctx.slug };
    fs.writeFileSync(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`, "utf8");

    const observer = runNodeScript("hook.mjs", ["--root", ctx.root], {
      input: JSON.stringify({ cwd: ctx.root, hook_event_name: "UserPromptSubmit", prompt: "stop loop mode", session_id: "observer-session" }),
    });
    assertSuccess(observer);
    assert.match(JSON.parse(observer.stdout).hookSpecificOutput.additionalContext, /loop running in another session; read-only/u);
    assert.equal(ctx.loop().status, "running");
    assert.equal(ctx.loop().active_turn_stopped_at, undefined);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("background task notifications are ignored and the role report still lands", () => {
  const ctx = setupDriverLoop("hook-task-notification-");

  try {
    for (const prompt of [TASK_NOTIFICATION, `${TASK_NOTIFICATION}\n${TASK_NOTIFICATION}`, `<system-reminder>\nrefresh\n</system-reminder>\n${TASK_NOTIFICATION}`]) {
      assert.equal(ctx.prompt(prompt), null);
    }
    assert.equal(ctx.loop().status, "running");
    assert.equal(ctx.loop().active_turn_stopped_at, undefined);
    assert.match(ctx.progress(), /"action":"synthetic-prompt-ignored"/u);

    const continuation = ctx.stop();
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /techlead/iu);
    assert.match(fs.readFileSync(path.join(ctx.epicRuntime, "latest-engineer-report.md"), "utf8"), /Assistant reply in this turn/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("a user message inside the running turn is answered without stopping the loop", () => {
  const ctx = setupDriverLoop("hook-user-steer-");

  try {
    const steer = ctx.prompt(`${TASK_NOTIFICATION}\nquick question: which file are you editing?`);
    assert.match(
      ctx.context(steer),
      /the user wrote during the engineer turn\. Answer briefly, then finish the engineer turn: your final message must still be the complete engineer report/u,
    );
    assert.match(ctx.context(steer), /stop-loop\.mjs --slug user-prompt/u);
    assert.equal(ctx.loop().status, "running");
    assert.equal(ctx.loop().active_turn_stopped_at, undefined);
    assert.match(ctx.progress(), /"action":"user-message-in-turn"/u);

    const continuation = ctx.stop();
    assert.equal(continuation.decision, "block");
    assert.equal(ctx.loop().current_role, "techlead");
    assert.ok(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")));
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("a user message after an aborted turn is answered, then the same role resumes", () => {
  const ctx = setupDriverLoop("hook-user-abort-");

  try {
    const answer = ctx.prompt("what is going on?", "prompt-after-esc");
    assert.match(ctx.context(answer), /the user interrupted the engineer turn\. Answer the user's message; when you finish, the loop resumes the engineer turn/u);
    let loop = ctx.loop();
    assert.equal(loop.status, "running");
    assert.equal(loop.next_role, "engineer");
    assert.equal(loop.resume_after_user_turn, true);
    assert.match(ctx.progress(), /"action":"turn-aborted"/u);

    const continuation = ctx.stop("prompt-after-esc");
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /^Resuming the engineer turn that the user interrupted\./u);
    assert.match(continuation.reason, /Add mean\(values\) to src\/stats\.mjs\./u);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);
    loop = ctx.loop();
    assert.equal(loop.current_role, "engineer");
    assert.equal(loop.resume_after_user_turn, false);
    assert.equal(loop.turn_key, "prompt-after-esc");

    assert.match(ctx.context(ctx.prompt("and now?", "prompt-after-esc")), /the user wrote during the engineer turn/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("an aborted turn is closed in the progress artifacts", () => {
  const ctx = setupDriverLoop("hook-user-abort-progress-");

  try {
    const progressPath = path.join(ctx.epicRuntime, "progress-log.jsonl");
    const turnStart = { action: "turn-start", iteration: 2, role: "engineer", slug: ctx.slug, timestamp: "2026-07-01T00:00:00+00:00" };
    fs.appendFileSync(progressPath, `${JSON.stringify(turnStart)}\n`, "utf8");

    ctx.prompt("what is going on?", "prompt-after-esc");
    const aborted = ctx
      .progress()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((event) => event.action === "turn-aborted");
    assert.equal(typeof aborted.timestamp, "string");
    assert.equal(aborted.timestamp, aborted.ended_at);

    assertSuccess(runNodeScript("rebuild-progress.mjs", ["--root", ctx.root, "--slug", ctx.slug]));
    const report = fs.readFileSync(path.join(ctx.epicRuntime, "progress-report.md"), "utf8");
    assert.match(report, /- Aborted turns: 1/u);
    assert.match(report, /## Open Turns\n\n- No open turns\./u);
    const markdown = fs.readFileSync(path.join(ctx.epicRuntime, "progress-log.md"), "utf8");
    assert.ok(markdown.includes(`## ${aborted.timestamp} | turn-aborted`));
    assert.match(markdown, /Turn 2 was aborted by the user after/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("an unknown turn identity is treated as an aborted turn", () => {
  const ctx = setupDriverLoop("hook-user-unknown-turn-", { extra: { turn_key: null } });

  try {
    assert.match(ctx.context(ctx.hook("UserPromptSubmit", { prompt: "status?" })), /the user interrupted the engineer turn/u);
    assert.equal(ctx.loop().resume_after_user_turn, true);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("stop loop mode stops the loop deterministically and the agent is told how to resume", () => {
  const ctx = setupDriverLoop("hook-user-stop-command-");

  try {
    assert.match(ctx.context(ctx.prompt("Stop loop mode.")), /the user stopped the loop\. Do not continue any loop role/u);
    let loop = ctx.loop();
    assert.equal(loop.status, "interrupted");
    assert.equal(loop.next_role, "idle");
    assert.equal(loop.last_reason, "user-stop-command");
    assert.match(ctx.progress(), /"action":"loop-stopped"/u);

    assert.equal(ctx.stop(), null);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);
    assert.match(
      ctx.context(ctx.prompt("hello again")),
      /loop stopped\. If the user asks to resume it, run: node .*bind-session\.mjs --current --slug user-prompt --mode implementation/u,
    );

    assertSuccess(runNodeScript("bind-session.mjs", ["--root", ctx.root, "--session-id", ctx.sessionId, "--slug", ctx.slug, "--mode", "implementation"]));
    loop = ctx.loop();
    assert.equal(loop.status, "running");
    assert.equal(loop.next_role, "manager");
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("stop-loop.mjs stops a running loop from inside a turn", () => {
  const ctx = setupDriverLoop("hook-stop-script-");

  try {
    const stopped = runNodeScript("stop-loop.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(stopped);
    assert.match(stopped.stdout, /Stopped the implementation loop for user-prompt\. Resume with: node .*bind-session\.mjs/u);
    assert.equal(ctx.loop().status, "interrupted");
    assert.equal(ctx.loop().last_reason, "user-requested-stop");
    assert.equal(ctx.stop(), null);

    const again = runNodeScript("stop-loop.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(again);
    assert.match(again.stdout, /Implementation loop for user-prompt is not running\./u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("Codex routes steer and aborted turns by turn_id the same way", () => {
  const ctx = setupDriverLoop("hook-codex-user-prompt-", { platform: "codex" });

  try {
    assert.match(ctx.context(ctx.hook("UserPromptSubmit", { prompt: "quick question", turn_id: TURN_KEY })), /the user wrote during the engineer turn/u);
    assert.equal(ctx.loop().active_turn_stopped_at, undefined);

    assert.match(ctx.context(ctx.hook("UserPromptSubmit", { prompt: "what happened?", turn_id: "turn-after-esc" })), /the user interrupted the engineer turn/u);
    const continuation = ctx.hook("Stop", { last_assistant_message: "Answered the user.", stop_hook_active: false, turn_id: "turn-after-esc" });
    assert.match(continuation.reason, /^Resuming the engineer turn that the user interrupted\./u);
    assert.equal(ctx.loop().turn_key, "turn-after-esc");
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});
