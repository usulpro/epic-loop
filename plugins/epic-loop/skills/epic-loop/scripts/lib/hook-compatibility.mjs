import fs from "node:fs";
import path from "node:path";

import { MODES, epicsRoot, nowIso, readJson, readJsonStrict, roadmapStatePath, runtimeStatePath, sessionRoot, writeJson } from "./common.mjs";
import { createInitialRoadmapState } from "./roadmap.mjs";

export function inspectAndRepairEpicCompatibility(root) {
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

  const mode = typeof strict.value.mode === "string" && MODES.includes(strict.value.mode) ? strict.value.mode : (bindingMode ?? null);
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
