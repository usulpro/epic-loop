import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODEX_CONFIG_RELATIVE_PATH,
  CODEX_HOOKS_RELATIVE_PATH,
  HOOK_EVENTS,
  canReadPath,
  canWritePath,
  epicRuntimeRoot,
  eventTimestamp,
  formatList,
  nowIso,
  platformConfigPath,
  platformSetupCommand,
  readRuntimePlatform,
  requireRuntimePlatform,
  readJson,
  readJsonStrict,
  resolveRoot,
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
  const ready = hookConfig.ready && !hookConfig.invalid && feature.enabled === true && runtimeWritable.ok && scriptReadable.ok;
  const setupPossible = !hookConfig.invalid && hookConfig.writable.ok;
  const status = {
    codexHooksFeature: feature,
    command: hookConfig.command,
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
  const ready = hookConfig.ready && !hookConfig.invalid && blockCap.ready && runtimeWritable.ok && scriptReadable.ok;
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
