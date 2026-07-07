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

function runtimeStatePath(root, slug) {
  return path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");
}

function readAdditionalContext(result) {
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  return output.hookSpecificOutput.additionalContext;
}

test("compact mode marker is injected on UserPromptSubmit for two bound shaping members", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-shaping-");

  try {
    bindSession(root, slug, "session-a", "shaping");
    bindSession(root, slug, "session-b", "shaping");

    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-a"))), `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);
    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-b"))), `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("compact mode marker is injected on UserPromptSubmit for a bound review member", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-review-");

  try {
    bindSession(root, slug, "session-review", "review");

    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-review"))), `[epic-loop] epic=${slug} mode=review — follow epic-loop skill mode rules`);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("mode marker follows runtime mode changes without rebinding members", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-propagation-");

  try {
    bindSession(root, slug, "session-a", "shaping");
    bindSession(root, slug, "session-b", "shaping");

    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-b"))), `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);

    assertSuccess(runNodeScript("set-epic-mode.mjs", ["--root", root, "--slug", slug, "--mode", "review"]));

    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-b"))), `[epic-loop] epic=${slug} mode=review — follow epic-loop skill mode rules`);
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

test("implementation driver gets no reminder and non-driver member gets the lock marker", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-implementation-");

  try {
    bindSession(root, slug, "driver-session", "implementation");

    const bindings = readJsonFile(bindingsPath(root));
    bindings.sessions["observer-session"] = {
      active: true,
      activated_at: "2026-07-01T00:00:00+00:00",
      bound_at: "2026-07-01T00:00:00+00:00",
      epic_slug: slug,
      source: "explicit-session-id",
      turn_id: null,
    };
    fs.writeFileSync(bindingsPath(root), `${JSON.stringify(bindings, null, 2)}\n`, "utf8");

    assert.equal(runHook(root, promptPayload(root, "driver-session")).stdout, "");
    assert.equal(
      readAdditionalContext(runHook(root, promptPayload(root, "observer-session"))),
      `[epic-loop] epic=${slug} mode=implementation — loop running in another session; read-only, do not edit epic artifacts`,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bindings are mode-less memberships and allow multiple active members", () => {
  const { root, slug } = scaffoldEpicRoot("membership-schema-");
  const otherSlug = "other-epic";

  try {
    bindSession(root, slug, "session-a", "shaping");
    bindSession(root, slug, "session-b", "shaping");

    const bindings = readJsonFile(bindingsPath(root));
    assert.equal(bindings.active_sessions, undefined);
    assert.equal(bindings.sessions["session-a"].active, true);
    assert.equal(bindings.sessions["session-a"].epic_slug, slug);
    assert.equal(bindings.sessions["session-a"].mode, undefined);
    assert.equal(bindings.sessions["session-b"].active, true);
    assert.equal(bindings.sessions["session-b"].epic_slug, slug);
    assert.equal(bindings.sessions["session-b"].mode, undefined);

    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-a"))), `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);
    assert.equal(readAdditionalContext(runHook(root, promptPayload(root, "session-b"))), `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);

    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Other epic", "--slug", otherSlug, "--no-gitignore"]));
    bindSession(root, otherSlug, "session-a", "review");

    const rebound = readJsonFile(bindingsPath(root));
    assert.equal(rebound.sessions["session-a"].active, true);
    assert.equal(rebound.sessions["session-a"].epic_slug, otherSlug);
    assert.equal(rebound.sessions["session-b"].active, true);
    assert.equal(rebound.sessions["session-b"].epic_slug, slug);
    assert.equal(rebound.active_sessions, undefined);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("implementation binding designates and replaces the runtime driver", () => {
  const { root, slug } = scaffoldEpicRoot("membership-driver-");

  try {
    bindSession(root, slug, "driver-one", "implementation");
    let runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.mode, "implementation");
    assert.equal(runtime.implementation_loop.driver_session_id, "driver-one");

    bindSession(root, slug, "driver-two", "implementation");
    const bindings = readJsonFile(bindingsPath(root));
    runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(bindings.sessions["driver-one"].active, true);
    assert.equal(bindings.sessions["driver-two"].active, true);
    assert.equal(runtime.implementation_loop.driver_session_id, "driver-two");
    assert.equal(bindings.active_sessions, undefined);
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
    assert.equal(entry.mode, undefined);
    assert.equal(bindings.active_sessions, undefined);

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

test("mode reminder silently skips malformed or unsupported runtime state", () => {
  const { root, slug } = scaffoldEpicRoot("reminder-runtime-skip-");

  try {
    bindSession(root, slug, "session-bound", "shaping");

    fs.rmSync(runtimeStatePath(root, slug), { force: true });
    assert.equal(runHook(root, promptPayload(root, "session-bound")).stdout, "");

    fs.writeFileSync(runtimeStatePath(root, slug), "{", "utf8");
    assert.equal(runHook(root, promptPayload(root, "session-bound")).stdout, "");

    fs.writeFileSync(runtimeStatePath(root, slug), `${JSON.stringify({ mode: "paused" }, null, 2)}\n`, "utf8");
    assert.equal(runHook(root, promptPayload(root, "session-bound")).stdout, "");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("unbinding the implementation driver idles the loop but unbinding a non-driver does not", () => {
  const { root, slug } = scaffoldEpicRoot("unbind-driver-");
  const runtimePath = path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json");

  try {
    bindSession(root, slug, "driver-session", "implementation");

    const bindings = readJsonFile(bindingsPath(root));
    bindings.sessions["observer-session"] = {
      active: true,
      activated_at: "2026-07-01T00:00:00+00:00",
      bound_at: "2026-07-01T00:00:00+00:00",
      epic_slug: slug,
      source: "explicit-session-id",
      turn_id: null,
    };
    fs.writeFileSync(bindingsPath(root), `${JSON.stringify(bindings, null, 2)}\n`, "utf8");

    assertSuccess(runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "observer-session"]));
    let runtime = readJsonFile(runtimePath);
    assert.equal(runtime.implementation_loop.status, "running");
    assert.equal(runtime.implementation_loop.driver_session_id, "driver-session");

    assertSuccess(runNodeScript("unbind-session.mjs", ["--root", root, "--session-id", "driver-session"]));
    runtime = readJsonFile(runtimePath);
    assert.equal(runtime.implementation_loop.status, "idle");
    assert.equal(runtime.implementation_loop.next_role, "idle");
    assert.equal(runtime.implementation_loop.driver_session_id, null);
    assert.equal(runtime.implementation_loop.last_reason, "implementation-driver-unbound");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
