import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readJson, roadmapStatePath, runtimeStatePath } from "../../plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs";
import {
  addFollowUpTask,
  closeTask,
  ensureRoadmapState,
  readRoadmapSummary,
  setTaskStatus,
  startPhase,
  startTask,
} from "../../plugins/epic-loop/skills/epic-loop/scripts/lib/roadmap.mjs";

test("roadmap helpers create and transition task state in an isolated epic", () => {
  const { root, slug } = createTempEpic();

  try {
    const initial = ensureRoadmapState(root, slug, { title: "Demo Epic" });
    assert.equal(initial.slug, slug);
    assert.equal(initial.active_phase_id, "phase-1");
    assert.equal(initial.active_task_id, null);
    assert.equal(initial.phases[0].tasks[0].status, "todo");

    startTask({ root, slug, "task-id": "phase-1-task-1" });

    let roadmap = readJson(roadmapStatePath(root, slug), null);
    assert.equal(roadmap.active_phase_id, "phase-1");
    assert.equal(roadmap.active_task_id, "phase-1-task-1");
    assert.equal(roadmap.phases[0].status, "doing");
    assert.equal(roadmap.phases[0].tasks[0].status, "doing");

    let runtime = readJson(runtimeStatePath(root, slug), null);
    assert.equal(runtime.active_phase, "Phase 1 - Shape The Epic");
    assert.equal(runtime.active_task, "Phase 1 Task 1 - Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions");

    const trackerText = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, "tracker.md"), "utf8");
    assert.match(trackerText, /Phase status: doing/u);
    assert.match(trackerText, /Status: doing/u);

    closeTask({ root, slug, "task-id": "phase-1-task-1" });

    roadmap = readJson(roadmapStatePath(root, slug), null);
    assert.equal(roadmap.active_task_id, null);
    assert.equal(roadmap.phases[0].tasks[0].status, "done");
    assert.deepEqual(readRoadmapSummary(root, slug), {
      active_phase: "Phase 1 - Shape The Epic",
      active_task: null,
    });
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("roadmap helpers reject invalid task state changes", () => {
  const { root, slug } = createTempEpic();

  try {
    ensureRoadmapState(root, slug, { title: "Demo Epic" });

    assert.throws(() => setTaskStatus({ root, slug, "task-id": "phase-1-task-1", status: "finished" }), /Invalid task status "finished"/u);
    assert.throws(() => startTask({ root, slug, "task-id": "missing-task" }), /Task not found: missing-task/u);
    assert.throws(() => startPhase({ root, slug, "phase-id": "missing-phase" }), /Phase not found: missing-phase/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("follow-up task helper creates deterministic ids and renders tracker entries", () => {
  const { root, slug } = createTempEpic();

  try {
    ensureRoadmapState(root, slug, { title: "Demo Epic" });

    addFollowUpTask({
      acceptance: "The follow-up can be read from the rendered tracker.",
      docs: "`docs/follow-up.md`.",
      kind: "follow-up",
      outcome: "A deterministic follow-up exists.",
      root,
      slug,
      surface: "`tests/unit/roadmap.test.mjs`.",
      title: "Record follow up coverage",
    });

    const roadmap = readJson(roadmapStatePath(root, slug), null);
    assert.equal(roadmap.follow_ups.length, 1);
    assert.equal(roadmap.follow_ups[0].id, "follow-up-01-record-follow-up-coverage");
    assert.equal(roadmap.follow_ups[0].status, "todo");

    const trackerText = fs.readFileSync(path.join(root, ".epic-loop", "epics", slug, "tracker.md"), "utf8");
    assert.match(trackerText, /## Follow-Up Tasks/u);
    assert.match(trackerText, /Record follow up coverage/u);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

function createTempEpic() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-roadmap-"));
  const slug = "demo";
  const epicDir = path.join(root, ".epic-loop", "epics", slug);
  fs.mkdirSync(epicDir, { recursive: true });
  fs.writeFileSync(
    path.join(epicDir, "state-of-epic.md"),
    `# State Of Epic

Epic: Demo Epic
Slug: \`${slug}\`
Current mode: implementation
Active phase: TBD
Active task: TBD
`,
    "utf8",
  );
  return { root, slug };
}
