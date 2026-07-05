import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

function scaffoldEpicRoot(prefix) {
  const root = makeTempRoot(prefix);
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "reminder and unbind fixture"]));
  const slug = fs.readdirSync(path.join(root, ".epic-loop", "epics"))[0];
  return { root, slug };
}

function bindSession(root, slug, sessionId, mode) {
  assertSuccess(runNodeScript("bind-session.mjs", ["--root", root, "--session-id", sessionId, "--slug", slug, "--mode", mode]));
}

function runHook(root, payload) {
  const result = runNodeScript("hook.mjs", ["--root", root], {
    input: JSON.stringify(payload),
  });
  assertSuccess(result);
  return result;
}

function promptPayload(root, sessionId, eventName = "UserPromptSubmit") {
  return {
    cwd: root,
    hook_event_name: eventName,
    session_id: sessionId,
    turn_id: "turn-1",
  };
}

function bindingsPath(root) {
  return path.join(root, ".epic-loop", ".runtime", "session-bindings.json");
}

test("mode reminder is injected on UserPromptSubmit for a bound shaping session", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-shaping-");

  try {
    bindSession(root, slug, "session-shaping", "shaping");

    const result = runHook(root, promptPayload(root, "session-shaping"));
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 1);

    const output = JSON.parse(lines[0]);
    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    const text = output.hookSpecificOutput.additionalContext;
    assert.equal(text.startsWith("[epic-loop]"), true);
    assert.equal(text.includes(`Bound to epic "${slug}" — shaping mode.`), true);
    assert.equal(text.includes("SKILL.md Shaping Rules"), true);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("mode reminder is injected on UserPromptSubmit for a bound review session", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-review-");

  try {
    bindSession(root, slug, "session-review", "review");

    const result = runHook(root, promptPayload(root, "session-review"));
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    const text = output.hookSpecificOutput.additionalContext;
    assert.equal(text.startsWith("[epic-loop]"), true);
    assert.equal(text.includes(`Bound to epic "${slug}" — review mode.`), true);
    assert.equal(text.includes("SKILL.md Review Rules"), true);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("unbound sessions still produce zero stdout on UserPromptSubmit", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-unbound-");

  try {
    // Bind a different session so bindings exist but this session id stays unbound.
    bindSession(root, slug, "session-other", "shaping");

    const result = runHook(root, promptPayload(root, "session-never-bound"));
    assert.equal(result.stdout, "");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("no reminder leaks into Stop events for a bound shaping session", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-stop-");

  try {
    bindSession(root, slug, "session-shaping", "shaping");

    const result = runHook(root, promptPayload(root, "session-shaping", "Stop"));
    assert.equal(result.stdout, "");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("no reminder is injected for a bound implementation session on UserPromptSubmit", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-implementation-");

  try {
    bindSession(root, slug, "session-impl", "implementation");

    const result = runHook(root, promptPayload(root, "session-impl"));
    assert.equal(result.stdout, "");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("unbind-session is a no-op for a never-bound session id", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-noop-");

  try {
    bindSession(root, slug, "session-other", "shaping");
    const before = fs.readFileSync(bindingsPath(root), "utf8");

    const result = runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-never-bound"]);
    assertSuccess(result);
    assert.equal(result.stdout.trim(), "Session session-never-bound is not currently bound to any epic.");
    assert.equal(fs.readFileSync(bindingsPath(root), "utf8"), before);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("unbind-session deactivates a bound session with the default reason", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-default-");

  try {
    bindSession(root, slug, "session-bound", "shaping");

    const result = runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-bound"]);
    assertSuccess(result);
    assert.equal(result.stdout.trim(), `Session session-bound unbound from ${slug} (shaping).`);

    const bindings = readJsonFile(bindingsPath(root));
    const entry = bindings.sessions["session-bound"];
    assert.equal(entry.active, false);
    assert.equal(typeof entry.deactivated_at, "string");
    assert.equal(entry.deactivated_reason, "user-requested-unbind");
    assert.equal(Object.hasOwn(bindings.active_sessions, `${slug}:shaping`), false);

    const unbindRecord = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "sessions", "session-bound", "unbind.json"));
    assert.equal(unbindRecord.epic_slug, slug);
    assert.equal(unbindRecord.mode, "shaping");
    assert.equal(unbindRecord.reason, "user-requested-unbind");
    assert.equal(unbindRecord.session_id, "session-bound");
    assert.equal(typeof unbindRecord.unbound_at, "string");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("unbind-session records a custom --reason in the binding and the unbind mirror", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-reason-");

  try {
    bindSession(root, slug, "session-bound", "review");

    const result = runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-bound", "--reason", "quick unrelated check"]);
    assertSuccess(result);

    const bindings = readJsonFile(bindingsPath(root));
    assert.equal(bindings.sessions["session-bound"].deactivated_reason, "quick unrelated check");

    const unbindRecord = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "sessions", "session-bound", "unbind.json"));
    assert.equal(unbindRecord.reason, "quick unrelated check");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("a second unbind of the same session is a no-op", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-twice-");

  try {
    bindSession(root, slug, "session-bound", "shaping");
    assertSuccess(runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-bound"]));

    const result = runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-bound"]);
    assertSuccess(result);
    assert.equal(result.stdout.trim(), "Session session-bound is not currently bound to any epic.");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("hooks are silent for a session id after it is unbound", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-silence-");

  try {
    bindSession(root, slug, "session-bound", "shaping");

    const before = runHook(root, promptPayload(root, "session-bound"));
    assert.equal(before.stdout.includes("hookSpecificOutput"), true);

    assertSuccess(runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "session-bound"]));

    const after = runHook(root, promptPayload(root, "session-bound"));
    assert.equal(after.stdout, "");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
