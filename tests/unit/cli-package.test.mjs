import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { assertSuccess, makeTempRoot, readJsonFile, repoRoot } from "./test-utils.mjs";

const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const repoSkillDir = path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop");
const cliVersion = readJsonFile(path.join(repoRoot, "packages", "cli", "package.json")).version;

function baseEnv(home, extra = {}) {
  const env = { ...process.env, EPIC_LOOP_CLI: cliEntry, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: home, ...extra };
  for (const key of ["EPIC_LOOP_SKILL_DIR", "EPIC_LOOP_SKILL_VERSION", "EPIC_LOOP_UPDATED_FROM", "EPIC_LOOP_SKIP_AUTOUPDATE", "EPIC_LOOP_REGISTRY_URL"]) {
    if (!(key in extra)) {
      delete env[key];
    }
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) {
      delete env[key];
    }
  }
  return env;
}

function runCli(args, { cwd, env }) {
  return spawnSync(process.execPath, [cliEntry, ...args], { cwd, encoding: "utf8", env });
}

function runWrapper(skillDir, args, { cwd, env }) {
  return spawnSync(process.execPath, [path.join(skillDir, "scripts", "epic-loop.mjs"), ...args], { cwd, encoding: "utf8", env });
}

function copySkill(targetDir, version) {
  fs.cpSync(repoSkillDir, targetDir, { recursive: true });
  if (version) {
    const wrapperPath = path.join(targetDir, "scripts", "epic-loop.mjs");
    const wrapper = fs.readFileSync(wrapperPath, "utf8").replace(/^const SKILL_VERSION = "[^"]+";$/mu, `const SKILL_VERSION = "${version}";`);
    fs.writeFileSync(wrapperPath, wrapper, "utf8");
  }
}

function seedUpdateCache(root, latest, registry) {
  const cachePath = path.join(root, ".epic-loop", ".runtime", "update-check.json");
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ checked_at: new Date().toISOString(), latest, registry }), "utf8");
}

test("skill wrapper runs the CLI with its own skill directory and pinned version", () => {
  const root = makeTempRoot("cli-wrapper");
  const result = runWrapper(repoSkillDir, ["doctor", "--platform", "claude-code", "--json"], { cwd: root, env: baseEnv(root) });
  assertSuccess(result);

  const status = JSON.parse(result.stdout);
  assert.equal(status.projectRoot, root);
  assert.deepEqual(status.skill, { dir: repoSkillDir, installType: "copy", source: "env", version: cliVersion });
  assert.equal(status.hookTarget.path, path.join(repoSkillDir, "scripts", "hook.mjs"));
  assert.equal(status.command, `node '${path.join(repoSkillDir, "scripts", "hook.mjs")}' --root '${root}'`);
  assert.equal(status.update.reason, "disabled");
  assert.deepEqual(status.warnings, []);
  assert.equal(readJsonFile(path.join(root, ".epic-loop", ".runtime", "platform.json")).platform, "claude-code");
});

test("cli doctor requires --platform and a locatable skill", () => {
  const root = makeTempRoot("cli-doctor-errors");
  const missingPlatform = runCli(["doctor", "--json"], { cwd: root, env: baseEnv(root) });
  assert.equal(missingPlatform.status, 1);
  assert.match(missingPlatform.stderr, /Missing required --platform/u);

  const missingSkill = runCli(["doctor", "--platform", "codex", "--json"], { cwd: root, env: baseEnv(root) });
  assert.equal(missingSkill.status, 1);
  assert.match(missingSkill.stderr, /Cannot locate the epic-loop skill/u);
});

test("cli doctor discovers a project-local skill copy for the selected platform", () => {
  const root = makeTempRoot("cli-doctor-discovery");
  const skillDir = path.join(root, ".codex", "skills", "epic-loop");
  copySkill(skillDir);

  const result = runCli(["doctor", "--platform", "codex", "--json"], { cwd: root, env: baseEnv(root) });
  assertSuccess(result);
  const status = JSON.parse(result.stdout);
  assert.equal(status.skill.dir, skillDir);
  assert.equal(status.skill.source, "discovered");
  assert.equal(status.command, `node '${path.join(skillDir, "scripts", "hook.mjs")}'`);
});

