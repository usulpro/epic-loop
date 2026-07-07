import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODEX_CONFIG_RELATIVE_PATH,
  CODEX_HOOKS_RELATIVE_PATH,
  HOOK_EVENTS,
  MODES,
  canReadPath,
  canWritePath,
  epicsRoot,
  epicRuntimeRoot,
  eventTimestamp,
  formatList,
  nowIso,
  platformConfigPath,
  platformSetupCommand,
  requireRuntimePlatform,
  readJson,
  readJsonStrict,
  resolveRoot,
  roadmapStatePath,
  runtimeStatePath,
  sessionRoot,
  shellQuote,
  slugify,
  writeHookCapture,
  writeClaudeHookCapture,
  writeJson,
  writeRuntimePlatform,
} from "./common.mjs";
import { markInterruptedTurnIfNeeded, maybeBuildImplementationContinuation } from "./loop.mjs";
import { createInitialRoadmapState } from "./roadmap.mjs";

const CLAUDE_SETTINGS_RELATIVE_PATH = path.join(".claude", "settings.json");
const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.dirname(LIB_DIR);
const HOOK_SCRIPT_PATH = path.join(SCRIPTS_DIR, "hook.mjs");
const INSTALL_HOOKS_SCRIPT_PATH = path.join(SCRIPTS_DIR, "install-hooks.mjs");

export function buildHookCommand() {
  return `node ${shellQuote(HOOK_SCRIPT_PATH)}`;
}

function buildClaudeHookCommand(root) {
  return `${buildHookCommand()} --root ${shellQuote(root)}`;
}

function buildInstallHooksCommand(extraArgs = "") {
  return `node ${shellQuote(INSTALL_HOOKS_SCRIPT_PATH)}${extraArgs}`;
}

function isEpicLoopHookCommand(command) {
  return typeof command === "string" && /epic[-_]loop/u.test(command) && /hook\.mjs|epic-loop\.mjs|epic_loop\.py|\bhook\b/u.test(command);
}

function eventFilename(payload) {
  const eventName = slugify(payload.hook_event_name ?? "unknown");
  const turnId = slugify(payload.turn_id ?? "no-turn");
  return `${eventTimestamp()}-${eventName}-${turnId}.json`;
}

function parseCodexHooksFeature(configPath) {
  if (!fs.existsSync(configPath)) {
    return {
      exists: false,
      value: null,
    };
  }

  const lines = fs.readFileSync(configPath, "utf8").split(/\r?\n/u);
  let currentTable = "";

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/u, "").trim();
    if (!line) {
      continue;
    }

    const tableMatch = line.match(/^\[([^\]]+)\]$/u);
    if (tableMatch) {
      currentTable = tableMatch[1] ?? "";
      continue;
    }

    if (currentTable !== "features") {
      continue;
    }

    const featureMatch = line.match(/^(?:hooks|codex_hooks)\s*=\s*(true|false)\s*$/u);
    if (featureMatch) {
      return {
        exists: true,
        value: featureMatch[1] === "true",
      };
    }
  }

  return {
    exists: true,
    value: null,
  };
}

function inspectCodexHooksFeature(root) {
  const localPath = path.join(root, CODEX_CONFIG_RELATIVE_PATH);
  const globalPath = path.join(process.env.HOME ?? "", ".codex", "config.toml");
  const local = parseCodexHooksFeature(localPath);
  const global = parseCodexHooksFeature(globalPath);

  if (local.value !== null) {
    return {
      enabled: local.value,
      scope: "project",
      source: localPath,
    };
  }

  if (global.value !== null) {
    return {
      enabled: global.value,
      scope: "global",
      source: globalPath,
    };
  }

  return {
    enabled: null,
    scope: null,
    source: null,
  };
}

function normalizeHookDocument(document) {
  return document && typeof document === "object" && !Array.isArray(document) ? document : {};
}

