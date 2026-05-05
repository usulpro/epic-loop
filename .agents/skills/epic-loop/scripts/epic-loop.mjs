#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"];
const MODES = ["shaping", "implementation", "review", "reset"];
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "+00:00");
}

function eventTimestamp() {
  return new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

function slugify(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");

  if (slug) {
    return slug;
  }

  const fallback = new Date().toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
  return `epic-${fallback}`;
}

function expandHome(value) {
  const input = String(value ?? ".");
  if (input === "~") {
    return process.env.HOME ?? input;
  }
  if (input.startsWith("~/")) {
    return path.join(process.env.HOME ?? "~", input.slice(2));
  }
  return input;
}

function resolveRoot(value) {
  return path.resolve(expandHome(value ?? "."));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeOnce(filePath, content) {
  if (!fs.existsSync(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function appendGitignore(root) {
  const gitignorePath = path.join(root, ".gitignore");
  const requiredLines = ["epics/", ".epic-loop/"];

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${requiredLines.join("\n")}\n`, "utf8");
    return;
  }

  let content = fs.readFileSync(gitignorePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const missingLines = requiredLines.filter((line) => !lines.includes(line));
  if (missingLines.length === 0) {
    return;
  }

  const suffix = lines.length === 0 || lines.at(-1) === "" ? "" : "\n";
  content = `${content}${suffix}${missingLines.join("\n")}\n`;
  fs.writeFileSync(gitignorePath, content, "utf8");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

function buildHookCommand() {
  return `node ${shellQuote(SCRIPT_PATH)} hook`;
}

function sessionRoot(projectRoot) {
  return path.join(projectRoot, ".epic-loop");
}

function eventFilename(payload) {
  const eventName = slugify(payload.hook_event_name ?? "unknown");
  const turnId = slugify(payload.turn_id ?? "no-turn");
  return `${eventTimestamp()}-${eventName}-${turnId}.json`;
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const rawName = arg.slice(2);
    if (rawName.startsWith("no-")) {
      flags[rawName] = true;
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[rawName] = true;
      continue;
    }

    flags[rawName] = next;
    index += 1;
  }

  return { flags, positionals };
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required --${name}.`);
  }
  return value;
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function installHooks(flags) {
  const root = resolveRoot(flags.root);
  const hooksPath = path.join(root, ".codex", "hooks.json");
  const document = readJson(hooksPath, {});
  const normalizedDocument = document && typeof document === "object" && !Array.isArray(document) ? document : {};
  const hooks = normalizedDocument.hooks && typeof normalizedDocument.hooks === "object" && !Array.isArray(normalizedDocument.hooks) ? normalizedDocument.hooks : {};
  const command = buildHookCommand();

  for (const eventName of HOOK_EVENTS) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
    const alreadyInstalled = entries.some((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.hooks)) {
        return false;
      }
      return entry.hooks.some((hook) => hook && typeof hook === "object" && hook.command === command);
    });

    if (!alreadyInstalled) {
      entries.push({
        hooks: [
          {
            command,
            timeout: 30,
            type: "command",
          },
        ],
      });
    }

    hooks[eventName] = entries;
  }

  normalizedDocument.hooks = hooks;
  writeJson(hooksPath, normalizedDocument);

  console.log(`Installed project-local epic-loop hooks: ${hooksPath}`);
  console.log("Requires codex_hooks = true in the active Codex config/profile.");
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
    session_id: sessionId,
    cwd: payload.cwd,
    transcript_path: payload.transcript_path,
    model: payload.model,
    last_event: payload.hook_event_name,
    last_turn_id: turnId,
    last_event_path: eventPath,
    updated_at: timestamp,
    turn_ids: turnIds,
    created_at: state.created_at ?? timestamp,
  });
}

function getSessionBinding(projectRoot, sessionId) {
  const bindingsPath = path.join(sessionRoot(projectRoot), "session-bindings.json");
  const bindings = readJson(bindingsPath, { sessions: {} });
  const sessions = bindings && typeof bindings === "object" && !Array.isArray(bindings) && bindings.sessions && typeof bindings.sessions === "object" ? bindings.sessions : {};
  const binding = sessions[sessionId];

  return binding && typeof binding === "object" ? binding : null;
}

function mirrorBoundEvent(projectRoot, payload, eventRecord, binding) {
  const sessionId = String(payload.session_id ?? "no-session");

  if (!binding || typeof binding !== "object" || !binding.epic_slug) {
    return;
  }

  const targetDir = path.join(projectRoot, "epics", String(binding.epic_slug), "sessions", sessionId);
  const targetEventPath = path.join(targetDir, eventFilename(payload));
  writeJson(targetEventPath, eventRecord);
  writeJson(path.join(targetDir, "last-hook-event.json"), eventRecord);
}

function handleHook(flags) {
  const rawInput = readStdin();
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
}

