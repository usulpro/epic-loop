import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

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