function buildHooksDocument(existingDocument) {
  const normalizedDocument = normalizeHookDocument(existingDocument);
  const hooks = normalizedDocument.hooks && typeof normalizedDocument.hooks === "object" && !Array.isArray(normalizedDocument.hooks) ? normalizedDocument.hooks : {};
  const command = buildHookCommand();
  const changes = [];

  for (const eventName of HOOK_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    let changedEvent = false;
    let exactInstalled = false;

    const normalizedEntries = entries.map((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        return entry;
      }

      const nextHooks = [];

      for (const hook of entry.hooks) {
        if (!hook || typeof hook !== "object") {
          nextHooks.push(hook);
          continue;
        }

        if (hook.command === command) {
          if (exactInstalled) {
            changedEvent = true;
            continue;
          }
          exactInstalled = true;
          nextHooks.push(hook);
          continue;
        }

        if (isEpicLoopHookCommand(hook.command)) {
          changedEvent = true;
          if (!exactInstalled) {
            exactInstalled = true;
            nextHooks.push({
              ...hook,
              command,
              timeout: 30,
              type: "command",
            });
          }
          continue;
        }

        nextHooks.push(hook);
      }

      return {
        ...entry,
        hooks: nextHooks,
      };
    });

    if (!exactInstalled) {
      normalizedEntries.push({
        hooks: [
          {
            command,
            timeout: 30,
            type: "command",
          },
        ],
      });
      changedEvent = true;
    }

    if (changedEvent) {
      changes.push(eventName);
    }

    hooks[eventName] = normalizedEntries;
  }

  normalizedDocument.hooks = hooks;

  return {
    changes,
    command,
    document: normalizedDocument,
  };
}

function buildClaudeSettingsDocument(existingDocument, root) {
  const normalizedDocument = normalizeHookDocument(existingDocument);
  const hooks = normalizedDocument.hooks && typeof normalizedDocument.hooks === "object" && !Array.isArray(normalizedDocument.hooks) ? normalizedDocument.hooks : {};
  const command = buildClaudeHookCommand(root);
  const changes = [];

  for (const eventName of HOOK_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    let changedEvent = false;
    let exactInstalled = false;

    const normalizedEntries = entries.map((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        return entry;
      }

      const nextHooks = [];

      for (const hook of entry.hooks) {
        if (!hook || typeof hook !== "object") {
          nextHooks.push(hook);
          continue;
        }

        if (hook.command === command) {
          if (exactInstalled) {
            changedEvent = true;
            continue;
          }
          exactInstalled = true;
          nextHooks.push(hook);
          continue;
        }

        if (isEpicLoopHookCommand(hook.command)) {
          changedEvent = true;
          if (!exactInstalled) {
            exactInstalled = true;
            nextHooks.push({
              ...hook,
              command,
              timeout: 30,
              type: "command",
            });
          }
          continue;
        }

        nextHooks.push(hook);
      }

      return {
        ...entry,
        hooks: nextHooks,
      };
    });

    if (!exactInstalled) {
      normalizedEntries.push({
        matcher: "",
        hooks: [
          {
            command,
            timeout: 30,
            type: "command",
          },
        ],
      });
      changedEvent = true;
    }

    if (changedEvent) {
      changes.push(eventName);
    }

    hooks[eventName] = normalizedEntries;
  }

  normalizedDocument.hooks = hooks;

  return {
    changes,
    command,
    document: normalizedDocument,
  };
}

function inspectHookConfig(root) {
  const hooksPath = path.join(root, CODEX_HOOKS_RELATIVE_PATH);
  const strict = readJsonStrict(hooksPath);
  const writable = canWritePath(hooksPath);
  const command = buildHookCommand();

  if (strict.error) {
    return {
      command,
      exists: strict.exists,
      hooksPath,
      invalid: true,
      missingEvents: HOOK_EVENTS,
      ready: false,
      staleEvents: [],
      writable,
    };
  }

  const document = normalizeHookDocument(strict.value);
  const hooks = document.hooks && typeof document.hooks === "object" && !Array.isArray(document.hooks) ? document.hooks : {};
  const missingEvents = [];
  const staleEvents = [];

  for (const eventName of HOOK_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    const commands = entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        return [];
      }
      return entry.hooks.map((hook) => hook?.command).filter((value) => typeof value === "string");
    });

    if (!commands.includes(command)) {
      missingEvents.push(eventName);
    }

    if (commands.some((value) => isEpicLoopHookCommand(value) && value !== command)) {
      staleEvents.push(eventName);
    }
  }

  return {
    command,
    exists: strict.exists,
    hooksPath,
    invalid: false,
    missingEvents,
    ready: missingEvents.length === 0 && staleEvents.length === 0,
    staleEvents,
    writable,
  };
}

