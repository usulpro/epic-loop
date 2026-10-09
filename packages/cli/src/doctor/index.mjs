// `epic-loop doctor`: hook readiness, epic state compatibility, and skill version/update
// status. The readiness checks are a port of `doctor` from
// plugins/epic-loop/skills/epic-loop/scripts/lib/hooks.mjs, targeting an explicit skill
// directory instead of the module's own location.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import { readConfig } from "../config.mjs";
import { runCliVersion } from "../invoke.mjs";
import { readCliVersion } from "../paths.mjs";
import { requireSkill, updateCommandFor } from "../skill.mjs";
import { checkLatestVersion, isNewerVersion } from "../update-check.mjs";
import { canReadPath, canWritePath, formatList, platformConfigPath, sessionRoot, writeRuntimePlatform } from "./common.mjs";
import { inspectAndRepairEpicCompatibility } from "./hook-compatibility.mjs";
import { buildInstallHooksCommand, hookScriptPath, inspectClaudeHookConfig, inspectClaudeStopHookBlockCap, inspectCodexHooksFeature, inspectHookConfig } from "./hook-config.mjs";

const PLATFORM_SETUP_COMMAND = "epic-loop doctor --platform codex|claude-code --json";

export async function runDoctor(flags = {}, { argv = [], env = process.env } = {}) {
  const root = path.resolve(typeof flags.root === "string" ? flags.root : ".");
  if (typeof flags.platform !== "string") {
    throw new Error(`Missing required --platform. Run: ${PLATFORM_SETUP_COMMAND}`);
  }

  const platformConfig = writeRuntimePlatform(root, flags.platform);
  const skill = requireSkill({ env, flags, platform: platformConfig.platform, root });
  const cliVersion = readCliVersion();
  const update = await evaluateUpdate(root, skill, env);

  if (update.action === "auto-update") {
    const reexec = autoUpdate(skill, update, argv, env);
    if (reexec.done) {
      return reexec.status;
    }
    update.action = "failed";
    update.error = reexec.error;
  }

  const context = { cliVersion, flags, platformConfig, root, skill, update };
  if (platformConfig.platform === "claude-code") {
    doctorClaudeCode(context);
  } else {
    doctorCodex(context);
  }
  return 0;
}

async function evaluateUpdate(root, skill, env) {
  const autoupdate = readConfig(root).autoupdate;
  const result = await checkLatestVersion(root, env);
  // A copy without a version predates the wrapper, so any published version is newer.
  const available = result.checked && (skill.version === null || isNewerVersion(result.latest, skill.version));
  const update = {
    autoupdate,
    available,
    checked: result.checked,
    command: available ? updateCommandFor(skill, result.latest) : null,
    current: skill.version,
    latest: result.latest,
    reason: result.reason,
    action: available ? "notify" : "none",
  };

  if (env.EPIC_LOOP_UPDATED_FROM) {
    update.action = "applied";
    update.from = env.EPIC_LOOP_UPDATED_FROM;
    return update;
  }

  if (available && autoupdate && skill.installType === "copy" && env.EPIC_LOOP_SKIP_AUTOUPDATE !== "1") {
    update.action = "auto-update";
  }
  return update;
}

// Installs the latest version over the local skill copy, then hands off to the
// freshly installed version's doctor so state checks run against the new schema.
function autoUpdate(skill, update, argv, env) {
  const result = runCliVersion(update.latest, ["update", "--skill-dir", skill.dir, "--json"], { env });
  if (result.status !== 0) {
    return { done: false, error: (result.stderr || result.error?.message || "update failed").trim() };
  }

  const rerun = spawnSync(process.execPath, [path.join(skill.dir, "scripts", "epic-loop.mjs"), ...argv], {
    env: { ...env, EPIC_LOOP_SKIP_AUTOUPDATE: "1", EPIC_LOOP_UPDATED_FROM: skill.version ?? "unknown" },
    stdio: "inherit",
  });
  return { done: true, status: rerun.status ?? 1 };
}

function versionWarnings({ cliVersion, skill }) {
  if (skill.version === null) {
    return [`The skill at ${skill.dir} predates versioned skills; update it to ${cliVersion}.`];
  }
  if (skill.version !== cliVersion) {
    return [`Skill version ${skill.version} does not match CLI version ${cliVersion}; run doctor through ${path.join(skill.dir, "scripts", "epic-loop.mjs")}.`];
  }
  return [];
}

function sharedStatus({ cliVersion, skill, update }) {
  return {
    cli: { version: cliVersion },
    skill,
    update,
  };
}

