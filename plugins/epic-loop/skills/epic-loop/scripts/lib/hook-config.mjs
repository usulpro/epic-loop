import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CODEX_CONFIG_RELATIVE_PATH, CODEX_HOOKS_RELATIVE_PATH, HOOK_EVENTS, canWritePath, readJsonStrict, shellQuote } from "./common.mjs";

export const CLAUDE_SETTINGS_RELATIVE_PATH = path.join(".claude", "settings.json");

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.dirname(LIB_DIR);

export const HOOK_SCRIPT_PATH = path.join(SCRIPTS_DIR, "hook.mjs");
export const DOORBELL_WAITER_SCRIPT_PATH = path.join(SCRIPTS_DIR, "doorbell-waiter.mjs");
// The Claude Code doorbell waiter (D34): asyncRewake hooks on these events, with an explicit
// timeout because the host default (600 s) kills the waiter. Keep in step with the CLI doctor copy.
export const DOORBELL_WAITER_EVENTS = ["Stop", "SessionStart"];
export const DOORBELL_WAITER_TIMEOUT_SECONDS = 86400;
const DOORBELL_REWAKE_MESSAGE = "epic-loop:";
const INSTALL_HOOKS_SCRIPT_PATH = path.join(SCRIPTS_DIR, "install-hooks.mjs");

export function buildHookCommand() {
  return `node ${shellQuote(HOOK_SCRIPT_PATH)}`;
}

function buildClaudeHookCommand(root) {
  return `${buildHookCommand()} --root ${shellQuote(root)}`;
}

export function buildInstallHooksCommand(extraArgs = "") {
  return `node ${shellQuote(INSTALL_HOOKS_SCRIPT_PATH)}${extraArgs}`;
}

function isEpicLoopHookCommand(command) {
  return typeof command === "string" && !isDoorbellWaiterCommand(command) && /epic[-_]loop/u.test(command) && /hook\.mjs|epic-loop\.mjs|epic_loop\.py|\bhook\b/u.test(command);
}

function isDoorbellWaiterCommand(command) {
  return typeof command === "string" && command.includes("doorbell-waiter.mjs");
}

function buildDoorbellWaiterCommand(root) {
  return `node ${shellQuote(DOORBELL_WAITER_SCRIPT_PATH)} --root ${shellQuote(root)}`;
}

function doorbellWaiterHook(root) {
  return { asyncRewake: true, command: buildDoorbellWaiterCommand(root), rewakeMessage: DOORBELL_REWAKE_MESSAGE, timeout: DOORBELL_WAITER_TIMEOUT_SECONDS, type: "command" };
}

const sameWaiterHook = (hook, expected) =>
  hook?.command === expected.command && hook.asyncRewake === true && hook.timeout === expected.timeout && hook.rewakeMessage === expected.rewakeMessage && hook.type === "command";

// Keeps exactly one current waiter hook on each waiter event: stale or duplicate waiter entries
// are dropped (with their group when it empties) and the current one is added.
function installDoorbellWaiter(hooks, root, changes) {
  const expected = doorbellWaiterHook(root);
  for (const eventName of DOORBELL_WAITER_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    let kept = false;
    let changed = false;
    const next = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        next.push(entry);
        continue;
      }
      const remaining = entry.hooks.filter((hook) => {
        if (!isDoorbellWaiterCommand(hook?.command)) return true;
        if (!kept && sameWaiterHook(hook, expected)) {
          kept = true;
          return true;
        }
        changed = true;
        return false;
      });
      if (remaining.length > 0 || entry.hooks.length === 0) next.push({ ...entry, hooks: remaining });
    }
    if (!kept) {
      next.push({ matcher: "", hooks: [expected] });
      changed = true;
    }
    if (changed && !changes.includes(eventName)) changes.push(eventName);
    hooks[eventName] = next;
  }
}

// Whether the waiter hooks are installed with the fields the doorbell needs.
function inspectDoorbellWaiter(hooks, root) {
  const expected = doorbellWaiterHook(root);
  const missingEvents = [];
  const timeoutMissing = [];
  for (const eventName of DOORBELL_WAITER_EVENTS) {
    const waiterHooks = (Array.isArray(hooks[eventName]) ? hooks[eventName] : [])
      .flatMap((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : []))
      .filter((hook) => isDoorbellWaiterCommand(hook?.command));
    if (!waiterHooks.some((hook) => sameWaiterHook(hook, expected))) missingEvents.push(eventName);
    if (waiterHooks.some((hook) => hook.asyncRewake === true && !Number.isFinite(hook.timeout))) timeoutMissing.push(eventName);
  }
  return { command: expected.command, missingEvents, ready: missingEvents.length === 0, timeoutMissing, timeoutSeconds: DOORBELL_WAITER_TIMEOUT_SECONDS };
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

export function inspectCodexHooksFeature(root) {
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

export function buildHooksDocument(existingDocument) {
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

export function buildClaudeSettingsDocument(existingDocument, root) {
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

  installDoorbellWaiter(hooks, root, changes);
  normalizedDocument.hooks = hooks;

  return {
    changes,
    command,
    document: normalizedDocument,
  };
}

export function inspectHookConfig(root) {
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

export function inspectClaudeHookConfig(root) {
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

  const doorbell = inspectDoorbellWaiter(hooks, root);

  return {
    command,
    doorbell,
    error: null,
    exists: strict.exists,
    invalid: false,
    missingEvents,
    path: settingsPath,
    ready: missingEvents.length === 0 && staleEvents.length === 0 && doorbell.ready,
    staleEvents,
    writable,
  };
}

export function inspectClaudeStopHookBlockCap(env = process.env) {
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