function inspectClaudeHookConfig(root) {
  const settingsPath = path.join(root, CLAUDE_SETTINGS_RELATIVE_PATH);
  const strict = readJsonStrict(settingsPath);
  const writable = canWritePath(settingsPath);
  const command = buildClaudeHookCommand(root);

  if (strict.error) {
    return {
      command,
      error: strict.error,
      exists: strict.exists,
      invalid: true,
      missingEvents: HOOK_EVENTS,
      path: settingsPath,
      ready: false,
      staleEvents: [],
      writable,
    };
  }

  const document = normalizeHookDocument(strict.value);
  const hooks = document.hooks && typeof document.hooks === "object" && !Array.isArray(document.hooks) ? document.hooks : {};
  const missingEvents = [];
  const staleEvents = [];

  for (const eventName of HOOK_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    const commands = entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        return [];
      }
      return entry.hooks.map((hook) => hook?.command).filter((value) => typeof value === "string");
    });

    if (!commands.includes(command)) {
      missingEvents.push(eventName);
    }

    if (commands.some((value) => isEpicLoopHookCommand(value) && value !== command)) {
      staleEvents.push(eventName);
    }
  }

  return {
    command,
    error: null,
    exists: strict.exists,
    invalid: false,
    missingEvents,
    path: settingsPath,
    ready: missingEvents.length === 0 && staleEvents.length === 0,
    staleEvents,
    writable,
  };
}

function inspectClaudeStopHookBlockCap(env = process.env) {
  const envVar = "CLAUDE_CODE_STOP_HOOK_BLOCK_CAP";
  const rawValue = env[envVar];

  if (rawValue === undefined || rawValue === "") {
    return {
      envVar,
      rawValue: rawValue ?? null,
      ready: false,
      reason: "missing",
      recommended: false,
      value: null,
      warning: null,
    };
  }

  if (!/^\d+$/u.test(String(rawValue))) {
    return {
      envVar,
      rawValue,
      ready: false,
      reason: "invalid",
      recommended: false,
      value: null,
      warning: null,
    };
  }

  const value = Number(rawValue);

  if (value !== 0 && value < 20) {
    return {
      envVar,
      rawValue,
      ready: false,
      reason: "below-minimum",
      recommended: false,
      value,
      warning: null,
    };
  }

  if (value >= 20 && value <= 50) {
    return {
      envVar,
      rawValue,
      ready: true,
      reason: null,
      recommended: false,
      value,
      warning: "Loop mode may stop early and require manual continuation when CLAUDE_CODE_STOP_HOOK_BLOCK_CAP is between 20 and 50.",
    };
  }

  return {
    envVar,
    rawValue,
    ready: true,
    reason: null,
    recommended: true,
    value,
    warning: null,
  };
}

