import fs from "node:fs";
import path from "node:path";

import {
  CODEX_HOOKS_RELATIVE_PATH,
  canReadPath,
  canWritePath,
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
  runtimeStatePath,
  sessionPathSegment,
  sessionRoot,
  slugify,
  writeHookCapture,
  writeClaudeHookCapture,
  writeJson,
  writeRuntimePlatform,
} from "./common.mjs";
import {
  CLAUDE_SETTINGS_RELATIVE_PATH,
  HOOK_SCRIPT_PATH,
  buildClaudeSettingsDocument,
  buildHookCommand,
  buildHooksDocument,
  buildInstallHooksCommand,
  inspectClaudeHookConfig,
  inspectClaudeStopHookBlockCap,
  inspectCodexHooksFeature,
  inspectHookConfig,
} from "./hook-config.mjs";
import { inspectAndRepairEpicCompatibility } from "./hook-compatibility.mjs";
import { markInterruptedTurnIfNeeded, maybeBuildImplementationContinuation } from "./loop.mjs";

export { buildHookCommand };

function eventFilename(payload) {
  const eventName = slugify(payload.hook_event_name ?? "unknown");
  const turnId = slugify(payload.turn_id ?? "no-turn");
  return `${eventTimestamp()}-${eventName}-${turnId}.json`;
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
    `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: ${blockCap.ready ? `${blockCap.value}${blockCap.recommended ? "" : " (accepted with warning)"}` : `setup-required (${blockCap.reason})`}`,
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

  // Record only a minimal binding handshake before the binding gate. Raw hook
  // payloads are persisted only for sessions that already opted into epic-loop.
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
  const eventPath = path.join(sessionRoot(projectRoot), "hook-events", sessionPathSegment(sessionId), eventFilename(payload));

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
  const statePath = path.join(sessionRoot(projectRoot), "sessions", `${sessionPathSegment(sessionId)}.json`);
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

  const targetDir = path.join(epicRuntimeRoot(projectRoot, String(binding.epic_slug)), "sessions", sessionPathSegment(sessionId));
  const targetEventPath = path.join(targetDir, eventFilename(payload));
  writeJson(targetEventPath, eventRecord);
  writeJson(path.join(targetDir, "last-hook-event.json"), eventRecord);
}
