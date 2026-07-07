import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

function runHook(root, payload) {
  const result = runNodeScript("hook.mjs", ["--root", root], {
    input: JSON.stringify(payload),
  });
  assertSuccess(result);
  return result;
}

function userPromptPayload(root, sessionId, extra = {}) {
  return {
    cwd: root,
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    turn_id: "turn-user-prompt",
    ...extra,
  };
}

test("doctor and install-hooks expose readiness contracts in an isolated project", () => {
  const root = makeTempRoot("doctor-");

  try {
    fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(root, ".codex", "config.toml"), "[features]\nhooks = true\n", "utf8");

    const missingPlatform = runNodeScript("doctor.mjs", ["--root", root, "--json"]);
    assert.equal(missingPlatform.status, 1);
    assert.match(missingPlatform.stderr, /doctor\.mjs --platform codex\|claude-code --json/u);

    const before = runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]);
    assertSuccess(before);
    const beforeStatus = JSON.parse(before.stdout);
    assert.equal(beforeStatus.platform, "codex");
    assert.equal(beforeStatus.ready, false);
    assert.equal(beforeStatus.status, "setup-required");
    assert.deepEqual(beforeStatus.hookConfig.missingEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);

    const platformConfigPath = path.join(root, ".epic-loop", ".runtime", "platform.json");
    assert.equal(readJsonFile(platformConfigPath).platform, "codex");

    const install = runNodeScript("install-hooks.mjs", ["--root", root]);
    assertSuccess(install);
    assert.match(install.stdout, /Installed project-local epic-loop hooks/u);

    const hooksPath = path.join(root, ".codex", "hooks.json");
    const hooks = readJsonFile(hooksPath);
    for (const eventName of ["SessionStart", "UserPromptSubmit", "Stop"]) {
      const commands = hooks.hooks[eventName].flatMap((entry) => entry.hooks.map((hook) => hook.command));
      assert.equal(commands.length, 1);
      assert.match(commands[0], /hook\.mjs/u);
    }

    const secondInstall = runNodeScript("install-hooks.mjs", ["--root", root]);
    assertSuccess(secondInstall);
    assert.match(secondInstall.stdout, /already installed/u);
    assert.deepEqual(readJsonFile(hooksPath), hooks);

    const after = runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]);
    assertSuccess(after);
    const afterStatus = JSON.parse(after.stdout);
    assert.equal(afterStatus.platform, "codex");
    assert.equal(afterStatus.ready, true);
    assert.equal(afterStatus.status, "ready");
    assert.deepEqual(afterStatus.hookConfig.missingEvents, []);
    assert.deepEqual(afterStatus.hookConfig.staleEvents, []);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("doctor exposes a Claude Code platform readiness boundary", () => {
  const root = makeTempRoot("doctor-claude-");

  try {
    const result = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: undefined,
      },
    });
    assertSuccess(result);
    const status = JSON.parse(result.stdout);
    assert.equal(status.platform, "claude-code");
    assert.equal(status.ready, false);
    assert.equal(status.status, "setup-required");
    assert.match(status.command, /hook\.mjs' --root '/u);
    assert.match(status.command, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.match(status.claudeCodeHookConfig.path, /\.claude\/settings\.json$/u);
    assert.equal(status.claudeCodeHookConfig.exists, false);
    assert.deepEqual(status.claudeCodeHookConfig.missingEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
    assert.equal(status.stopHookBlockCap.envVar, "CLAUDE_CODE_STOP_HOOK_BLOCK_CAP");
    assert.equal(status.stopHookBlockCap.ready, false);
    assert.equal(status.stopHookBlockCap.reason, "missing");
    assert.equal(readJsonFile(path.join(root, ".epic-loop", ".runtime", "platform.json")).platform, "claude-code");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("doctor reports Claude Code hook readiness and block cap status", () => {
  const root = makeTempRoot("doctor-claude-ready-");

  try {
    assertSuccess(
      runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
        env: {
          CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
        },
      }),
    );
    assertSuccess(runNodeScript("install-hooks.mjs", ["--root", root]));

    const ready = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
    });
    assertSuccess(ready);
    const readyStatus = JSON.parse(ready.stdout);
    assert.equal(readyStatus.platform, "claude-code");
    assert.equal(readyStatus.ready, true);
    assert.equal(readyStatus.status, "ready");
    assert.deepEqual(readyStatus.claudeCodeHookConfig.missingEvents, []);
    assert.deepEqual(readyStatus.claudeCodeHookConfig.staleEvents, []);
    assert.equal(readyStatus.stopHookBlockCap.ready, true);
    assert.equal(readyStatus.stopHookBlockCap.recommended, true);
    assert.equal(readyStatus.stopHookBlockCap.value, 0);

    const finite = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "20",
      },
    });
    assertSuccess(finite);
    const finiteStatus = JSON.parse(finite.stdout);
    assert.equal(finiteStatus.ready, true);
    assert.equal(finiteStatus.stopHookBlockCap.ready, true);
    assert.equal(finiteStatus.stopHookBlockCap.recommended, false);
    assert.match(finiteStatus.stopHookBlockCap.warning, /may stop early and require manual continuation/u);
    assert.deepEqual(finiteStatus.warnings, [finiteStatus.stopHookBlockCap.warning]);

    const recommendedFinite = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "51",
      },
    });
    assertSuccess(recommendedFinite);
    const recommendedFiniteStatus = JSON.parse(recommendedFinite.stdout);
    assert.equal(recommendedFiniteStatus.ready, true);
    assert.equal(recommendedFiniteStatus.stopHookBlockCap.ready, true);
    assert.equal(recommendedFiniteStatus.stopHookBlockCap.recommended, true);
    assert.equal(recommendedFiniteStatus.stopHookBlockCap.warning, null);

    const low = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "19",
      },
    });
    assertSuccess(low);
    const lowStatus = JSON.parse(low.stdout);
    assert.equal(lowStatus.ready, false);
    assert.equal(lowStatus.status, "setup-required");
    assert.equal(lowStatus.stopHookBlockCap.reason, "below-minimum");

    const invalid = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "many",
      },
    });
    assertSuccess(invalid);
    const invalidStatus = JSON.parse(invalid.stdout);
    assert.equal(invalidStatus.ready, false);
    assert.equal(invalidStatus.stopHookBlockCap.reason, "invalid");

    const missing = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: undefined,
      },
    });
    assertSuccess(missing);
    const missingStatus = JSON.parse(missing.stdout);
    assert.equal(missingStatus.ready, false);
    assert.equal(missingStatus.stopHookBlockCap.reason, "missing");

    const settingsPath = path.join(root, ".claude", "settings.json");
    const settings = readJsonFile(settingsPath);
    settings.hooks.SessionStart[0].hooks[0].command = "node /old/epic-loop/hook.mjs";
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

    const stale = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
    });
    assertSuccess(stale);
    const staleStatus = JSON.parse(stale.stdout);
    assert.equal(staleStatus.ready, false);
    assert.equal(staleStatus.status, "setup-required");
    assert.deepEqual(staleStatus.claudeCodeHookConfig.staleEvents, ["SessionStart"]);
    assert.deepEqual(staleStatus.claudeCodeHookConfig.missingEvents, ["SessionStart"]);

    fs.writeFileSync(settingsPath, "{", "utf8");
    const malformed = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"], {
      env: {
        CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0",
      },
    });
    assertSuccess(malformed);
    const malformedStatus = JSON.parse(malformed.stdout);
    assert.equal(malformedStatus.ready, false);
    assert.equal(malformedStatus.claudeCodeHookConfig.invalid, true);
    assert.deepEqual(malformedStatus.claudeCodeHookConfig.missingEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("install-hooks adds Claude Code project settings without damaging unrelated entries", () => {
  const root = makeTempRoot("install-claude-");

  try {
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const settingsPath = path.join(root, ".claude", "settings.json");
    const dryRun = runNodeScript("install-hooks.mjs", ["--root", root, "--dry-run"]);
    assertSuccess(dryRun);
    assert.match(dryRun.stdout, /Dry run:/u);
    assert.match(dryRun.stdout, /SessionStart/u);
    assert.equal(fs.existsSync(settingsPath), false);

    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      `${JSON.stringify(
        {
          permissions: {
            allow: ["Bash(echo:*)"],
          },
          hooks: {
            Stop: [
              {
                matcher: "",
                hooks: [
                  {
                    command: "echo unrelated",
                    type: "command",
                  },
                  {
                    command: "node /old/epic-loop/hook.mjs",
                    timeout: 5,
                    type: "command",
                  },
                ],
              },
            ],
            PreToolUse: [
              {
                matcher: "Bash",
                hooks: [
                  {
                    command: "echo pre-tool",
                    type: "command",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const install = runNodeScript("install-hooks.mjs", ["--root", root]);
    assertSuccess(install);
    assert.match(install.stdout, /Installed project-local Claude Code epic-loop hooks/u);

    const settings = readJsonFile(settingsPath);
    assert.deepEqual(settings.permissions.allow, ["Bash(echo:*)"]);
    assert.equal(settings.hooks.PreToolUse[0].hooks[0].command, "echo pre-tool");

    for (const eventName of ["SessionStart", "UserPromptSubmit", "Stop"]) {
      const entries = settings.hooks[eventName];
      assert.equal(Array.isArray(entries), true);
      const commands = entries.flatMap((entry) => entry.hooks.map((hook) => hook.command));
      const epicLoopCommands = commands.filter((command) => /hook\.mjs/u.test(command) && /epic-loop/u.test(command));
      assert.equal(epicLoopCommands.length, 1);
      assert.match(epicLoopCommands[0], /plugins\/epic-loop\/skills\/epic-loop\/scripts\/hook\.mjs/u);
      assert.match(epicLoopCommands[0], / --root /u);
      assert.match(epicLoopCommands[0], new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    }

    const stopCommands = settings.hooks.Stop[0].hooks.map((hook) => hook.command);
    assert.deepEqual(stopCommands.filter((command) => command === "echo unrelated"), ["echo unrelated"]);
    assert.equal(stopCommands.some((command) => command === "node /old/epic-loop/hook.mjs"), false);

    const secondInstall = runNodeScript("install-hooks.mjs", ["--root", root]);
    assertSuccess(secondInstall);
    assert.match(secondInstall.stdout, /already installed/u);
    assert.deepEqual(readJsonFile(settingsPath), settings);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("task and role handoff CLIs update public files through process contracts", () => {
  const root = makeTempRoot("handoff-");

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "CLI contract project", "--no-gitignore"]));

    const startTask = runNodeScript("start-task.mjs", ["--root", root, "--slug", "cli-contract", "--task-id", "phase-1-task-1"]);
    assertSuccess(startTask);
    assert.match(startTask.stdout, /Started task phase-1-task-1/u);

    const trackerPath = path.join(root, ".epic-loop", "epics", "cli-contract", "tracker.md");
    assert.match(fs.readFileSync(trackerPath, "utf8"), /Status: doing/u);

    const brief = runNodeScript("write-engineer-brief.mjs", ["--root", root, "--slug", "cli-contract", "--stdin"], {
      input: "Implement a narrow CLI contract test.\n",
    });
    assertSuccess(brief);
    assert.match(brief.stdout, /\.runtime\/current-engineer-prompt\.md/u);

    const setNext = runNodeScript("set-next-role.mjs", [
      "--root",
      root,
      "--slug",
      "cli-contract",
      "--role",
      "engineer",
      "--prompt-file",
      ".epic-loop/epics/cli-contract/.runtime/current-engineer-prompt.md",
      "--reason",
      "unit-test-contract",
    ]);
    assertSuccess(setNext);
    assert.match(setNext.stdout, /Next implementation role for cli-contract: engineer/u);

    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", "cli-contract", ".runtime", "runtime-state.json"));
    assert.equal(runtime.implementation_loop.next_role, "engineer");
    assert.equal(runtime.implementation_loop.prompt_file, ".epic-loop/epics/cli-contract/.runtime/current-engineer-prompt.md");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bind-session current lookup requires explicit platform selection", () => {
  const root = makeTempRoot("bind-platform-");

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bind platform project", "--no-gitignore"]));

    const missingPlatform = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", "bind-platform", "--mode", "implementation"]);
    assert.equal(missingPlatform.status, 1);
    assert.match(missingPlatform.stderr, /doctor\.mjs --platform codex\|claude-code --json/u);

    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
    const claudeCurrent = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", "bind-platform", "--mode", "implementation"]);
    assert.equal(claudeCurrent.status, 1);
    assert.match(claudeCurrent.stderr, /Pass --session-id explicitly\./u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bind-session current lookup preserves Codex hook capture behavior", () => {
  const root = makeTempRoot("bind-codex-current-");
  const slug = "bind-codex";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bind Codex current project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

    const capture = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: "codex-current-session",
        turn_id: "turn-current",
      }),
    });
    assertSuccess(capture);

    const bind = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", slug, "--mode", "implementation"]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Active implementation session for bind-codex: codex-current-session/u);

    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions["codex-current-session"].source, "current-codex-session");
    assert.equal(bindings.sessions["codex-current-session"].turn_id, "turn-current");
    assert.equal(bindings.sessions["codex-current-session"].mode, undefined);
    assert.equal(bindings.active_sessions, undefined);
    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.implementation_loop.driver_session_id, "codex-current-session");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bind-session current lookup uses fresh Claude Code hook captures", () => {
  const root = makeTempRoot("bind-claude-current-");
  const slug = "bind-claude";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, "{\"type\":\"assistant\",\"message\":{\"content\":\"ready\"}}\n", "utf8");
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bind Claude current project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const capture = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: "claude-current-session",
        stop_hook_active: false,
        transcript_path: transcriptPath,
      }),
    });
    assertSuccess(capture);

    const bind = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", slug, "--mode", "implementation"]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Active implementation session for bind-claude: claude-current-session/u);

    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions["claude-current-session"].source, "current-claude-code-session");
    assert.equal(bindings.sessions["claude-current-session"].mode, undefined);
    assert.equal(bindings.active_sessions, undefined);
    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.implementation_loop.driver_session_id, "claude-current-session");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("bind-session current lookup rejects unusable Claude Code captures", () => {
  const cases = [
    {
      name: "stale",
      capture: (root) => ({
        capturedAt: "2000-01-01T00:00:00+00:00",
        payload: {
          cwd: root,
          session_id: "stale-session",
          transcript_path: path.join(root, "transcript.jsonl"),
        },
      }),
    },
    {
      name: "malformed",
      capture: (root) => ({
        capturedAt: new Date().toISOString(),
        payload: {
          cwd: root,
          session_id: "malformed-session",
        },
      }),
    },
    {
      name: "wrong-root",
      capture: (root) => ({
        capturedAt: new Date().toISOString(),
        payload: {
          cwd: path.join(root, "other"),
          session_id: "wrong-root-session",
          transcript_path: path.join(root, "transcript.jsonl"),
        },
      }),
    },
  ];

  for (const testCase of cases) {
    const root = makeTempRoot(`bind-claude-${testCase.name}-`);
    const slug = `bind-claude-${testCase.name}`;

    try {
      assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", `Bind Claude ${testCase.name} project`, "--slug", slug, "--no-gitignore"]));
      assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

      const capturePath = path.join(root, ".epic-loop", ".runtime", "claude-code-last-hook-capture.json");
      fs.mkdirSync(path.dirname(capturePath), { recursive: true });
      fs.writeFileSync(capturePath, `${JSON.stringify(testCase.capture(root), null, 2)}\n`, "utf8");

      const bind = runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", slug, "--mode", "implementation"]);
      assert.equal(bind.status, 1);
      assert.match(bind.stderr, /Pass --session-id explicitly\./u);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  }
});

test("bind-session preserves explicit session-id binding on Claude Code", () => {
  const root = makeTempRoot("bind-claude-explicit-");
  const slug = "bind-claude";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Bind Claude explicit project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const bind = runNodeScript("bind-session.mjs", ["--root", root, "--session-id", "explicit-claude-session", "--slug", slug, "--mode", "implementation"]);
    assertSuccess(bind);

    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions["explicit-claude-session"].source, "explicit-session-id");
    assert.equal(bindings.sessions["explicit-claude-session"].mode, undefined);
    assert.equal(bindings.active_sessions, undefined);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session binds a resumed Codex shaping epic from a fresh UserPromptSubmit capture", () => {
  const root = makeTempRoot("auto-bind-codex-shaping-");
  const slug = "auto-codex";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto Codex project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

    runHook(root, userPromptPayload(root, "codex-auto-session"));

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bound current session to auto-codex: codex-auto-session/u);

    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions["codex-auto-session"].active, true);
    assert.equal(bindings.sessions["codex-auto-session"].epic_slug, slug);
    assert.equal(bindings.sessions["codex-auto-session"].mode, undefined);

    const marker = runHook(root, userPromptPayload(root, "codex-auto-session"));
    assert.equal(JSON.parse(marker.stdout).hookSpecificOutput.additionalContext, `[epic-loop] epic=${slug} mode=shaping — follow epic-loop skill mode rules`);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session accepts an epic path and preserves review runtime mode", () => {
  const root = makeTempRoot("auto-bind-review-path-");
  const slug = "auto-review";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto review project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("set-epic-mode.mjs", ["--root", root, "--slug", slug, "--mode", "review"]));

    runHook(root, userPromptPayload(root, "review-auto-session"));

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--path", path.join(root, ".epic-loop", "epics", slug)]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bound current session to auto-review: review-auto-session/u);

    const marker = runHook(root, userPromptPayload(root, "review-auto-session"));
    assert.equal(JSON.parse(marker.stdout).hookSpecificOutput.additionalContext, `[epic-loop] epic=${slug} mode=review — follow epic-loop skill mode rules`);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session binds implementation observers without replacing the driver", () => {
  const root = makeTempRoot("auto-bind-implementation-");
  const slug = "auto-implementation";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto implementation project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));
    assertSuccess(runNodeScript("bind-session.mjs", ["--root", root, "--session-id", "driver-session", "--slug", slug, "--mode", "implementation"]));

    runHook(root, userPromptPayload(root, "observer-session"));

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bound current session to auto-implementation: observer-session/u);

    const runtime = readJsonFile(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"));
    assert.equal(runtime.mode, "implementation");
    assert.equal(runtime.implementation_loop.driver_session_id, "driver-session");

    const marker = runHook(root, userPromptPayload(root, "observer-session"));
    assert.equal(
      JSON.parse(marker.stdout).hookSpecificOutput.additionalContext,
      `[epic-loop] epic=${slug} mode=implementation — loop running in another session; read-only, do not edit epic artifacts`,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session skips unsafe Codex current-session captures without failing", () => {
  const cases = [
    {
      name: "stop-event",
      payload: (root) => ({
        cwd: root,
        hook_event_name: "Stop",
        session_id: "stop-session",
        turn_id: "turn-stop",
      }),
    },
    {
      name: "wrong-root",
      payload: (root) => ({
        cwd: path.join(root, "other"),
        hook_event_name: "UserPromptSubmit",
        session_id: "wrong-root-session",
        turn_id: "turn-wrong-root",
      }),
    },
  ];

  for (const testCase of cases) {
    const root = makeTempRoot(`auto-bind-codex-${testCase.name}-`);
    const slug = testCase.name === "stop-event" ? "auto-stop" : "auto-wrong";

    try {
      assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", `Auto ${testCase.name} project`, "--slug", slug, "--no-gitignore"]));
      assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

      runHook(root, testCase.payload(root));

      const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
      assertSuccess(bind);
      assert.match(bind.stdout, new RegExp(`Auto-bind skipped for ${slug}: no fresh UserPromptSubmit capture`, "u"));
      assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  }
});

test("auto-bind-session skips stale Codex captures without using transcript fallback", () => {
  const root = makeTempRoot("auto-bind-codex-stale-");
  const slug = "auto-stale";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto stale project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "codex", "--json"]));

    const capturePath = path.join(root, ".codex", "tmp", "last-hook-capture.json");
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(
      capturePath,
      `${JSON.stringify(
        {
          capturedAt: "2000-01-01T00:00:00+00:00",
          payload: userPromptPayload(root, "stale-session"),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bind skipped for auto-stale: no fresh UserPromptSubmit capture/u);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session supports fresh Claude Code UserPromptSubmit captures", () => {
  const root = makeTempRoot("auto-bind-claude-");
  const slug = "auto-claude";
  const transcriptPath = path.join(root, "transcript.jsonl");

  try {
    fs.writeFileSync(transcriptPath, "{\"type\":\"assistant\",\"message\":{\"content\":\"ready\"}}\n", "utf8");
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto Claude project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    runHook(root, userPromptPayload(root, "claude-auto-session", { transcript_path: transcriptPath }));

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bound current session to auto-claude: claude-auto-session/u);

    const bindings = readJsonFile(path.join(root, ".epic-loop", ".runtime", "session-bindings.json"));
    assert.equal(bindings.sessions["claude-auto-session"].source, "current-claude-code-session");
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("auto-bind-session skips Claude Code captures without transcript paths", () => {
  const root = makeTempRoot("auto-bind-claude-missing-transcript-");
  const slug = "auto-claude";

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Auto Claude missing project", "--slug", slug, "--no-gitignore"]));
    assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));

    const capturePath = path.join(root, ".epic-loop", ".runtime", "claude-code-last-hook-capture.json");
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(
      capturePath,
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          payload: {
            cwd: root,
            hook_event_name: "UserPromptSubmit",
            session_id: "claude-missing-transcript",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const bind = runNodeScript("auto-bind-session.mjs", ["--root", root, "--current", "--slug", slug]);
    assertSuccess(bind);
    assert.match(bind.stdout, /Auto-bind skipped for auto-claude: no fresh UserPromptSubmit capture/u);
    assert.equal(fs.existsSync(path.join(root, ".epic-loop", ".runtime", "session-bindings.json")), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("platform-aware CLIs reject missing or invalid runtime platform config", () => {
  const root = makeTempRoot("platform-aware-");

  try {
    const installMissing = runNodeScript("install-hooks.mjs", ["--root", root]);
    assert.equal(installMissing.status, 1);
    assert.match(installMissing.stderr, /doctor\.mjs --platform codex\|claude-code --json/u);

    fs.mkdirSync(path.join(root, ".epic-loop", ".runtime"), { recursive: true });
    fs.writeFileSync(path.join(root, ".epic-loop", ".runtime", "platform.json"), "{\"platform\":\"auto\"}\n", "utf8");

    const doctorMissing = runNodeScript("doctor.mjs", ["--root", root, "--json"]);
    assert.equal(doctorMissing.status, 1);
    assert.match(doctorMissing.stderr, /Missing required --platform/u);
    assert.match(doctorMissing.stderr, /doctor\.mjs --platform codex\|claude-code --json/u);

    const doctorInvalid = runNodeScript("doctor.mjs", ["--root", root, "--platform", "auto", "--json"]);
    assert.equal(doctorInvalid.status, 1);
    assert.match(doctorInvalid.stderr, /Invalid --platform "auto"/u);

    const hookInvalid = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        session_id: "invalid-platform-session",
      }),
    });
    assert.equal(hookInvalid.status, 1);
    assert.match(hookInvalid.stderr, /doctor\.mjs --platform codex\|claude-code --json/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