function inspectAndRepairEpicCompatibility(root) {
  const epicsDir = epicsRoot(root);
  const result = {
    checked: 0,
    invalid: [],
    repaired: [],
    ready: true,
  };

  if (!fs.existsSync(epicsDir)) {
    return result;
  }

  const bindingModes = readActiveBindingModes(root);

  for (const entry of fs.readdirSync(epicsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const slug = entry.name;
    result.checked += 1;
    const roadmap = inspectAndRepairRoadmapState(root, slug, result);
    inspectAndRepairRuntimeState(root, slug, roadmap, bindingModes.get(slug), result);
  }

  result.ready = result.invalid.length === 0;
  return result;
}

function inspectAndRepairRoadmapState(root, slug, result) {
  const roadmapPath = roadmapStatePath(root, slug);
  const strict = readJsonStrict(roadmapPath);

  if (strict.error) {
    result.invalid.push({
      path: roadmapPath,
      reason: strict.error,
      slug,
      type: "roadmap-state",
    });
    return null;
  }

  if (strict.exists && isPlainObject(strict.value)) {
    return strict.value;
  }

  const roadmap = createInitialRoadmapState({ slug, title: slug });
  writeJson(roadmapPath, roadmap);
  result.repaired.push({
    path: roadmapPath,
    slug,
    type: "created-roadmap-state",
  });
  return roadmap;
}

function inspectAndRepairRuntimeState(root, slug, roadmap, bindingMode, result) {
  const runtimePath = runtimeStatePath(root, slug);
  const strict = readJsonStrict(runtimePath);

  if (strict.error) {
    result.invalid.push({
      path: runtimePath,
      reason: strict.error,
      slug,
      type: "runtime-state",
    });
    return;
  }

  if (!strict.exists) {
    writeJson(runtimePath, buildRuntimeStateFromStructuredData(slug, roadmap, bindingMode));
    result.repaired.push({
      path: runtimePath,
      slug,
      type: "created-runtime-state",
    });
    return;
  }

  if (!isPlainObject(strict.value)) {
    result.invalid.push({
      path: runtimePath,
      reason: "runtime state must be an object",
      slug,
      type: "runtime-state",
    });
    return;
  }

  const mode = typeof strict.value.mode === "string" && MODES.includes(strict.value.mode) ? strict.value.mode : bindingMode ?? null;
  if (!mode) {
    result.invalid.push({
      path: runtimePath,
      reason: "missing mode",
      slug,
      type: "runtime-state",
    });
    return;
  }

  if (strict.value.mode !== mode) {
    writeJson(runtimePath, {
      ...strict.value,
      mode,
      updated_at: nowIso(),
    });
    result.repaired.push({
      path: runtimePath,
      slug,
      type: "repaired-runtime-mode",
    });
  }
}

function buildRuntimeStateFromStructuredData(slug, roadmap, bindingMode) {
  const timestamp = nowIso();
  const normalizedRoadmap = isPlainObject(roadmap) ? roadmap : createInitialRoadmapState({ slug, title: slug });

  return {
    active_phase: formatRoadmapPhase(normalizedRoadmap, normalizedRoadmap.active_phase_id),
    active_task: formatRoadmapTask(normalizedRoadmap, normalizedRoadmap.active_task_id),
    created_at: timestamp,
    description: null,
    execution_brief: null,
    implementation_submode: "techlead",
    mode: bindingMode ?? "shaping",
    slug,
    title: typeof normalizedRoadmap.title === "string" && normalizedRoadmap.title.trim() ? normalizedRoadmap.title.trim() : slug,
    updated_at: timestamp,
  };
}

function readActiveBindingModes(root) {
  const bindingsPath = path.join(sessionRoot(root), "session-bindings.json");
  const bindings = readJson(bindingsPath, {});
  const sessions = isPlainObject(bindings?.sessions) ? bindings.sessions : {};
  const modes = new Map();

  for (const binding of Object.values(sessions)) {
    if (!isPlainObject(binding) || binding.active !== true || typeof binding.epic_slug !== "string" || !MODES.includes(binding.mode)) {
      continue;
    }

    modes.set(binding.epic_slug, binding.mode);
  }

  return modes;
}

function formatRoadmapPhase(roadmap, phaseId) {
  const phases = Array.isArray(roadmap.phases) ? roadmap.phases : [];
  const phase = phases.find((candidate) => candidate?.id === phaseId) ?? phases[0];
  if (!phase) {
    return null;
  }

  const index = phases.indexOf(phase);
  const number = index >= 0 ? index + 1 : 1;
  const title = typeof phase.title === "string" && phase.title.trim() ? phase.title.trim() : `Phase ${number}`;
  return `Phase ${number} - ${title}`;
}

function formatRoadmapTask(roadmap, taskId) {
  if (typeof taskId !== "string" || !taskId) {
    return null;
  }

  const phases = Array.isArray(roadmap.phases) ? roadmap.phases : [];
  for (const phase of phases) {
    const tasks = Array.isArray(phase?.tasks) ? phase.tasks : [];
    const task = tasks.find((candidate) => candidate?.id === taskId);
    if (task) {
      return typeof task.title === "string" && task.title.trim() ? task.title.trim() : task.id;
    }
  }

  return null;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function doctor(flags = {}) {
  const root = resolveRoot(flags.root);
  if (typeof flags.platform !== "string") {
    throw new Error(`Missing required --platform. Run: ${platformSetupCommand()}`);
  }

  const platformConfig = writeRuntimePlatform(root, flags.platform);
  const platform = platformConfig.platform;

  if (!platform) {
    throw new Error(`Runtime platform is not configured. Run: ${platformSetupCommand()}`);
  }

  if (platform === "claude-code") {
    doctorClaudeCode(root, platformConfig, flags);
    return;
  }

  doctorCodex(root, platformConfig, flags);
}

function doctorCodex(root, platformConfig, flags = {}) {
  const hookConfig = inspectHookConfig(root);
  const feature = inspectCodexHooksFeature(root);
  const runtimeWritable = canWritePath(sessionRoot(root));
  const scriptReadable = canReadPath(HOOK_SCRIPT_PATH);
  const epicCompatibility = inspectAndRepairEpicCompatibility(root);
  const ready = hookConfig.ready && !hookConfig.invalid && feature.enabled === true && runtimeWritable.ok && scriptReadable.ok && epicCompatibility.ready;
  const setupPossible = !hookConfig.invalid && hookConfig.writable.ok;
  const status = {
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
      exists: fs.existsSync(HOOK_SCRIPT_PATH),
      path: HOOK_SCRIPT_PATH,
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
  };

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Epic-loop hook readiness: ${ready ? "ready" : "setup-required"}`);
  console.log(`Project root: ${root}`);
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

  console.log(`Hook target exists: ${fs.existsSync(HOOK_SCRIPT_PATH) ? "yes" : "no"}`);
  console.log(`Hook target readable: ${scriptReadable.ok ? "yes" : `no (${scriptReadable.reason})`}`);
  console.log(`Runtime platform: codex (${platformConfigPath(root)})`);

  if (ready) {
    console.log("Next: continue epic-loop lifecycle setup.");
    return;
  }

  if (setupPossible) {
    console.log("Next: ask the user for approval, then run:");
    console.log(`  ${buildInstallHooksCommand()}`);
    console.log("Preview without writing:");
    console.log(`  ${buildInstallHooksCommand(" --dry-run")}`);
    return;
  }

  console.log("Next: setup must be run from a writable project checkout or host terminal:");
  console.log(`  ${buildInstallHooksCommand()}`);
}

function doctorClaudeCode(root, platformConfig, flags = {}) {
  const hookConfig = inspectClaudeHookConfig(root);
  const blockCap = inspectClaudeStopHookBlockCap();
  const runtimeWritable = canWritePath(sessionRoot(root));
  const scriptReadable = canReadPath(HOOK_SCRIPT_PATH);
  const epicCompatibility = inspectAndRepairEpicCompatibility(root);
  const ready = hookConfig.ready && !hookConfig.invalid && blockCap.ready && runtimeWritable.ok && scriptReadable.ok && epicCompatibility.ready;
  const setupPossible = !hookConfig.invalid && hookConfig.writable.ok;
  const status = {
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
      exists: fs.existsSync(HOOK_SCRIPT_PATH),
      path: HOOK_SCRIPT_PATH,
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
    warnings: blockCap.warning ? [blockCap.warning] : [],
  };

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Epic-loop hook readiness: ${ready ? "ready" : "setup-required"}`);
  console.log(`Project root: ${root}`);
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
  console.log(`Hook target exists: ${fs.existsSync(HOOK_SCRIPT_PATH) ? "yes" : "no"}`);
  console.log(`Hook target readable: ${scriptReadable.ok ? "yes" : `no (${scriptReadable.reason})`}`);
  console.log(
    `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: ${
      blockCap.ready ? `${blockCap.value}${blockCap.recommended ? "" : " (accepted with warning)"}` : `setup-required (${blockCap.reason})`
    }`,
  );
  if (blockCap.warning) {
    console.log(`Warning: ${blockCap.warning}`);
  }

  if (ready) {
    console.log("Next: continue epic-loop lifecycle setup.");
    return;
  }

  if (setupPossible) {
    console.log("Next: configure Claude Code hooks and block cap:");
    console.log(`  ${buildInstallHooksCommand()}`);
    console.log("  export CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0");
    return;
  }

  console.log("Next: setup must be run from a writable project checkout or host terminal:");
  console.log(`  ${buildInstallHooksCommand()}`);
}

export function installHooks(flags = {}) {
  const root = resolveRoot(flags.root);
  const platform = requireRuntimePlatform(root);

  if (platform === "claude-code") {
    installClaudeHooks(root, flags);
    return;
  }

  const hooksPath = path.join(root, CODEX_HOOKS_RELATIVE_PATH);
  const strict = readJsonStrict(hooksPath);

  if (strict.error) {
    throw new Error(`Cannot update invalid JSON in ${hooksPath}: ${strict.error}`);
  }

  const next = buildHooksDocument(strict.value ?? {});

  if (flags["dry-run"]) {
    console.log(`Dry run: ${hooksPath}`);
    console.log(`Hook command: ${next.command}`);
    console.log(`Events that would change: ${formatList(next.changes)}`);
    console.log(JSON.stringify(next.document, null, 2));
    return;
  }

  if (next.changes.length === 0) {
    console.log(`Epic-loop hooks already installed: ${hooksPath}`);
    console.log("Requires hooks = true under [features] in the active Codex config/profile.");
    return;
  }

  const writable = canWritePath(hooksPath);
  if (!writable.ok) {
    throw new Error(`Cannot write ${hooksPath}: ${writable.reason}`);
  }

  writeJson(hooksPath, next.document);

  console.log(`Installed project-local epic-loop hooks: ${hooksPath}`);
  console.log("Requires hooks = true under [features] in the active Codex config/profile.");
}

function installClaudeHooks(root, flags = {}) {
  const settingsPath = path.join(root, CLAUDE_SETTINGS_RELATIVE_PATH);
  const strict = readJsonStrict(settingsPath);

  if (strict.error) {
    throw new Error(`Cannot update invalid JSON in ${settingsPath}: ${strict.error}`);
  }

  const next = buildClaudeSettingsDocument(strict.value ?? {}, root);

  if (flags["dry-run"]) {
    console.log(`Dry run: ${settingsPath}`);
    console.log(`Hook command: ${next.command}`);
    console.log(`Events that would change: ${formatList(next.changes)}`);
    console.log(JSON.stringify(next.document, null, 2));
    return;
  }

  if (next.changes.length === 0) {
    console.log(`Claude Code epic-loop hooks already installed: ${settingsPath}`);
    return;
  }

  const writable = canWritePath(settingsPath);
  if (!writable.ok) {
    throw new Error(`Cannot write ${settingsPath}: ${writable.reason}`);
  }

  writeJson(settingsPath, next.document);

  console.log(`Installed project-local Claude Code epic-loop hooks: ${settingsPath}`);
}

const MODE_REMINDER_TEXT = {
  implementationLock: (slug) => `[epic-loop] epic=${slug} mode=implementation — loop running in another session; read-only, do not edit epic artifacts`,
  marker: (slug, mode) => `[epic-loop] epic=${slug} mode=${mode} — follow epic-loop skill mode rules`,
};

export function buildModeReminder(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "UserPromptSubmit") {
    return null;
  }
  const runtime = readJson(runtimeStatePath(projectRoot, binding.epic_slug), {});
  const normalizedRuntime = runtime && typeof runtime === "object" && !Array.isArray(runtime) ? runtime : {};
  const mode = normalizedRuntime.mode;
  const loop =
    normalizedRuntime.implementation_loop && typeof normalizedRuntime.implementation_loop === "object" && !Array.isArray(normalizedRuntime.implementation_loop)
      ? normalizedRuntime.implementation_loop
      : {};

  let text = null;
  if (mode === "shaping" || mode === "review") {
    text = MODE_REMINDER_TEXT.marker(binding.epic_slug, mode);
  } else if (mode === "implementation" && loop.driver_session_id !== payload.session_id) {
    text = MODE_REMINDER_TEXT.implementationLock(binding.epic_slug);
  }

  if (!text) {
    return null;
  }

  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: text,
    },
  };
}

