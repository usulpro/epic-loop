import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript } from "./test-utils.mjs";

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

    const after = runNodeScript("doctor.mjs", ["--root", root, "--json"]);
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
    const result = runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]);
    assertSuccess(result);
    const status = JSON.parse(result.stdout);
    assert.equal(status.platform, "claude-code");
    assert.equal(status.ready, false);
    assert.equal(status.status, "setup-required");
    assert.match(status.claudeCodeHookConfig.path, /\.claude\/settings\.json$/u);
    assert.equal(readJsonFile(path.join(root, ".epic-loop", ".runtime", "platform.json")).platform, "claude-code");
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
    assert.match(claudeCurrent.stderr, /Cannot detect current Claude Code session yet\. Pass --session-id explicitly\./u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});
