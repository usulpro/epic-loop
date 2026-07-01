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
  readRuntimePlatform,
  requireRuntimePlatform,
  readJson,
  readJsonStrict,
  resolveRoot,
  sessionRoot,
  shellQuote,
  slugify,
  writeHookCapture,
  writeJson,
  writeRuntimePlatform,
} from "./common.mjs";
import { markInterruptedTurnIfNeeded, maybeBuildImplementationContinuation } from "./loop.mjs";

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.dirname(LIB_DIR);
const HOOK_SCRIPT_PATH = path.join(SCRIPTS_DIR, "hook.mjs");
const INSTALL_HOOKS_SCRIPT_PATH = path.join(SCRIPTS_DIR, "install-hooks.mjs");

export function buildHookCommand() {
  return `node ${shellQuote(HOOK_SCRIPT_PATH)}`;
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

export function doctor(flags = {}) {
  const root = resolveRoot(flags.root);
  const platformConfig =
    typeof flags.platform === "string" ? writeRuntimePlatform(root, flags.platform) : { ...readRuntimePlatform(root), selected_at: null };
  const platform = platformConfig.platform;

  if (!platform) {
    throw new Error("Runtime platform is not configured. Run: doctor.mjs --platform codex|claude-code --json");
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
  const runtimeWritable = canWritePath(sessionRoot(root));
  const scriptReadable = canReadPath(HOOK_SCRIPT_PATH);
  const settingsPath = path.join(root, ".claude", "settings.json");
  const settingsWritable = canWritePath(settingsPath);
  const status = {
    claudeCodeHookConfig: {
      path: settingsPath,
      ready: false,
      writable: settingsWritable,
    },
    command: buildHookCommand(),
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
    ready: false,
    runtimeState: {
      path: sessionRoot(root),
      writable: runtimeWritable,
    },
    setupPossible: settingsWritable.ok,
    status: "setup-required",
  };

  if (flags.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log("Epic-loop hook readiness: setup-required");
  console.log(`Project root: ${root}`);
  console.log(`Runtime platform: claude-code (${platformConfigPath(root)})`);
  console.log(`Hook command: ${buildHookCommand()}`);
  console.log(`Claude Code settings: ${settingsPath}`);
  console.log("Claude Code hook installation and readiness checks will be added by the Claude hook setup task.");
}

export function installHooks(flags = {}) {
  const root = resolveRoot(flags.root);
  const platform = requireRuntimePlatform(root);

  if (platform === "claude-code") {
    throw new Error("Claude Code hook installation is not implemented yet. Run the Claude hook setup task before installing Claude hooks.");
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

  const projectRoot = resolveRoot(payload.cwd ?? flags.root);
  const sessionId = String(payload.session_id ?? "no-session");
  const platform = requireRuntimePlatform(projectRoot);

  // Record the live session on every event, before the binding gate. This is the
  // source `bind-session --current` reads to attach the real session id; without it
  // binding falls back to an mtime guess that misfires across parallel sessions.
  if (platform === "codex") {
    writeHookCapture(projectRoot, payload);
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

  const continuation = maybeBuildImplementationContinuation(projectRoot, payload, binding);
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
  const activeSessions =
    bindings && typeof bindings === "object" && !Array.isArray(bindings) && bindings.active_sessions && typeof bindings.active_sessions === "object"
      ? bindings.active_sessions
      : {};
  const binding = sessions[sessionId];

  if (!binding || typeof binding !== "object" || binding.active !== true) {
    return null;
  }

  const activeKey = `${binding.epic_slug}:${binding.mode}`;
  if (activeSessions[activeKey] !== sessionId) {
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
