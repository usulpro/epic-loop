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
        active_sessions: {
          [`${slug}:implementation`]: sessionId,
        },
        sessions: {
          [sessionId]: {
            active: true,
            epic_slug: slug,
            mode: "implementation",
          },
        },
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
  const payload = {
    cwd: root,
    hook_event_name: "Stop",
    session_id: "session-unbound",
    turn_id: "turn-1",
  };

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify(payload),
    });

    assertSuccess(result);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".codex", "tmp", "last-hook-capture.json")), true);
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

test("Claude Code unbound hook payload exits without epic-loop runtime records", () => {
  const root = makeTempRoot("hook-claude-unbound-");
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, "{\"type\":\"assistant\",\"message\":{\"content\":\"done\"}}\n", "utf8");
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: "claude-session-unbound",
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });

    assertSuccess(result);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".codex", "tmp", "last-hook-capture.json")), false);
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
    assert.match(
      fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, ".runtime", "latest-manager-report.md"), "utf8"),
      /Manager report from transcript/u,
    );
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
        JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "Older assistant report" }] } }),
        "{malformed-json",
        JSON.stringify({ type: "assistant", message: { content: "Middle assistant report" } }),
        JSON.stringify({ role: "assistant", content: [{ text: "Latest assistant" }, { type: "text", text: "report" }] }),
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
        stop_hook_active: false,
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

test("Claude Code Stop hook reentry does not issue another block", () => {
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
    assert.equal(result.stdout, "");

    const nextRuntime = readJsonFile(runtimePath);
    assert.equal(nextRuntime.implementation_loop.current_role, null);
    assert.equal(nextRuntime.implementation_loop.next_role, "manager");
    assert.equal(nextRuntime.implementation_loop.claude_code_stop_hook_block_cap.consecutive_blocks, 0);
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
