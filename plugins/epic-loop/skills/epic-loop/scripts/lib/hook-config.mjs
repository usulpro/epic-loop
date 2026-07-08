import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CODEX_CONFIG_RELATIVE_PATH, CODEX_HOOKS_RELATIVE_PATH, HOOK_EVENTS, canWritePath, readJsonStrict, shellQuote } from "./common.mjs";

export const CLAUDE_SETTINGS_RELATIVE_PATH = path.join(".claude", "settings.json");

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.dirname(LIB_DIR);

export const HOOK_SCRIPT_PATH = path.join(SCRIPTS_DIR, "hook.mjs");
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
  return typeof command === "string" && /epic[-_]loop/u.test(command) && /hook\.mjs|epic-loop\.mjs|epic_loop\.py|\bhook\b/u.test(command);
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
