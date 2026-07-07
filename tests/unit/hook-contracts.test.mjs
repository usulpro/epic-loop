import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

function writeSessionBinding(root, slug, sessionId) {
  fs.mkdirSync(path.join(root, ".epic-loop", ".runtime"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".epic-loop", ".runtime", "session-bindings.json"),
    `${JSON.stringify(
      {
        sessions: {
          [sessionId]: {
            active: true,
            epic_slug: slug,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
  const runtime = readJsonFile(runtimePath);
  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify(
      {
        ...runtime,
        implementation_loop: {
          ...runtime.implementation_loop,
          driver_session_id: sessionId,
        },
        mode: "implementation",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function writeOpenImplementationTurn(root, slug, role = "engineer") {
  const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
  const runtime = readJsonFile(runtimePath);
  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify(
      {
        ...runtime,
        implementation_loop: {
          active_turn_started_at: "2026-07-01T00:00:00+00:00",
          current_role: role,
          driver_session_id: runtime.implementation_loop?.driver_session_id ?? null,
          iteration: 2,
          next_role: "techlead",
          status: "running",
        },
        mode: "implementation",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

test("hook CLI captures unbound sessions without writing epic-loop runtime records", () => {
  const root = makeTempRoot("hook-unbound-");
  const transcriptPath = path.join(root, "transcript.jsonl");
  const payload = {
    cwd: root,
    hook_event_name: "Stop",
    prompt: "sensitive prompt text",
    session_id: "session-unbound",
    transcript_path: transcriptPath,
    turn_id: "turn-1",
  };

  try {
    fs.writeFileSync(transcriptPath, '{"type":"assistant","message":{"content":"ready"}}\n', "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify(payload),
    });

    assertSuccess(result);
    assert.equal(result.stdout, "");
    const capture = readJsonFile(path.join(root, ".codex", "tmp", "last-hook-capture.json"));
    assert.deepEqual(capture.handshake, {
      cwd: root,
      hook_event_name: "Stop",
      session_id: "session-unbound",
      turn_id: "turn-1",
    });
    assert.equal(capture.payload, undefined);
    assert.equal(JSON.stringify(capture).includes("sensitive prompt text"), false);
    assert.equal(JSON.stringify(capture).includes(transcriptPath), false);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "hook-events")), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("hook CLI builds a deterministic bound Stop continuation", () => {
  const root = makeTempRoot("hook-bound-");
  const slug = "bound-routing";
  const sessionId = "session-bound";

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bound routing project", "--no-gitignore"]));

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(
      runtimePath,
      `${JSON.stringify(
        {
          ...runtime,
          implementation_loop: {
            current_role: null,
            iteration: 0,
            next_role: "manager",
            status: "running",
          },
          mode: "implementation",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: sessionId,
        stop_hook_active: true,
        turn_id: "turn-bound",
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /manager housekeeping turn 1/u);

    const nextRuntime = readJsonFile(runtimePath);
    assert.equal(nextRuntime.implementation_loop.current_role, "manager");
    assert.equal(nextRuntime.implementation_loop.next_role, "techlead");
    assert.equal(nextRuntime.implementation_loop.iteration, 1);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "last-hook-event.json")), true);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "sessions", sessionId, "last-hook-event.json")), true);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bound Stop continuation only runs for the implementation driver", () => {
  const root = makeTempRoot("hook-driver-stop-");
  const slug = "driver-routing";
  const driverSessionId = "session-driver";
  const observerSessionId = "session-observer";

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Driver routing project", "--slug", slug, "--no-gitignore"]));

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(
      runtimePath,
      `${JSON.stringify(
        {
          ...runtime,
          implementation_loop: {
            current_role: null,
            iteration: 0,
            next_role: "manager",
            status: "running",
          },
          mode: "implementation",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    writeSessionBinding(root, slug, driverSessionId);
    const bindingsPath = path.join(root, ".epic-loop", ".runtime", "session-bindings.json");
    const bindings = readJsonFile(bindingsPath);
    bindings.sessions[observerSessionId] = {
      active: true,
      epic_slug: slug,
    };
    fs.writeFileSync(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`, "utf8");

    const observerStop = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: observerSessionId,
        stop_hook_active: true,
        turn_id: "observer-turn",
      }),
    });
    assertSuccess(observerStop);
    assert.equal(observerStop.stdout, "");
    assert.equal(readJsonFile(runtimePath).implementation_loop.current_role, null);

    const driverStop = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: driverSessionId,
        stop_hook_active: true,
        turn_id: "driver-turn",
      }),
    });
    assertSuccess(driverStop);
    assert.match(JSON.parse(driverStop.stdout).reason, /manager housekeeping turn 1/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("non-driver UserPromptSubmit does not interrupt an open implementation turn", () => {
  const root = makeTempRoot("hook-driver-interrupt-");
  const slug = "driver-interrupt";
  const driverSessionId = "session-driver";
  const observerSessionId = "session-observer";

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Driver interrupt project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug, "engineer");
    writeSessionBinding(root, slug, driverSessionId);

    const bindingsPath = path.join(root, ".epic-loop", ".runtime", "session-bindings.json");
    const bindings = readJsonFile(bindingsPath);
    bindings.sessions[observerSessionId] = {
      active: true,
      epic_slug: slug,
    };
    fs.writeFileSync(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`, "utf8");

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const observerPrompt = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "UserPromptSubmit",
        session_id: observerSessionId,
        turn_id: "observer-prompt",
      }),
    });
    assertSuccess(observerPrompt);
    assert.equal(
      JSON.parse(observerPrompt.stdout).hookSpecificOutput.additionalContext,
      `[epic-loop] epic=${slug} mode=implementation — loop running in another session; read-only, do not edit epic artifacts`,
    );
    let runtime = readJsonFile(runtimePath);
    assert.equal(runtime.implementation_loop.status, "running");
    assert.equal(runtime.implementation_loop.active_turn_stopped_at, undefined);

    const driverPrompt = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "UserPromptSubmit",
        session_id: driverSessionId,
        turn_id: "driver-prompt",
      }),
    });
    assertSuccess(driverPrompt);
    assert.equal(driverPrompt.stdout, "");
    runtime = readJsonFile(runtimePath);
    assert.equal(runtime.implementation_loop.status, "interrupted");
    assert.equal(runtime.implementation_loop.last_interrupt_session_id, driverSessionId);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code unbound hook payload records only a minimal current-session handshake", () => {
  const root = makeTempRoot("hook-claude-unbound-");
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, '{"type":"assistant","message":{"content":"done"}}\n', "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        prompt: "sensitive claude prompt",
        session_id: "claude-session-unbound",
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".codex", "tmp", "last-hook-capture.json")), false);
    const capture = readJsonFile(path.join(root, ".epic-loop", ".runtime", "claude-code-last-hook-capture.json"));
    assert.deepEqual(capture.handshake, {
      cwd: root,
      hook_event_name: "Stop",
      session_id: "claude-session-unbound",
      turn_id: null,
    });
    assert.equal(capture.payload, undefined);
    assert.equal(JSON.stringify(capture).includes("sensitive claude prompt"), false);
    assert.equal(JSON.stringify(capture).includes(transcriptPath), false);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "hook-events")), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code synthetic implementation flow binds current capture and routes manager techlead engineer turns", () => {
  const root = makeTempRoot("hook-claude-e2e-");
  const slug = "claude-e2e";
  const sessionId = "claude-e2e-session";
  const transcriptPath = path.join(root, "transcript.jsonl");
  const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");

  function writeTranscript(message) {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: message })}\n`, "utf8");
  }

  function runClaudeHook(hook_event_name, extra = {}) {
    return runNodeScript("hook.mjs", ["--root", root], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
      input: JSON.stringify({
        cwd: root,
        hook_event_name,
        session_id: sessionId,
        stop_hook_active: false,
        transcript_path: transcriptPath,
        ...extra,
      }),
    });
  }

  try {
    writeTranscript("session capture ready");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude e2e project", "--slug", slug, "--no-gitignore"]));

    const capture = runClaudeHook("SessionStart");
    assertSuccess(capture);
    assert.equal(capture.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "hook-events")), false);

    const bind = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", slug, "--mode", "implementation"]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Active implementation session for claude-e2e: claude-e2e-session/u);
    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions[sessionId].source, "current-claude-code-session");

    const boundSessionStart = runClaudeHook("SessionStart");
    assertSuccess(boundSessionStart);
    assert.equal(boundSessionStart.stdout, "");

    const boundPromptSubmit = runClaudeHook("UserPromptSubmit", {
      prompt: "Continue the synthetic implementation loop.",
    });
    assertSuccess(boundPromptSubmit);
    assert.equal(boundPromptSubmit.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "hook-events")), true);

    writeTranscript("manager housekeeping finished");
    const managerStop = runClaudeHook("Stop");
    assertSuccess(managerStop);
    const managerContinuation = JSON.parse(managerStop.stdout);
    assert.equal(managerContinuation.decision, "block");
    assert.match(managerContinuation.reason, /manager housekeeping turn 1/u);
    assert.doesNotMatch(managerContinuation.reason, /continue loop mode/u);
    const managerRuntime = readJsonFile(runtimePath);
    assert.equal(managerRuntime.implementation_loop.current_role, "manager");
    assert.equal(managerRuntime.implementation_loop.next_role, "techlead");
    assert.equal(managerRuntime.implementation_loop.iteration, 1);

    writeTranscript("Manager report from transcript");
    const techleadStop = runClaudeHook("Stop");
    assertSuccess(techleadStop);
    const techleadContinuation = JSON.parse(techleadStop.stdout);
    assert.equal(techleadContinuation.decision, "block");
    assert.match(techleadContinuation.reason, /techlead turn 2/u);
    assert.match(fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-manager-report.md"), "utf8"), /Manager report from transcript/u);
    const techleadRuntime = readJsonFile(runtimePath);
    assert.equal(techleadRuntime.implementation_loop.current_role, "techlead");
    assert.equal(techleadRuntime.implementation_loop.next_role, "awaiting-transition");
    assert.equal(techleadRuntime.implementation_loop.iteration, 2);

    const brief = runNodeScript("write-engineer-brief.mjs", ["--root", root, "--slug", slug, "--stdin"], {
      input: "Verify the synthetic Claude Code implementation route.\n",
    });
    assertSuccess(brief);
    const setEngineer = runNodeScript("set-next-role.mjs", [
      "--root",
      root,
      "--slug",
      slug,
      "--role",
      "engineer",
      "--prompt-file",
      ".epic-loop/epics/claude-e2e/.runtime/current-engineer-prompt.md",
      "--reason",
      "unit-test-engineer-route",
    ]);
    assertSuccess(setEngineer);

    writeTranscript("Techlead handoff complete");
    const engineerStop = runClaudeHook("Stop");
    assertSuccess(engineerStop);
    const engineerContinuation = JSON.parse(engineerStop.stdout);
    assert.equal(engineerContinuation.decision, "block");
    assert.match(engineerContinuation.reason, /Focused implementation task 3/u);
    assert.match(engineerContinuation.reason, /Verify the synthetic Claude Code implementation route/u);
    const engineerRuntime = readJsonFile(runtimePath);
    assert.equal(engineerRuntime.implementation_loop.current_role, "engineer");
    assert.equal(engineerRuntime.implementation_loop.next_role, "techlead");
    assert.equal(engineerRuntime.implementation_loop.iteration, 3);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Codex bound Stop captures last_assistant_message reports", () => {
  const root = makeTempRoot("hook-codex-report-");
  const slug = "codex-report";
  const sessionId = "codex-report-session";

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Codex report project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug);
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        last_assistant_message: "Codex engineer report",
        session_id: sessionId,
        stop_hook_active: false,
        turn_id: "codex-report-turn",
      }),
    });

    assertSuccess(result);
    assert.equal(JSON.parse(result.stdout).decision, "block");
    const latestReportPath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-engineer-report.md");
    assert.match(fs.readFileSync(latestReportPath, "utf8"), /Codex engineer report/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code bound Stop captures latest assistant transcript report", () => {
  const root = makeTempRoot("hook-claude-report-");
  const slug = "claude-report";
  const sessionId = "claude-report-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(
      transcriptPath,
      [
        JSON.stringify({ role: "user", content: "ignored user text" }),
        JSON.stringify({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Older assistant report" }],
          },
        }),
        "{malformed-json",
        JSON.stringify({ type: "assistant", message: { content: "Middle assistant report" } }),
        JSON.stringify({
          role: "assistant",
          content: [{ text: "Latest assistant" }, { type: "text", text: "report" }],
        }),
        "",
      ].join("\n"),
      "utf8",
    );
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude report project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug, "manager");
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: sessionId,
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    assert.equal(JSON.parse(result.stdout).decision, "block");
    const latestReportPath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-manager-report.md");
    const report = fs.readFileSync(latestReportPath, "utf8");
    assert.match(report, /Latest assistant\nreport/u);
    assert.doesNotMatch(report, /Older assistant report/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code bound Stop prefers real payload assistant report over stale transcript", () => {
  const root = makeTempRoot("hook-claude-payload-report-");
  const slug = "payload-report";
  const sessionId = "claude-payload-report-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "stale transcript report" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude payload report project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug, "manager");
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        last_assistant_message: "current payload manager report",
        session_id: sessionId,
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    assert.equal(JSON.parse(result.stdout).decision, "block");
    const report = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-manager-report.md"), "utf8");
    assert.match(report, /current payload manager report/u);
    assert.doesNotMatch(report, /stale transcript report/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code bound engineer Stop uses explicit hook root when payload cwd is not usable", () => {
  const root = makeTempRoot("hook-claude-explicit-root-");
  const slug = "explicit-root";
  const sessionId = "claude-explicit-root-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "stale transcript report" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude explicit root project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug, "engineer");
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: path.join(root, "not-the-project-root"),
        hook_event_name: "Stop",
        last_assistant_message: "actual engineer report from payload",
        session_id: sessionId,
        stop_hook_active: true,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /techlead turn 3/u);

    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.implementation_loop.last_engineer_report_path, ".epic-loop/epics/explicit-root/.runtime/latest-engineer-report.md");
    assert.equal(runtime.implementation_loop.next_role, "awaiting-transition");

    const report = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-engineer-report.md"), "utf8");
    assert.match(report, /actual engineer report from payload/u);
    assert.doesNotMatch(report, /stale transcript report/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code bound Stop records uncapped block cap metadata", () => {
  const root = makeTempRoot("hook-claude-cap-zero-");
  const slug = "cap-zero";
  const sessionId = "claude-cap-zero-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "manager ready" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude cap zero project", "--slug", slug, "--no-gitignore"]));

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(
      runtimePath,
      `${JSON.stringify(
        {
          ...runtime,
          implementation_loop: {
            current_role: null,
            iteration: 0,
            next_role: "manager",
            status: "running",
          },
          mode: "implementation",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: sessionId,
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /manager housekeeping turn 1/u);
    assert.doesNotMatch(continuation.reason, /CLAUDE_CODE_STOP_HOOK_BLOCK_CAP-proximity/u);

    const nextRuntime = readJsonFile(runtimePath);
    const cap = nextRuntime.implementation_loop.claude_code_stop_hook_block_cap;
    assert.equal(cap.value, 0);
    assert.equal(cap.uncapped, true);
    assert.equal(cap.finite, false);
    assert.equal(cap.consecutive_blocks, 1);
    assert.equal(nextRuntime.implementation_loop.current_role, "manager");
    assert.equal(nextRuntime.implementation_loop.next_role, "techlead");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code finite block cap proximity routes to manager guidance", () => {
  const root = makeTempRoot("hook-claude-cap-proximity-");
  const slug = "cap-proximity";
  const sessionId = "claude-cap-proximity-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "near cap" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude cap proximity project", "--slug", slug, "--no-gitignore"]));

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(
      runtimePath,
      `${JSON.stringify(
        {
          ...runtime,
          implementation_loop: {
            claude_code_stop_hook_block_cap: {
              consecutive_blocks: 19,
              env_var: "CLAUDE_CODE_STOP_HOOK_BLOCK_CAP",
              finite: true,
              last_block_at: "2026-07-01T00:00:00+00:00",
              proximity_remaining: 1,
              proximity_routed_at: null,
              raw_value: "20",
              recorded_at: "2026-07-01T00:00:00+00:00",
              uncapped: false,
              valid: true,
              value: 20,
            },
            current_role: null,
            iteration: 19,
            next_role: "techlead",
            status: "running",
          },
          mode: "implementation",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "20",
      },
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: sessionId,
        stop_hook_active: true,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /CLAUDE_CODE_STOP_HOOK_BLOCK_CAP-proximity/u);
    assert.match(continuation.reason, /manually ask the agent to continue loop mode/u);

    const nextRuntime = readJsonFile(runtimePath);
    const cap = nextRuntime.implementation_loop.claude_code_stop_hook_block_cap;
    assert.equal(nextRuntime.implementation_loop.current_role, "manager");
    assert.equal(nextRuntime.implementation_loop.next_role, "techlead");
    assert.equal(cap.consecutive_blocks, 20);
    assert.equal(typeof cap.proximity_routed_at, "string");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code Stop hook reentry continues the queued implementation turn", () => {
  const root = makeTempRoot("hook-claude-reentry-");
  const slug = "claude-reentry";
  const sessionId = "claude-reentry-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "reentry" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude reentry project", "--slug", slug, "--no-gitignore"]));

    const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
    const runtime = readJsonFile(runtimePath);
    fs.writeFileSync(
      runtimePath,
      `${JSON.stringify(
        {
          ...runtime,
          implementation_loop: {
            current_role: null,
            iteration: 0,
            next_role: "manager",
            status: "running",
          },
          mode: "implementation",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: sessionId,
        stop_hook_active: true,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /manager housekeeping turn 1/u);

    const nextRuntime = readJsonFile(runtimePath);
    assert.equal(nextRuntime.implementation_loop.current_role, "manager");
    assert.equal(nextRuntime.implementation_loop.next_role, "techlead");
    assert.equal(nextRuntime.implementation_loop.claude_code_stop_hook_block_cap.consecutive_blocks, 1);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code Stop hook reentry captures the role report and continues to techlead", () => {
  const root = makeTempRoot("hook-claude-reentry-report-");
  const slug = "reentry-report";
  const sessionId = "claude-reentry-report-session";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", content: "stale reentry transcript" })}\n`, "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Claude reentry report project", "--slug", slug, "--no-gitignore"]));
    writeOpenImplementationTurn(root, slug, "manager");
    writeSessionBinding(root, slug, sessionId);

    const result = runNodeScript("hook.mjs", ["--root", root], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        last_assistant_message: "actual manager reentry report",
        session_id: sessionId,
        stop_hook_active: true,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    const continuation = JSON.parse(result.stdout);
    assert.equal(continuation.decision, "block");
    assert.match(continuation.reason, /techlead turn 3/u);

    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.implementation_loop.current_role, "techlead");
    assert.equal(runtime.implementation_loop.next_role, "awaiting-transition");
    assert.equal(runtime.implementation_loop.last_manager_report_path, ".epic-loop/epics/reentry-report/.runtime/latest-manager-report.md");
    // The manager turn was closed and a fresh techlead turn opened in the same reentry.
    assert.equal(runtime.implementation_loop.active_turn_stopped_at, null);
    assert.ok(runtime.implementation_loop.active_turn_started_at);

    const report = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-manager-report.md"), "utf8");
    assert.match(report, /actual manager reentry report/u);
    assert.doesNotMatch(report, /stale reentry transcript/u);

    const progress = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "progress-log.jsonl"), "utf8");
    assert.match(progress, /"action":"turn-stop"/u);
    assert.match(progress, /"action":"turn-start"/u);
    assert.match(progress, /"next_role":"awaiting-transition"/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("Claude Code malformed or missing transcripts do not break continuation", () => {
  const cases = [
    {
      name: "missing",
      transcriptPath: "/tmp/epic-loop-missing-transcript.jsonl",
    },
    {
      content: "{not-json\n",
      name: "malformed",
    },
    {
      content: `${JSON.stringify({ role: "user", content: "no assistant text" })}\n`,
      name: "assistant-empty",
      slug: "assistant-empty",
    },
  ];

  for (const testCase of cases) {
    const root = makeTempRoot(`hook-claude-${testCase.name}-`);
    const slug = testCase.slug ?? `${testCase.name}-transcript`;
    const sessionId = `${testCase.name}-session`;
    const transcriptPath = testCase.transcriptPath ?? path.join(root, "transcript.jsonl");

    try {
      if (testCase.content !== undefined) {
        fs.writeFileSync(transcriptPath, testCase.content, "utf8");
      }
      assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
      assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", `${testCase.name} transcript project`, "--slug", slug, "--no-gitignore"]));
      writeOpenImplementationTurn(root, slug);
      writeSessionBinding(root, slug, sessionId);

      const result = runNodeScript("hook.mjs", ["--root", root], {
        input: JSON.stringify({
          cwd: root,
          hook_event_name: "Stop",
          session_id: sessionId,
          stop_hook_active: false,
          transcript_path: transcriptPath,
        }),
      });

      assertSuccess(result);
      assert.equal(JSON.parse(result.stdout).decision, "block");
      assert.equal(fs.existsSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-engineer-report.md")), false);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  }
});
