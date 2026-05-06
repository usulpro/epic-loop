import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicsRoot, nowIso, readJson, requireFlag, resolveRoot, sessionRoot, writeJson } from "./common.mjs";

const LOOP_ROLES = ["techlead", "engineer", "idle"];
const WAITING_FOR_TURN_TRANSITION = "awaiting-transition";

export function startImplementationLoop(projectRoot, { sessionId, slug }) {
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      current_role: null,
      iteration: Number.isFinite(loop.iteration) ? loop.iteration : 0,
      last_reason: "implementation-start",
      last_session_id: sessionId,
      last_transition_at: timestamp,
      last_transition_by: "bind-session",
      next_role: "techlead",
      prompt_file: null,
      status: "running",
    },
    implementation_submode: "techlead",
    mode: "implementation",
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "start",
    next_role: "techlead",
    session_id: sessionId,
    slug,
    timestamp,
  });
}

export function setNextRole(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const role = requireFlag(flags, "role");
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : null;
  const promptFile = normalizePromptFile(root, slug, flags["prompt-file"]);

  if (!LOOP_ROLES.includes(role)) {
    throw new Error(`Invalid --role "${role}". Expected one of: ${LOOP_ROLES.join(", ")}.`);
  }

  if (role === "engineer" && !promptFile) {
    throw new Error("Missing --prompt-file for --role engineer.");
  }

  if (promptFile && !fs.existsSync(path.resolve(root, promptFile))) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);
  const status = role === "idle" ? "idle" : "running";

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      last_reason: reason,
      last_transition_at: timestamp,
      last_transition_by: "set-next-role",
      next_role: role,
      prompt_file: promptFile,
      status,
    },
    implementation_submode: role === "idle" ? runtime.implementation_submode ?? "techlead" : role,
    updated_at: timestamp,
  });

  appendLoopLog(root, {
    action: "set-next-role",
    next_role: role,
    prompt_file: promptFile,
    reason,
    slug,
    timestamp,
  });

  console.log(`Next implementation role for ${slug}: ${role}`);
  if (promptFile) {
    console.log(`Prompt file: ${promptFile}`);
  }
}

