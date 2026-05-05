import fs from "node:fs";
import path from "node:path";

import {
  MODES,
  appendGitignore,
  ensureDir,
  nowIso,
  readJson,
  requireFlag,
  resolveRoot,
  sessionRoot,
  slugify,
  titleFromDescription,
  writeJson,
  writeOnce,
} from "./common.mjs";

export function initEpic(flags = {}) {
  const root = resolveRoot(flags.root);
  const description = typeof flags.description === "string" ? flags.description.trim() : "";
  const title = typeof flags.title === "string" && flags.title.trim() ? flags.title.trim() : titleFromDescription(description);
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

${description || "TBD"}

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
      active_phase: null,
      active_task: null,
      created_at: createdAt,
      description: description || null,
      execution_brief: null,
      implementation_submode: "techlead",
      mode,
      slug,
      title,
      updated_at: createdAt,
    });
  }

  if (!flags["no-gitignore"]) {
    appendGitignore(root);
  }

  console.log(`Epic initialized: ${slug}`);
  console.log(`Workspace: ${epicDir}`);
}

export function status(flags = {}, positionals = []) {
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

export function bindSession(flags = {}) {
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
    bound_at: boundAt,
    epic_slug: slug,
    mode,
  };
  normalizedBindings.sessions = sessions;
  writeJson(bindingsPath, normalizedBindings);

  const sessionDir = path.join(epicDir, "sessions", sessionId);
  ensureDir(sessionDir);
  writeJson(path.join(sessionDir, "binding.json"), {
    bound_at: boundAt,
    epic_slug: slug,
    mode,
    session_id: sessionId,
  });

  console.log(`Bound session ${sessionId} to epic ${slug} in ${mode} mode.`);
}

export function listEpics(flags = {}) {
  const root = resolveRoot(flags.root);
  const epicsDir = path.join(root, "epics");
  const epics = fs.existsSync(epicsDir)
    ? fs
        .readdirSync(epicsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readEpicSummary(path.join(epicsDir, entry.name), entry.name))
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    : [];

  if (flags.json) {
    console.log(JSON.stringify({ epics, root }, null, 2));
    return;
  }

  if (epics.length === 0) {
    console.log("No local epics found.");
    return;
  }

  for (const epic of epics) {
    console.log(`${epic.slug} | ${epic.title} | updated ${epic.updatedAgo}`);
  }
}

function readEpicSummary(epicDir, slug) {
  const runtime = readJson(path.join(epicDir, "runtime-state.json"), {});
  const statePath = path.join(epicDir, "state-of-epic.md");
  const title = runtime.title || readTitleFromState(statePath) || slug;
  const updatedAtMs = latestMtimeMs(epicDir);
  const updatedAt = new Date(updatedAtMs).toISOString();

  return {
    mode: runtime.mode ?? null,
    path: epicDir,
    slug,
    title,
    updatedAgo: formatAgo(updatedAtMs),
    updatedAt,
    updatedAtMs,
  };
}

function readTitleFromState(statePath) {
  if (!fs.existsSync(statePath)) {
    return null;
  }

  const match = fs.readFileSync(statePath, "utf8").match(/^Epic:\s*(.+)$/mu);
  return match?.[1]?.trim() || null;
}

function latestMtimeMs(dirPath) {
  let latest = fs.statSync(dirPath).mtimeMs;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    const stat = fs.statSync(entryPath);
    latest = Math.max(latest, stat.mtimeMs);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestMtimeMs(entryPath));
    }
  }

  return latest;
}

function formatAgo(timestampMs) {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