export function handleHook(rawInput, flags = {}) {
  let payload;

  try {
    payload = rawInput.trim() ? JSON.parse(rawInput) : {};
  } catch {
    payload = {
      hook_event_name: "invalid-json",
      raw_input: rawInput,
    };
  }

  const projectRoot = resolveRoot(flags.root ?? payload.cwd);
  const sessionId = String(payload.session_id ?? "no-session");
  const platform = requireRuntimePlatform(projectRoot);

  // Record the live session on every event, before the binding gate. This is the
  // source `bind-session --current` reads to attach the real session id; without it
  // binding falls back to an mtime guess that misfires across parallel sessions.
  if (platform === "codex") {
    writeHookCapture(projectRoot, payload);
  } else if (platform === "claude-code") {
    writeClaudeHookCapture(projectRoot, payload);
  }

  const binding = getSessionBinding(projectRoot, sessionId);

  if (!binding) {
    return;
  }

  const eventRecord = {
    captured_at: nowIso(),
    payload,
  };
  const eventPath = path.join(sessionRoot(projectRoot), "hook-events", sessionId, eventFilename(payload));

  writeJson(eventPath, eventRecord);
  writeJson(path.join(sessionRoot(projectRoot), "last-hook-event.json"), eventRecord);
  updateSessionState(projectRoot, payload, eventPath);
  mirrorBoundEvent(projectRoot, payload, eventRecord, binding);
  markInterruptedTurnIfNeeded(projectRoot, payload, binding);

  const continuation = maybeBuildImplementationContinuation(projectRoot, payload, binding) ?? buildModeReminder(projectRoot, payload, binding);
  if (continuation) {
    console.log(JSON.stringify(continuation));
  }
}