function printSharedLines({ cliVersion, skill, update }) {
  console.log(`Skill: ${skill.dir} (${skill.installType}, v${skill.version ?? "unknown"})`);
  console.log(`CLI version: ${cliVersion}`);

  if (update.action === "applied") {
    console.log(`Update: applied ${update.from} -> ${skill.version}; re-read SKILL.md before continuing.`);
  } else if (update.action === "failed") {
    console.log(`Update: ${update.latest} available, automatic update failed (${update.error}). Run: ${update.command}`);
  } else if (update.available) {
    console.log(`Update: ${update.latest} available. Run: ${update.command}`);
  } else {
    console.log(`Update: ${update.checked ? "up to date" : `not checked (${update.reason})`}`);
  }
}

function doctorCodex(context) {
  const { flags, platformConfig, root, skill } = context;
  const hookScript = hookScriptPath(skill.dir);
  const hookConfig = inspectHookConfig(root, skill.dir);
  const feature = inspectCodexHooksFeature(root);
  const runtimeWritable = canWritePath(sessionRoot(root));
  const scriptReadable = canReadPath(hookScript);
  const epicCompatibility = inspectAndRepairEpicCompatibility(root);
  const ready = hookConfig.ready && !hookConfig.invalid && feature.enabled === true && runtimeWritable.ok && scriptReadable.ok && epicCompatibility.ready;
  const setupPossible = !hookConfig.invalid && hookConfig.writable.ok;
  const warnings = versionWarnings(context);
  const status = {
    ...sharedStatus(context),
    codexHooksFeature: feature,
    command: hookConfig.command,
    epicCompatibility,
    hookConfig: {
      exists: hookConfig.exists,
      invalid: hookConfig.invalid,
      missingEvents: hookConfig.missingEvents,
      path: hookConfig.hooksPath,
      staleEvents: hookConfig.staleEvents,
      writable: hookConfig.writable,
    },
    hookTarget: {
      exists: fs.existsSync(hookScript),
      path: hookScript,
      readable: scriptReadable,
    },
    platform: "codex",
    platformConfig: {
      path: platformConfigPath(root),
      valid: true,
      value: platformConfig.platform,
    },
    projectRoot: root,
    ready,
    runtimeState: {
      path: sessionRoot(root),
      writable: runtimeWritable,
    },
    setupPossible,
    status: ready ? "ready" : "setup-required",
    warnings,
  };

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Epic-loop hook readiness: ${ready ? "ready" : "setup-required"}`);
  console.log(`Project root: ${root}`);
  printSharedLines(context);
  console.log(`Hook config: ${hookConfig.exists ? hookConfig.hooksPath : `${hookConfig.hooksPath} (missing)`}`);
  console.log(`Hook command: ${hookConfig.command}`);
  console.log(`Required events missing: ${formatList(hookConfig.missingEvents)}`);
  console.log(`Stale epic-loop hook entries: ${formatList(hookConfig.staleEvents)}`);
  console.log(`Epic compatibility: ${epicCompatibility.ready ? "ready" : "repair-required"}`);
  console.log(`Epic compatibility repairs: ${formatList(epicCompatibility.repaired.map((repair) => `${repair.slug}:${repair.type}`))}`);
  console.log(`Epic compatibility invalid: ${formatList(epicCompatibility.invalid.map((issue) => `${issue.slug}:${issue.type}`))}`);
  console.log(`Hook config writable: ${hookConfig.writable.ok ? "yes" : `no (${hookConfig.writable.reason})`}`);
  console.log(`Runtime state writable: ${runtimeWritable.ok ? "yes" : `no (${runtimeWritable.reason})`}`);

  if (feature.enabled === true) {
    console.log(`Codex hooks feature: enabled via ${feature.scope} config ${feature.source}`);
  } else if (feature.enabled === false) {
    console.log(`Codex hooks feature: disabled via ${feature.scope} config ${feature.source}`);
  } else {
    console.log("Codex hooks feature: unknown; add hooks = true under [features] in the active Codex config/profile.");
  }

  console.log(`Hook target exists: ${fs.existsSync(hookScript) ? "yes" : "no"}`);
  console.log(`Hook target readable: ${scriptReadable.ok ? "yes" : `no (${scriptReadable.reason})`}`);
  console.log(`Runtime platform: codex (${platformConfigPath(root)})`);
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }

  if (ready) {
    console.log("Next: continue epic-loop lifecycle setup.");
    return;
  }

  if (setupPossible) {
    console.log("Next: ask the user for approval, then run:");
    console.log(`  ${buildInstallHooksCommand(skill.dir)}`);
    console.log("Preview without writing:");
    console.log(`  ${buildInstallHooksCommand(skill.dir, " --dry-run")}`);
    return;
  }

  console.log("Next: setup must be run from a writable project checkout or host terminal:");
  console.log(`  ${buildInstallHooksCommand(skill.dir)}`);
}

function doctorClaudeCode(context) {
  const { flags, platformConfig, root, skill } = context;
  const hookScript = hookScriptPath(skill.dir);
  const hookConfig = inspectClaudeHookConfig(root, skill.dir);
  const blockCap = inspectClaudeStopHookBlockCap();
  const runtimeWritable = canWritePath(sessionRoot(root));
  const scriptReadable = canReadPath(hookScript);
  const epicCompatibility = inspectAndRepairEpicCompatibility(root);
  const ready = hookConfig.ready && !hookConfig.invalid && blockCap.ready && runtimeWritable.ok && scriptReadable.ok && epicCompatibility.ready;
  const setupPossible = !hookConfig.invalid && hookConfig.writable.ok;
  const warnings = [...(blockCap.warning ? [blockCap.warning] : []), ...versionWarnings(context)];
  const status = {
    ...sharedStatus(context),
    claudeCodeHookConfig: {
      error: hookConfig.error,
      exists: hookConfig.exists,
      invalid: hookConfig.invalid,
      missingEvents: hookConfig.missingEvents,
      path: hookConfig.path,
      ready: hookConfig.ready,
      staleEvents: hookConfig.staleEvents,
      writable: hookConfig.writable,
    },
    command: hookConfig.command,
    epicCompatibility,
    hookTarget: {
      exists: fs.existsSync(hookScript),
      path: hookScript,
      readable: scriptReadable,
    },
    platform: "claude-code",
    platformConfig: {
      path: platformConfigPath(root),
      valid: true,
      value: platformConfig.platform,
    },
    projectRoot: root,
    ready,
    runtimeState: {
      path: sessionRoot(root),
      writable: runtimeWritable,
    },
    setupPossible,
    status: ready ? "ready" : "setup-required",
    stopHookBlockCap: blockCap,
    warnings,
  };

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Epic-loop hook readiness: ${ready ? "ready" : "setup-required"}`);
  console.log(`Project root: ${root}`);
  printSharedLines(context);
  console.log(`Runtime platform: claude-code (${platformConfigPath(root)})`);
  console.log(`Hook command: ${hookConfig.command}`);
  console.log(`Claude Code settings: ${hookConfig.exists ? hookConfig.path : `${hookConfig.path} (missing)`}`);
  console.log(`Required events missing: ${formatList(hookConfig.missingEvents)}`);
  console.log(`Stale epic-loop hook entries: ${formatList(hookConfig.staleEvents)}`);
  console.log(`Epic compatibility: ${epicCompatibility.ready ? "ready" : "repair-required"}`);
  console.log(`Epic compatibility repairs: ${formatList(epicCompatibility.repaired.map((repair) => `${repair.slug}:${repair.type}`))}`);
  console.log(`Epic compatibility invalid: ${formatList(epicCompatibility.invalid.map((issue) => `${issue.slug}:${issue.type}`))}`);
  console.log(`Claude Code settings writable: ${hookConfig.writable.ok ? "yes" : `no (${hookConfig.writable.reason})`}`);
  console.log(`Runtime state writable: ${runtimeWritable.ok ? "yes" : `no (${runtimeWritable.reason})`}`);
  console.log(`Hook target exists: ${fs.existsSync(hookScript) ? "yes" : "no"}`);
  console.log(`Hook target readable: ${scriptReadable.ok ? "yes" : `no (${scriptReadable.reason})`}`);
  console.log(
    `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: ${blockCap.ready ? `${blockCap.value}${blockCap.recommended ? "" : " (accepted with warning)"}` : `setup-required (${blockCap.reason})`}`,
  );
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }

  if (ready) {
    console.log("Next: continue epic-loop lifecycle setup.");
    return;
  }

  if (setupPossible) {
    console.log(hookConfig.ready ? "Next: set the Stop-hook block cap (hooks are already installed):" : "Next: configure Claude Code hooks and block cap:");
    if (!hookConfig.ready) {
      console.log(`  ${buildInstallHooksCommand(skill.dir)}`);
    }
    if (!blockCap.ready) {
      console.log("  export CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0");
    }
    return;
  }

  console.log("Next: setup must be run from a writable project checkout or host terminal:");
  console.log(`  ${buildInstallHooksCommand(skill.dir)}`);
}