function bindSession(flags) {
  const root = resolveRoot(flags.root);
  const sessionId = requireFlag(flags, "session-id");
  const slug = requireFlag(flags, "slug");
  const mode = requireFlag(flags, "mode");

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid --mode "${mode}". Expected one of: ${MODES.join(", ")}.`);
  }

  const epicDir = path.join(root, "epics", slug);
  if (!fs.existsSync(epicDir)) {
    throw new Error(`Epic not found: ${epicDir}`);
  }

  const bindingsPath = path.join(sessionRoot(root), "session-bindings.json");
  const bindings = readJson(bindingsPath, { sessions: {} });
  const normalizedBindings = bindings && typeof bindings === "object" && !Array.isArray(bindings) ? bindings : { sessions: {} };
  const sessions = normalizedBindings.sessions && typeof normalizedBindings.sessions === "object" && !Array.isArray(normalizedBindings.sessions) ? normalizedBindings.sessions : {};
  const boundAt = nowIso();

  sessions[sessionId] = {
    epic_slug: slug,
    mode,
    bound_at: boundAt,
  };
  normalizedBindings.sessions = sessions;
  writeJson(bindingsPath, normalizedBindings);

  const sessionDir = path.join(epicDir, "sessions", sessionId);
  ensureDir(sessionDir);
  writeJson(path.join(sessionDir, "binding.json"), {
    session_id: sessionId,
    epic_slug: slug,
    mode,
    bound_at: boundAt,
  });

  console.log(`Bound session ${sessionId} to epic ${slug} in ${mode} mode.`);
}

function initEpic(flags) {
  const root = resolveRoot(flags.root);
  const title = requireFlag(flags, "title").trim() || "Untitled Epic";
  const slug = slugify(flags.slug ?? title);
  const mode = typeof flags.mode === "string" ? flags.mode : "shaping";

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid --mode "${mode}". Expected one of: ${MODES.join(", ")}.`);
  }

  const epicDir = path.join(root, "epics", slug);
  ensureDir(path.join(epicDir, "docs"));
  ensureDir(path.join(epicDir, "execution"));

  const createdAt = nowIso();

  writeOnce(
    path.join(epicDir, "state-of-epic.md"),
    `# State Of Epic

Epic: ${title}
Slug: \`${slug}\`
Created: ${createdAt}
Current mode: ${mode}
Active phase: TBD
Active task: TBD

## Current State

- The epic workspace has been initialized.
- Shaping should capture problem framing, scope, risks, and first roadmap.

## Blockers

- None recorded.

## Next Action

- Start epic shaping or resume from the user's provided context.
`,
  );

  writeOnce(
    path.join(epicDir, "tracker.md"),
    `# Tracker

Epic: ${title}

## Task Statuses

- todo
- doing
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

### Phase 1: Shape The Epic

- [ ] Kind: documentation-only | Status: todo | Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.
  - Outcome: The epic has enough structure for phase and task decomposition.
  - Surface: \`docs/\`, \`decision-log.md\`, \`risk-register.md\`, \`state-of-epic.md\`.
  - Acceptance: A future session can understand why this epic exists and what should happen next.
`,
  );

  writeOnce(
    path.join(epicDir, "implementation-log.md"),
    `# Implementation Log

## ${createdAt} - Epic Workspace Initialized

- Created epic workspace for \`${slug}\`.
- Initial mode: ${mode}.
`,
  );

  writeOnce(
    path.join(epicDir, "decision-log.md"),
    `# Decision Log

## Active Decisions

- None recorded yet.

## Historical Decisions

- None recorded yet.
`,
  );

  writeOnce(
    path.join(epicDir, "risk-register.md"),
    `# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| No risks recorded yet. | TBD | TBD | open |
`,
  );

  writeOnce(
    path.join(epicDir, "docs", "framing.md"),
    `# Epic Framing

## Problem

TBD

## Desired Outcome

TBD

## Scope

TBD

## Non-Scope

TBD

## Constraints

TBD

## Open Questions

- TBD
`,
  );

  const runtimeStatePath = path.join(epicDir, "runtime-state.json");
  if (!fs.existsSync(runtimeStatePath)) {
    writeJson(runtimeStatePath, {
      slug,
      title,
      mode,
      active_phase: null,
      active_task: null,
      implementation_submode: "techlead",
      execution_brief: null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  if (!flags["no-gitignore"]) {
    appendGitignore(root);
  }

  console.log(`Epic initialized: ${slug}`);
  console.log(`Workspace: ${epicDir}`);
}

function status(flags, positionals) {
  const root = resolveRoot(flags.root);
  const slug = positionals[0];

  if (!slug) {
    throw new Error("Missing epic slug.");
  }

  const epicDir = path.join(root, "epics", slug);
  const statePath = path.join(epicDir, "state-of-epic.md");
  const runtimePath = path.join(epicDir, "runtime-state.json");

  if (!fs.existsSync(epicDir)) {
    throw new Error(`Epic not found: ${epicDir}`);
  }

  console.log(`Workspace: ${epicDir}`);
  if (fs.existsSync(runtimePath)) {
    console.log(fs.readFileSync(runtimePath, "utf8").trim());
  }
  if (fs.existsSync(statePath)) {
    console.log("\n--- state-of-epic.md ---");
    console.log(fs.readFileSync(statePath, "utf8").trim());
  }
}

function printHelp() {
  console.log(`Usage: epic-loop.mjs <command> [options]

Commands:
  init --title <title> [--slug <slug>] [--root <path>] [--mode <mode>] [--no-gitignore]
  install-hooks [--root <path>]
  hook [--root <path>]
  bind-session --session-id <id> --slug <slug> --mode <mode> [--root <path>]
  status <slug> [--root <path>]`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { flags, positionals } = parseArgs(rest);

  switch (command) {
    case "init":
      initEpic(flags);
      break;
    case "install-hooks":
      installHooks(flags);
      break;
    case "hook":
      handleHook(flags);
      break;
    case "bind-session":
      bindSession(flags);
      break;
    case "status":
      status(flags, positionals);
      break;
    case "-h":
    case "--help":
    case "help":
    case undefined:
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
