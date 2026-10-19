import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

// The epic home's activity feed reads the driver's transcript; the skill records where it is.
// Hook captures never store the transcript path, so a bind knows it only from a transcript scan;
// the driver's next hook payload records it.
test("the driver's hook payloads record driver_transcript_path, a rebind keeps it, and another session's payload does not", () => {
  const root = makeTempRoot("driver-transcript");
  const slug = "demo";
  const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
  const bindingsPath = path.join(root, ".epic-loop", ".runtime", "session-bindings.json");
  const first = path.join(root, "driver-1.jsonl");
  const second = path.join(root, "driver-2.jsonl");
  const other = path.join(root, "other.jsonl");
  for (const file of [first, second, other]) fs.writeFileSync(file, `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "ready" }] } })}\n`);
  const hook = (sessionId, event, transcriptPath) =>
    runNodeScript("hook.mjs", ["--root", root], {
      env: { CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0" },
      input: JSON.stringify({ cwd: root, hook_event_name: event, session_id: sessionId, stop_hook_active: false, transcript_path: transcriptPath }),
    });
  const recorded = () => readJsonFile(runtimePath).implementation_loop.driver_transcript_path;

  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Demo", "--slug", slug, "--no-gitignore"]));
  assertSuccess(hook("driver", "SessionStart", first));
  const bind = () => assertSuccess(runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", slug, "--mode", "implementation"]));
  bind();
  assertSuccess(hook("driver", "UserPromptSubmit", first));
  assert.equal(recorded(), first, "the driver's payload records its transcript");

  assertSuccess(hook("driver", "Stop", second));
  assert.equal(recorded(), second, "a later driver payload refreshes it");
  assertSuccess(hook("driver", "SessionStart", second));
  bind();
  assert.equal(recorded(), second, "rebinding the same driver keeps the path");

  const bindings = readJsonFile(bindingsPath);
  bindings.sessions.member = { ...bindings.sessions.driver, mode: null, source: "test" };
  fs.writeFileSync(bindingsPath, JSON.stringify(bindings));
  assertSuccess(hook("member", "UserPromptSubmit", other));
  assertSuccess(hook("member", "Stop", other));
  assert.equal(recorded(), second, "a non-driver session does not record its transcript");
});
