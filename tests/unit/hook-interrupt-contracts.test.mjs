import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { STOP_REPORT_FIXTURE, assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

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
  // The techlead chose this engineer turn before it started; that is not a decision made inside it.
  const ctx = setupDriverLoop("hook-user-abort-", { extra: { last_transition_at: "2026-07-01T00:00:00+00:00", last_transition_by: "set-next-role" } });

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

test("an aborted techlead turn keeps the next role it already chose", () => {
  const ctx = setupDriverLoop("hook-user-abort-techlead-", { extra: { next_role: "awaiting-transition" }, role: "techlead" });

  try {
    const promptFile = `.epic-loop/epics/${ctx.slug}/.runtime/current-engineer-prompt.md`;
    assertSuccess(runNodeScript("set-next-role.mjs", ["--root", ctx.root, "--slug", ctx.slug, "--role", "engineer", "--prompt-file", promptFile]));

    const answer = ctx.prompt("what were you doing?", "prompt-after-esc");
    assert.match(
      ctx.context(answer),
      /the user interrupted the techlead turn\. Answer the user's message; when you finish, the loop continues with the engineer turn the techlead already chose/u,
    );
    let loop = ctx.loop();
    assert.equal(loop.next_role, "engineer");
    assert.equal(loop.prompt_file, promptFile);
    assert.equal(loop.resume_after_user_turn, false);
    assert.match(ctx.progress(), /"action":"turn-aborted"[^\n]*"next_role":"engineer"/u);

    const continuation = ctx.stop("prompt-after-esc");
    assert.equal(continuation.decision, "block");
    assert.doesNotMatch(continuation.reason, /Resuming/u);
    assert.match(continuation.reason, /Add mean\(values\) to src\/stats\.mjs\./u);
    loop = ctx.loop();
    assert.equal(loop.current_role, "engineer");
    assert.equal(loop.next_role, "techlead");
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
    // Esc fires nothing, so when the role stopped working is unknown; the time until the user wrote is not active time.
    assert.equal(aborted.duration_ms, null);

    assertSuccess(runNodeScript("rebuild-progress.mjs", ["--root", ctx.root, "--slug", ctx.slug]));
    const report = fs.readFileSync(path.join(ctx.epicRuntime, "progress-report.md"), "utf8");
    assert.match(report, /- Aborted turns: 1/u);
    assert.match(report, /- Turn 2 \| engineer \| .* \| unknown\n/u);
    assert.match(report, /## Open Turns\n\n- No open turns\./u);
    const markdown = fs.readFileSync(path.join(ctx.epicRuntime, "progress-log.md"), "utf8");
    assert.ok(markdown.includes(`## ${aborted.timestamp} | turn-aborted`));
    assert.match(markdown, /Turn 2 was aborted by the user; its active time is unknown\./u);
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
    assert.match(
      ctx.context(ctx.prompt("Stop loop mode.")),
      /the user stopped the loop\. Do not continue any loop role\. End this turn with your engineer report of the stopped turn/u,
    );
    let loop = ctx.loop();
    assert.equal(loop.status, "interrupted");
    assert.equal(loop.next_role, "idle");
    assert.equal(loop.last_reason, "user-stop-command");
    assert.match(ctx.progress(), /"action":"loop-stopped"/u);

    // The final message of the stopped turn is its report; the loop stays stopped.
    assert.equal(ctx.stop(), null);
    assert.match(fs.readFileSync(path.join(ctx.epicRuntime, "latest-engineer-report.md"), "utf8"), /Assistant reply in this turn/u);
    assert.match(ctx.progress(), /"action":"stopped-turn-report"[^\n]*"recorded":true/u);
    assert.equal(ctx.loop().stop_report_iteration, null);
    assert.equal(ctx.loop().status, "interrupted");
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
    assert.match(
      stopped.stdout,
      /Stopped the implementation loop for user-prompt\. End this turn with your engineer report of the stopped turn.* Resume with: node .*bind-session\.mjs/u,
    );
    assert.equal(ctx.loop().status, "interrupted");
    assert.equal(ctx.loop().last_reason, "user-requested-stop");
    // The script cannot see the session id; the events name the driver session.
    for (const action of ["turn-interrupted", "loop-stopped"]) {
      assert.match(ctx.progress(), new RegExp(`"action":"${action}"[^\\n]*"session_id":"${ctx.sessionId}"`, "u"));
    }

    assert.equal(ctx.stop(), null);
    assert.match(fs.readFileSync(path.join(ctx.epicRuntime, "latest-engineer-report.md"), "utf8"), /Assistant reply in this turn/u);
    // Only the first Stop after the stop carries the report.
    fs.rmSync(path.join(ctx.epicRuntime, "latest-engineer-report.md"));
    assert.equal(ctx.stop(), null);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);

    const again = runNodeScript("stop-loop.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(again);
    assert.match(again.stdout, /Implementation loop for user-prompt is not running\./u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("stopping a techlead turn asks for no report and records none", () => {
  const ctx = setupDriverLoop("hook-stop-techlead-", { role: "techlead" });

  try {
    const stopped = runNodeScript("stop-loop.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(stopped);
    assert.doesNotMatch(stopped.stdout, /report/u);
    assert.equal(ctx.loop().stop_report_iteration, undefined);

    assert.equal(ctx.stop(), null);
    assert.doesNotMatch(ctx.progress(), /stopped-turn-report/u);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);
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

const runningTask = (id) => ({ command: "node scripts/slow-check.mjs", description: "slow check", id, status: "running", type: "shell" });
const waitingStop = (ids, key = TURN_KEY) => ({ background_tasks: ids.map(runningTask), prompt_id: key, stop_hook_active: true });

test("a role that ends its turn to wait for its background task is picked up when the task finishes", () => {
  const ctx = setupDriverLoop("hook-background-wait-");
  const reportPath = path.join(ctx.epicRuntime, "latest-engineer-report.md");

  try {
    assert.equal(ctx.hook("Stop", waitingStop(["bg-check"])), null);
    let loop = ctx.loop();
    assert.equal(loop.active_turn_stopped_at, undefined);
    assert.equal(loop.background_wait_iteration, 2);
    assert.deepEqual(loop.background_wait_task_ids, ["bg-check"]);
    assert.equal(fs.existsSync(reportPath), false);
    assert.match(ctx.progress(), /"action":"turn-waiting-background"[^\n]*"background_task_ids":\["bg-check"\]/u);

    const woken = ctx.prompt(TASK_NOTIFICATION, "prompt-woken");
    assert.match(ctx.context(woken), /background work finished while the engineer turn was waiting\. Continue the engineer turn/u);
    assert.match(ctx.context(woken), /your final message must be the complete engineer report/u);
    loop = ctx.loop();
    assert.equal(loop.turn_key, "prompt-woken");
    assert.equal(loop.background_wait_iteration, null);
    assert.equal(loop.active_turn_stopped_at, undefined);
    assert.match(ctx.progress(), /"action":"synthetic-prompt-ignored"[^\n]*"turn_key_adopted":true/u);

    assert.match(ctx.context(ctx.prompt("quick question", "prompt-woken")), /the user wrote during the engineer turn/u);

    const continuation = ctx.hook("Stop", { background_tasks: [], prompt_id: "prompt-woken", stop_hook_active: false });
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /techlead/iu);
    assert.ok(fs.existsSync(reportPath));
    assert.equal(ctx.loop().current_role, "techlead");
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("the loop keeps waiting while the role's own background tasks run, and only for tasks the role started", () => {
  const ctx = setupDriverLoop("hook-background-wait-again-");
  const preexisting = setupDriverLoop("hook-background-wait-baseline-", { extra: { background_task_baseline: ["dev-server"] } });

  try {
    // Two checks of different length: the first notification wakes the role, which ends again to wait for the second.
    assert.equal(ctx.hook("Stop", waitingStop(["bg-a", "bg-b"])), null);
    assert.match(ctx.context(ctx.prompt(TASK_NOTIFICATION, "prompt-a")), /Continue the engineer turn/u);
    assert.equal(ctx.hook("Stop", waitingStop(["bg-b"], "prompt-a")), null);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);
    assert.match(ctx.context(ctx.prompt(TASK_NOTIFICATION, "prompt-b")), /Continue the engineer turn/u);
    const continuation = ctx.hook("Stop", { background_tasks: [], prompt_id: "prompt-b", stop_hook_active: false });
    assert.equal(continuation.decision, "block");
    assert.equal(ctx.loop().current_role, "techlead");
    assert.equal(ctx.progress().match(/"action":"turn-waiting-background"/gu).length, 2);

    // A dev server left by an earlier role is in the baseline and never makes this role wait.
    const devServer = preexisting.hook("Stop", waitingStop(["dev-server"]));
    assert.equal(devServer.decision, "block");
    assert.doesNotMatch(preexisting.progress(), /turn-waiting-background/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
    fs.rmSync(preexisting.root, { force: true, recursive: true });
  }
});

test("a role that leaves a background process running completes its turn explicitly", () => {
  const ctx = setupDriverLoop("hook-complete-turn-");

  try {
    const completed = runNodeScript("complete-turn.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(completed);
    assert.match(completed.stdout, /Marked engineer turn 2 of user-prompt complete/u);
    assert.equal(ctx.loop().turn_completed_iteration, 2);
    assert.match(ctx.progress(), /"action":"role-command","command":"complete-turn"/u);

    const continuation = ctx.hook("Stop", waitingStop(["dev-server"]));
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /techlead/iu);
    assert.match(fs.readFileSync(path.join(ctx.epicRuntime, "latest-engineer-report.md"), "utf8"), /Assistant reply in this turn/u);
    assert.doesNotMatch(ctx.progress(), /turn-waiting-background/u);

    // The techlead's request-stop completes its turn the same way, and so does the manager's
    // review-stop: neither turn waits for the late background task.
    assertSuccess(runNodeScript("request-stop.mjs", ["--root", ctx.root, "--slug", ctx.slug, "--class", "A", "--reason", "epic done", "--blocks", "nothing"]));
    assert.equal(ctx.loop().next_role_set_iteration, 3);
    assert.equal(ctx.hook("Stop", waitingStop(["dev-server", "bg-late"])).decision, "block");
    assert.equal(ctx.loop().current_role, "manager");

    assertSuccess(runNodeScript("review-stop.mjs", ["--root", ctx.root, "--slug", ctx.slug, "--outcome", "accepted", "--stdin"], { input: STOP_REPORT_FIXTURE }));
    assert.equal(ctx.loop().next_role_set_iteration, 4);

    const noTurn = runNodeScript("complete-turn.mjs", ["--root", ctx.root, "--slug", ctx.slug]);
    assertSuccess(noTurn);
    assert.equal(ctx.hook("Stop", waitingStop(["dev-server", "bg-late", "bg-later"])), null);
    assert.match(runNodeScript("complete-turn.mjs", ["--root", ctx.root, "--slug", ctx.slug]).stdout, /No open implementation turn for user-prompt\./u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("a user message while the role waits for its background work continues the turn instead of aborting it", () => {
  const ctx = setupDriverLoop("hook-background-wait-user-");

  try {
    assert.equal(ctx.hook("Stop", waitingStop(["bg-check"])), null);

    const answer = ctx.prompt("how is it going?", "prompt-user");
    assert.match(ctx.context(answer), /the user wrote while the engineer turn was waiting for its background work\. Answer briefly, then continue the engineer turn/u);
    assert.match(ctx.context(answer), /stop-loop\.mjs --slug user-prompt/u);
    let loop = ctx.loop();
    assert.equal(loop.active_turn_stopped_at, undefined);
    assert.equal(loop.resume_after_user_turn, undefined);
    assert.equal(loop.turn_key, "prompt-user");
    assert.equal(loop.background_wait_iteration, null);
    assert.match(ctx.progress(), /"action":"user-message-while-waiting"/u);
    assert.doesNotMatch(ctx.progress(), /turn-aborted/u);

    // The agent answers and ends the turn again while its check still runs: the loop keeps waiting.
    assert.equal(ctx.hook("Stop", waitingStop(["bg-check"], "prompt-user")), null);
    assert.equal(ctx.loop().iteration, 2);
    assert.equal(fs.existsSync(path.join(ctx.epicRuntime, "latest-engineer-report.md")), false);

    // A notification under the same host turn still wakes the waiting role with guidance.
    assert.match(ctx.context(ctx.prompt(TASK_NOTIFICATION, "prompt-user")), /background work finished while the engineer turn was waiting/u);
    const continuation = ctx.hook("Stop", { background_tasks: [], prompt_id: "prompt-user", stop_hook_active: false });
    assert.equal(continuation.decision, "block");
    loop = ctx.loop();
    assert.equal(loop.current_role, "techlead");
    assert.equal(loop.iteration, 3);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("a resumed role keeps the background baseline of the turn the user aborted", () => {
  const ctx = setupDriverLoop("hook-background-resume-baseline-", { extra: { background_task_baseline: ["dev-server"] } });

  try {
    assert.match(ctx.context(ctx.prompt("what is going on?", "prompt-after-esc")), /the user interrupted the engineer turn/u);
    const resumed = ctx.hook("Stop", { background_tasks: [runningTask("dev-server"), runningTask("bg-check")], prompt_id: "prompt-after-esc", stop_hook_active: false });
    assert.match(resumed.reason, /^Resuming the engineer turn that the user interrupted\./u);
    assert.deepEqual(ctx.loop().background_task_baseline, ["dev-server"]);

    // The check the engineer started before Esc is still its own work, so the resumed turn waits for it.
    assert.equal(ctx.hook("Stop", waitingStop(["dev-server", "bg-check"], "prompt-after-esc")), null);
    assert.match(ctx.progress(), /"action":"turn-waiting-background"[^\n]*"background_task_ids":\["bg-check"\]/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("set-next-role inside the turn counts even in the second the turn started", () => {
  // A start stamp in the future stands in for "the same second": no timestamp comparison can see the command.
  const ctx = setupDriverLoop("hook-user-abort-same-second-", {
    extra: { active_turn_started_at: "2099-01-01T00:00:00+00:00", next_role: "awaiting-transition" },
    role: "techlead",
  });

  try {
    const promptFile = `.epic-loop/epics/${ctx.slug}/.runtime/current-engineer-prompt.md`;
    assertSuccess(runNodeScript("set-next-role.mjs", ["--root", ctx.root, "--slug", ctx.slug, "--role", "engineer", "--prompt-file", promptFile]));

    assert.match(ctx.context(ctx.prompt("what were you doing?", "prompt-after-esc")), /the loop continues with the engineer turn the techlead already chose/u);
    assert.equal(ctx.loop().next_role, "engineer");
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("time spent waiting for background work is not counted as active turn time", () => {
  // The engineer turn started at 00:00 and ended its host turn to wait at 00:10.
  const ctx = setupDriverLoop("hook-background-wait-duration-", {
    extra: { background_wait_iteration: 2, background_wait_started_at: "2026-07-01T00:10:00+00:00", background_wait_task_ids: ["bg-check"] },
  });

  try {
    ctx.prompt(TASK_NOTIFICATION, "prompt-woken");
    assert.ok(ctx.loop().background_wait_ms > 0);
    assert.equal(ctx.hook("Stop", { background_tasks: [], prompt_id: "prompt-woken", stop_hook_active: false }).decision, "block");

    const stopped = ctx
      .progress()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((event) => event.action === "turn-stop");
    assert.ok(stopped.duration_ms >= 600000 && stopped.duration_ms < 605000, `duration_ms ${stopped.duration_ms}`);
    assert.ok(stopped.background_wait_ms > 0);
    assert.equal(ctx.loop().background_wait_ms, 0);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("a user message after a techlead turn that chose no next role does not promise that the loop continues", () => {
  const ctx = setupDriverLoop("hook-user-awaiting-transition-", {
    extra: { active_turn_stopped_at: "2026-07-01T00:05:00+00:00", next_role: "awaiting-transition" },
    role: "techlead",
  });

  try {
    const context = ctx.context(ctx.prompt("what's next?", "prompt-later"));
    assert.match(context, /the last techlead turn ended without choosing the next role, so nothing runs after this reply/u);
    assert.match(context, /set-next-role\.mjs --slug user-prompt/u);
    assert.doesNotMatch(context, /the loop continues after this reply/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});