export function maybeBuildImplementationContinuation(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "Stop" || binding.mode !== "implementation") {
    return null;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();

  if (payload.stop_hook_active === true) {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "stop-hook-active",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);

  if (loop.status !== "running") {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "loop-not-running",
      session_id: payload.session_id ?? null,
      slug,
      status: loop.status ?? null,
      timestamp,
    });
    return null;
  }

  const role = loop.next_role;
  if (role === WAITING_FOR_TURN_TRANSITION) {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "next-role-not-set",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  if (role === "idle" || !role) {
    appendLoopLog(projectRoot, {
      action: "skip",
      next_role: role ?? null,
      reason: "no-continuation-role",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  if (!["techlead", "engineer"].includes(role)) {
    appendLoopLog(projectRoot, {
      action: "skip",
      next_role: role,
      reason: "unsupported-role",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  const iteration = Number.isFinite(loop.iteration) ? loop.iteration + 1 : 1;
  const prompt = role === "techlead" ? buildTechleadPrompt(slug, iteration) : buildEngineerPrompt(projectRoot, slug, loop, iteration);

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      current_role: role,
      iteration,
      last_continuation_at: timestamp,
      last_session_id: payload.session_id ?? null,
      next_role: WAITING_FOR_TURN_TRANSITION,
      status: "running",
    },
    implementation_submode: role,
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "block-with-continuation",
    iteration,
    next_role: WAITING_FOR_TURN_TRANSITION,
    prompt_file: role === "engineer" ? loop.prompt_file ?? null : null,
    role,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
  });

  return {
    decision: "block",
    reason: prompt,
  };
}

export function readImplementationLoops(projectRoot) {
  const root = epicsRoot(projectRoot);

  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const runtime = normalizeObject(readJson(runtimeStatePath(projectRoot, slug), {}));
      return {
        implementation_loop: runtime.implementation_loop ?? null,
        mode: runtime.mode ?? null,
        slug,
        updated_at: runtime.updated_at ?? null,
      };
    });
}

function buildTechleadPrompt(slug, iteration) {
  const promptPath = `.epic-loop/epics/${slug}/execution/current-engineer-prompt.md`;

  return [
    `[$epic-loop] Implementation loop: techlead turn ${iteration} for \`${slug}\`.`,
    "",
    "Act as techlead only. Do not implement the product code in this turn.",
    "",
    "Read the current epic state before deciding:",
    `- \`.epic-loop/epics/${slug}/state-of-epic.md\``,
    `- \`.epic-loop/epics/${slug}/tracker.md\``,
    `- \`.epic-loop/epics/${slug}/implementation-log.md\``,
    `- \`.epic-loop/epics/${slug}/decision-log.md\``,
    `- \`.epic-loop/epics/${slug}/risk-register.md\``,
    "",
    "Responsibilities:",
    "- verify whether the previous engineer turn is truly closed",
    "- decide whether to close the active task, close a phase, pause, review, reset, or continue",
    "- update tracker, state, logs, docs, risks, and decisions if needed",
    "- choose exactly one next engineer task when implementation should continue",
    "- write a concrete engineer prompt that is narrow enough to execute",
    "",
    `If implementation should continue, write the engineer prompt to \`${promptPath}\`, then run:`,
    "",
    `node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "${slug}" --role engineer --prompt-file "${promptPath}" --reason "<short reason>"`,
    "",
    "If the loop should stop, run:",
    "",
    `node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "${slug}" --role idle --reason "<why the implementation loop stops>"`,
    "",
    "Then report the techlead decision briefly and stop.",
  ].join("\n");
}

function buildEngineerPrompt(projectRoot, slug, loop, iteration) {
  const promptFile = loop.prompt_file;
  const absolutePromptPath = promptFile ? path.resolve(projectRoot, promptFile) : null;
  const promptText = absolutePromptPath && fs.existsSync(absolutePromptPath) ? fs.readFileSync(absolutePromptPath, "utf8").trim() : "";

  return [
    `[$epic-loop] Implementation loop: engineer turn ${iteration} for \`${slug}\`.`,
    "",
    "Act as engineer only. Execute the techlead brief below without widening the task.",
    "",
    promptText ? "## Techlead Brief" : "## Techlead Brief Missing",
    "",
    promptText || "No engineer prompt file was found. Stop and return control to techlead.",
    "",
    "Engineer responsibilities:",
    "- implement only the requested slice",
    "- follow existing project patterns",
    "- run the verification requested by the brief",
    "- update task-level epic artifacts with facts, not optimism",
    "- record blockers or mismatches instead of silently redesigning the task",
    "",
    "At the end, return control to techlead by running:",
    "",
    `node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "${slug}" --role techlead --reason "engineer turn complete"`,
    "",
    "Then report the engineering result briefly and stop.",
  ].join("\n");
}

function normalizePromptFile(root, slug, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const relative = value.trim();
  if (path.isAbsolute(relative)) {
    return path.relative(root, relative);
  }

  const normalized = path.normalize(relative);
  if (normalized.startsWith("..")) {
    throw new Error(`Prompt file must stay inside the project: ${relative}`);
  }

  if (!normalized.startsWith(`.epic-loop${path.sep}epics${path.sep}${slug}${path.sep}`) && !normalized.startsWith(`.epic-loop/epics/${slug}/`)) {
    throw new Error(`Prompt file must be inside .epic-loop/epics/${slug}/.`);
  }

  return normalized;
}

function runtimeStatePath(projectRoot, slug) {
  return path.join(epicsRoot(projectRoot), slug, "runtime-state.json");
}

function appendLoopLog(projectRoot, entry) {
  const logPath = path.join(sessionRoot(projectRoot), "loop-log.jsonl");
  ensureDir(path.dirname(logPath));
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