function updateSessionState(projectRoot, payload, eventPath) {
  const sessionId = String(payload.session_id ?? "no-session");
  const statePath = path.join(sessionRoot(projectRoot), "sessions", `${sessionId}.json`);
  const existingState = readJson(statePath, {});
  const state = existingState && typeof existingState === "object" && !Array.isArray(existingState) ? existingState : {};
  const turnIds = Array.isArray(state.turn_ids) ? state.turn_ids : [];
  const turnId = payload.turn_id ?? null;

  if (turnId && !turnIds.includes(turnId)) {
    turnIds.push(turnId);
  }

  const timestamp = nowIso();
  writeJson(statePath, {
    ...state,
    created_at: state.created_at ?? timestamp,
    cwd: payload.cwd,
    last_event: payload.hook_event_name,
    last_event_path: eventPath,
    last_turn_id: turnId,
    model: payload.model,
    session_id: sessionId,
    transcript_path: payload.transcript_path,
    turn_ids: turnIds,
    updated_at: timestamp,
  });
}

function getSessionBinding(projectRoot, sessionId) {
  const bindingsPath = path.join(sessionRoot(projectRoot), "session-bindings.json");
  const bindings = readJson(bindingsPath, { sessions: {} });
  const sessions = bindings && typeof bindings === "object" && !Array.isArray(bindings) && bindings.sessions && typeof bindings.sessions === "object" ? bindings.sessions : {};
  const binding = sessions[sessionId];

  if (!binding || typeof binding !== "object" || binding.active !== true) {
    return null;
  }

  if (!binding.epic_slug) {
    return null;
  }

  return binding;
}

function mirrorBoundEvent(projectRoot, payload, eventRecord, binding) {
  const sessionId = String(payload.session_id ?? "no-session");

  if (!binding || typeof binding !== "object" || !binding.epic_slug) {
    return;
  }

  const targetDir = path.join(epicRuntimeRoot(projectRoot, String(binding.epic_slug)), "sessions", sessionId);
  const targetEventPath = path.join(targetDir, eventFilename(payload));
  writeJson(targetEventPath, eventRecord);
  writeJson(path.join(targetDir, "last-hook-event.json"), eventRecord);
}