test("cli doctor warns when the skill version does not match the CLI", () => {
  const root = makeTempRoot("cli-doctor-mismatch");
  const skillDir = path.join(root, ".claude", "skills", "epic-loop");
  copySkill(skillDir, "0.0.1");

  const result = runCli(["doctor", "--platform", "claude-code", "--json"], { cwd: root, env: baseEnv(root) });
  assertSuccess(result);
  const status = JSON.parse(result.stdout);
  assert.equal(status.skill.version, "0.0.1");
  assert.match(status.warnings.join("\n"), /Skill version 0\.0\.1 does not match CLI version/u);
});

test("cli install copies the skill, selects the platform, and installs hooks", () => {
  const root = makeTempRoot("cli-install");
  const env = baseEnv(root);
  const result = runCli(["install", "--platform", "claude-code"], { cwd: root, env });
  assertSuccess(result);

  const skillDir = path.join(root, ".claude", "skills", "epic-loop");
  assert.match(result.stdout, new RegExp(`Installed epic-loop skill ${cliVersion.replaceAll(".", "\\.")}`, "u"));
  assert.ok(fs.existsSync(path.join(skillDir, "SKILL.md")));
  assert.ok(!fs.existsSync(path.join(skillDir, ".runtime")));
  assert.equal(readJsonFile(path.join(root, ".epic-loop", ".runtime", "platform.json")).platform, "claude-code");

  const settings = readJsonFile(path.join(root, ".claude", "settings.json"));
  assert.equal(settings.hooks.Stop[0].hooks[0].command, `node '${path.join(skillDir, "scripts", "hook.mjs")}' --root '${root}'`);
  assert.match(result.stdout, /Required events missing: none/u);

  const again = runCli(["install", "--platform", "claude-code", "--no-hooks"], { cwd: root, env });
  assertSuccess(again);
  assert.match(again.stdout, /already installed/u);
});

test("cli update replaces a stale local copy atomically and keeps its .runtime", () => {
  const root = makeTempRoot("cli-update");
  const skillDir = path.join(root, ".claude", "skills", "epic-loop");
  copySkill(skillDir, "0.0.1");
  fs.writeFileSync(path.join(skillDir, "stale-file.md"), "from an older release\n", "utf8");
  fs.mkdirSync(path.join(skillDir, ".runtime"));
  fs.writeFileSync(path.join(skillDir, ".runtime", "trace.json"), "{}\n", "utf8");

  const result = runCli(["update", "--json"], { cwd: root, env: baseEnv(root) });
  assertSuccess(result);
  assert.deepEqual(JSON.parse(result.stdout), { action: "updated", from: "0.0.1", skillDir, to: cliVersion });
  assert.ok(!fs.existsSync(path.join(skillDir, "stale-file.md")));
  assert.ok(fs.existsSync(path.join(skillDir, ".runtime", "trace.json")));
  assert.deepEqual(
    fs.readdirSync(path.dirname(skillDir)).filter((name) => name !== "epic-loop"),
    [],
  );

  const again = runCli(["update", "--json"], { cwd: root, env: baseEnv(root) });
  assertSuccess(again);
  assert.equal(JSON.parse(again.stdout).action, "up-to-date");
});

