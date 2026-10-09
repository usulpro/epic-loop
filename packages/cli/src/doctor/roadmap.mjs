// Temporary duplicate of the initial-state part of
// plugins/epic-loop/skills/epic-loop/scripts/lib/roadmap.mjs.
// Remove once the skill scripts migrate into this package.

import { nowIso } from "./common.mjs";

export const TASK_STATUSES = ["todo", "doing", "need-review", "blocked", "partially-satisfied", "deferred", "reset-required", "done"];
export const TASK_KINDS = ["implementation", "verification", "review", "follow-up", "architecture-reset", "documentation-only"];

export function createInitialRoadmapState({ slug, title }) {
  return {
    schema_version: 1,
    slug,
    title,
    active_phase_id: "phase-1",
    active_task_id: null,
    statuses: TASK_STATUSES,
    kinds: TASK_KINDS,
    phases: [
      {
        id: "phase-1",
        title: "Shape The Epic",
        status: "todo",
        tasks: [
          {
            id: "phase-1-task-1",
            title: "Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.",
            kind: "documentation-only",
            status: "todo",
            outcome: "The epic has enough structure for phase and task decomposition.",
            surface: "`docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.",
            acceptance: "A future session can understand why this epic exists and what should happen next.",
            docs: "`docs/problem-framing.md`, `decision-log.md`, `risk-register.md`.",
          },
        ],
      },
    ],
    follow_ups: [],
    updated_at: nowIso(),
  };
}