test("cli update refuses plugin installs and points at the host command", () => {
  const root = makeTempRoot("cli-update-plugin");
  const skillDir = path.join(root, ".claude", "plugins", "cache", "epic-loop", "epic-loop", "0.0.1", "skills", "epic-loop");
  copySkill(skillDir, "0.0.1");

  const result = runCli(["update", "--skill-dir", skillDir], { cwd: root, env: baseEnv(root) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude-plugin install/u);
  assert.match(result.stderr, /claude plugin update epic-loop@epic-loop/u);
});

test("cli config reads and writes machine-local autoupdate", () => {
  const root = makeTempRoot("cli-config");
  fs.mkdirSync(path.join(root, ".epic-loop"));
  const env = baseEnv(root);

  assert.equal(runCli(["config", "get", "autoupdate"], { cwd: root, env }).stdout.trim(), "false");
  assertSuccess(runCli(["config", "set", "autoupdate", "true"], { cwd: root, env }));
  assert.deepEqual(readJsonFile(path.join(root, ".epic-loop", ".runtime", "config.json")), { autoupdate: true });
  assert.equal(runCli(["config", "get", "autoupdate"], { cwd: root, env }).stdout.trim(), "true");

  const invalid = runCli(["config", "set", "autoupdate", "yes"], { cwd: root, env });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Expected true or false/u);
});

test("cli doctor reports an available update with the install-specific command", () => {
  const root = makeTempRoot("cli-update-notify");
  const skillDir = path.join(root, ".claude", "skills", "epic-loop");
  copySkill(skillDir, "0.0.1");
  const registry = "http://registry.invalid";
  seedUpdateCache(root, "9.9.9", registry);

  const result = runWrapper(skillDir, ["doctor", "--platform", "claude-code", "--json"], {
    cwd: root,
    env: baseEnv(root, { EPIC_LOOP_NO_UPDATE_CHECK: undefined, EPIC_LOOP_REGISTRY_URL: registry }),
  });
  assertSuccess(result);
  const { update } = JSON.parse(result.stdout);
  assert.equal(update.action, "notify");
  assert.equal(update.available, true);
  assert.equal(update.latest, "9.9.9");
  assert.equal(update.reason, "cache");
  assert.equal(update.command, `npx --yes epic-loop@9.9.9 update --skill-dir '${skillDir}'`);
});

test("cli doctor auto-updates a local copy when autoupdate is enabled, then reruns as the new version", () => {
  const root = makeTempRoot("cli-autoupdate");
  const skillDir = path.join(root, ".claude", "skills", "epic-loop");
  copySkill(skillDir, "0.0.1");
  const registry = "http://registry.invalid";
  seedUpdateCache(root, "9.9.9", registry);
  const env = baseEnv(root, { EPIC_LOOP_NO_UPDATE_CHECK: undefined, EPIC_LOOP_REGISTRY_URL: registry });
  assertSuccess(runCli(["config", "set", "autoupdate", "true"], { cwd: root, env }));

  const result = runWrapper(skillDir, ["doctor", "--platform", "claude-code", "--json"], { cwd: root, env });
  assertSuccess(result);
  const status = JSON.parse(result.stdout);
  assert.equal(status.update.action, "applied");
  assert.equal(status.update.from, "0.0.1");
  assert.equal(status.skill.version, cliVersion);
  assert.match(fs.readFileSync(path.join(skillDir, "scripts", "epic-loop.mjs"), "utf8"), new RegExp(`SKILL_VERSION = "${cliVersion.replaceAll(".", "\\.")}"`, "u"));
});

test("cli doctor fetches the latest version from the registry and caches it", async () => {
  const root = makeTempRoot("cli-registry");
  const skillDir = path.join(root, ".codex", "skills", "epic-loop");
  copySkill(skillDir);
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    assert.equal(request.url, "/epic-loop/latest");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name: "epic-loop", version: cliVersion }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const registry = `http://127.0.0.1:${server.address().port}`;
  const env = baseEnv(root, { EPIC_LOOP_NO_UPDATE_CHECK: undefined, EPIC_LOOP_REGISTRY_URL: registry });

  try {
    const run = () => promisify(execFile)(process.execPath, [cliEntry, "doctor", "--platform", "codex", "--json"], { cwd: root, env });
    const first = JSON.parse((await run()).stdout);
    assert.deepEqual([first.update.checked, first.update.latest, first.update.reason, first.update.available], [true, cliVersion, "registry", false]);

    const second = JSON.parse((await run()).stdout);
    assert.equal(second.update.reason, "cache");
    assert.equal(requests, 1);
  } finally {
    server.close();
  }
});
