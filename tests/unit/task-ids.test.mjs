import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, repoRoot, runNodeScript } from "./test-utils.mjs";

const SLUG = "ids";

// A shaped tracker from before stable ids (D27): no `T<n>` and no `Next task id` header.
const LEGACY_TRACKER = `# Tracker

Epic: Ids Epic

## Task Statuses

- todo
- doing
- blocked
- done

## Active Roadmap

### Phase 1: Build

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Build the parser
  - Outcome: parses.

- [ ] Kind: verification | Status: todo | Verify the parser

### Phase 2: Ship

- Phase status: todo

- [ ] Kind: review | Status: todo | Open the pull request

## Follow-Up Tasks

- [ ] Kind: follow-up | Status: todo | Document the parser
`;

// The parser regex of the skill before stable ids: a migrated line must still match it.
const OLD_TASK_LINE = /^- \[([ xX])\]\s+Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\|\s*(.+)$/u;

function setup(prefix, tracker = null) {
  const root = makeTempRoot(prefix);
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Ids epic", "--slug", SLUG, "--no-gitignore"]));
  const epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  const trackerPath = path.join(epicDir, "tracker.md");
  if (tracker !== null) fs.writeFileSync(trackerPath, tracker, "utf8");
  return {
    epicDir,
    root,
    run: (script, args = []) => runNodeScript(script, ["--root", root, "--slug", SLUG, ...args]),
    tracker: () => fs.readFileSync(trackerPath, "utf8"),
    trackerPath,
  };
}

const cleanup = (ctx) => fs.rmSync(ctx.root, { force: true, recursive: true });

test("init-epic writes stable task ids, and new tasks get the next id that is never reused", () => {
  const ctx = setup("ids-fresh");
  try {
    assert.match(ctx.tracker(), /\| T1 · Capture problem framing/u);
    assert.match(ctx.tracker(), /^Next task id: T2$/mu);

    const added = ctx.run("add-follow-up-task.mjs", ["--title", "Write the docs"]);
    assertSuccess(added);
    assert.match(added.stdout, /Added follow-up task T2 \(follow-up-01-write-the-docs\)/u);
    assert.match(ctx.tracker(), /\| T2 · Write the docs/u);
    assert.match(ctx.tracker(), /^Next task id: T3$/mu);

    // Remove T2 by hand: its id is not given out again.
    fs.writeFileSync(ctx.trackerPath, ctx.tracker().replace(/\n- \[ \] Kind: follow-up \| Status: todo \| T2 · Write the docs\n/u, "\n"), "utf8");
    assertSuccess(ctx.run("add-follow-up-task.mjs", ["--title", "Benchmark"]));
    assert.match(ctx.tracker(), /\| T3 · Benchmark/u);
    assert.doesNotMatch(ctx.tracker(), /T2 ·/u);
  } finally {
    cleanup(ctx);
  }
});

test("ids survive archiving a phase, even when the header is lost", () => {
  const ctx = setup("ids-archive", LEGACY_TRACKER);
  try {
    assertSuccess(ctx.run("role-summary.mjs"));
    const migrated = ctx.tracker();
    // Archive Phase 1's tasks the way manager housekeeping does, and drop the header line too.
    const phase1 = migrated.slice(migrated.indexOf("- [ ] Kind: implementation"), migrated.indexOf("### Phase 2"));
    fs.writeFileSync(path.join(ctx.epicDir, "tracker.closed-phases.previous-layer-01.md"), `# Archive\n\n### Phase 1: Build\n\n${phase1}`, "utf8");
    fs.writeFileSync(ctx.trackerPath, migrated.replace(phase1, "- Tasks: archived.\n\n").replace(/^Next task id: T\d+\n\n/mu, ""), "utf8");
    assertSuccess(ctx.run("add-follow-up-task.mjs", ["--title", "After the archive"]));
    assert.match(ctx.tracker(), /\| T5 · After the archive/u);
    assert.match(ctx.tracker(), /^Next task id: T6$/mu);
  } finally {
    cleanup(ctx);
  }
});

test("a tracker without ids is migrated deterministically on first use, and a rerun changes nothing", () => {
  const a = setup("ids-migrate-a", LEGACY_TRACKER);
  const b = setup("ids-migrate-b", LEGACY_TRACKER);
  try {
    assertSuccess(a.run("role-summary.mjs"));
    assertSuccess(b.run("render-tracker.mjs"));
    const first = a.tracker();
    assert.match(first, /Epic: Ids Epic\n\nNext task id: T5\n\n## Task Statuses/u);
    assert.deepEqual(
      first.split("\n").filter((line) => OLD_TASK_LINE.test(line)),
      [
        "- [ ] Kind: implementation | Status: todo | T1 · Build the parser",
        "- [ ] Kind: verification | Status: todo | T2 · Verify the parser",
        "- [ ] Kind: review | Status: todo | T3 · Open the pull request",
        "- [ ] Kind: follow-up | Status: todo | T4 · Document the parser",
      ],
    );
    // Only the id prefixes and the header were added.
    assert.equal(first.replace(/T\d+ · /gu, "").replace("Next task id: T5\n\n", ""), LEGACY_TRACKER);
    assert.match(b.tracker(), /\| T1 · Build the parser/u);

    assertSuccess(a.run("role-summary.mjs"));
    assert.equal(a.tracker(), first, "a rerun leaves the bytes unchanged");

    // Positional ids keep working, and the follow-up keeps its positional id.
    assertSuccess(a.run("set-task-status.mjs", ["--task-id", "phase-1-task-2", "--status", "doing"]));
    assert.match(a.tracker(), /Status: doing \| T2 · Verify the parser/u);
    assertSuccess(a.run("set-task-status.mjs", ["--task-id", "follow-up-01-document-the-parser", "--status", "blocked"]));
    const roadmap = readJsonFile(path.join(a.epicDir, ".runtime", "roadmap-state.json"));
    assert.deepEqual(
      roadmap.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, task.tid, task.title])),
      [
        ["phase-1-task-1", "T1", "Build the parser"],
        ["phase-1-task-2", "T2", "Verify the parser"],
        ["phase-2-task-1", "T3", "Open the pull request"],
      ],
    );
    assert.equal(roadmap.follow_ups[0].tid, "T4");
  } finally {
    cleanup(a);
    cleanup(b);
  }
});

test("the task scripts accept T<n>, t<n> and T-<n>", () => {
  const ctx = setup("ids-scripts", LEGACY_TRACKER);
  try {
    assertSuccess(ctx.run("start-task.mjs", ["--task-id", "T1"]));
    assert.match(ctx.tracker(), /Status: doing \| T1 · Build the parser/u);
    assert.match(ctx.run("role-summary.mjs").stdout, /Active task: Phase 1 Task 1 \(T1\) - Build the parser/u);
    assertSuccess(ctx.run("close-task.mjs", ["--task-id", "t1"]));
    assert.match(ctx.tracker(), /- \[x\] Kind: implementation \| Status: done \| T1 · Build the parser/u);
    assertSuccess(ctx.run("set-task-status.mjs", ["--task-id", "T-3", "--status", "blocked"]));
    assert.match(ctx.tracker(), /Status: blocked \| T3 · Open the pull request/u);
    assertSuccess(ctx.run("set-active-task.mjs", ["--task-id", "T4"]));
    assert.match(ctx.run("role-summary.mjs").stdout, /Active task: Follow-up \(T4\) - Document the parser/u);
    const missing = ctx.run("start-task.mjs", ["--task-id", "T99"]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Task not found: T99/u);
  } finally {
    cleanup(ctx);
  }
});

test("doctor's epic compatibility repair assigns the ids and reports it once", () => {
  const ctx = setup("ids-doctor", LEGACY_TRACKER);
  try {
    const doctor = (cli) => {
      const result = cli
        ? spawnSync(process.execPath, [path.join(repoRoot, "packages", "cli", "src", "cli.mjs"), "doctor", "--platform", "codex", "--json", "--root", ctx.root], {
            encoding: "utf8",
            env: {
              ...process.env,
              EPIC_LOOP_CODEX_BIN: path.join(ctx.root, "no-codex"),
              EPIC_LOOP_NO_UPDATE_CHECK: "1",
              EPIC_LOOP_SKILL_DIR: path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop"),
              HOME: ctx.root,
            },
          })
        : runNodeScript("doctor.mjs", ["--root", ctx.root, "--platform", "codex", "--json"]);
      return JSON.parse(result.stdout).epicCompatibility.repaired.filter((repair) => repair.type === "assigned-task-ids");
    };
    assert.equal(doctor(true).length, 1, "the CLI doctor migrates");
    assert.match(ctx.tracker(), /\| T1 · Build the parser/u);
    assert.equal(doctor(false).length, 0, "the skill doctor finds nothing left to do");
    fs.writeFileSync(ctx.trackerPath, LEGACY_TRACKER, "utf8");
    assert.equal(doctor(false).length, 1, "the skill doctor migrates too");
  } finally {
    cleanup(ctx);
  }
});

test("id-index resolves every id kind, hyphenated aliases, duplicates and unknown mentions", () => {
  const ctx = setup("ids-index", LEGACY_TRACKER);
  try {
    assertSuccess(ctx.run("role-summary.mjs"));
    fs.writeFileSync(
      path.join(ctx.epicDir, "tracker.closed-phases.previous-layer-01.md"),
      "# Archive\n\n### Phase 0: Shape\n\n- [x] Kind: documentation-only | Status: done | T9 · Shape the epic\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(ctx.epicDir, "decision-log.md"),
      "# Decision Log\n\n## Active Decisions\n\n- **D1 — Use the built-in test runner** (2026-10-18).\n- **D2 — Ship weekly** (2026-10-19; agent-made, stop class C; unconfirmed).\n- **D2 — Ship weekly again** (2026-10-19).\n\n## Open Questions\n\n- **Q1 — Which registry?** Resolved by D1.\n- **Q2 — Which license?** Open.\n",
      "utf8",
    );
    assertSuccess(ctx.run("human-queue.mjs", ["add", "--kind", "human-action", "--ask", "Publish the package", "--why", "only the human can", "--blocks", "T3"]));
    fs.writeFileSync(
      path.join(ctx.epicDir, "risk-register.md"),
      "# Risk Register\n\n| Id | Risk | Impact | Mitigation | Status |\n| --- | --- | --- | --- | --- |\n| R1 | The parser is slow | Timeouts | Benchmark (T4) | open |\n",
      "utf8",
    );
    fs.mkdirSync(path.join(ctx.epicDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(ctx.epicDir, "docs", "notes.md"), "See D-1, T-2 and H1; R1 is open. Q-2 waits. D77 is a typo.\n", "utf8");

    const result = ctx.run("id-index.mjs", ["--json"]);
    assertSuccess(result);
    const index = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(index).sort(), ["aliases", "duplicates", "files", "ids", "unknown"]);
    assert.deepEqual((({ file, kind, phase, status, title }) => ({ file, kind, phase, status, title }))(index.ids.T2), {
      file: "tracker.md",
      kind: "task",
      phase: "Phase 1: Build",
      status: "todo",
      title: "Verify the parser",
    });
    assert.equal(index.ids.T4.phase, "Follow-Up Tasks");
    assert.deepEqual((({ file, kind, title }) => ({ file, kind, title }))(index.ids.T9), {
      file: "tracker.closed-phases.previous-layer-01.md",
      kind: "task",
      title: "Shape the epic",
    });
    assert.deepEqual((({ file, kind, title }) => ({ file, kind, title }))(index.ids.D1), { file: "decision-log.md", kind: "decision", title: "Use the built-in test runner" });
    assert.deepEqual((({ kind, resolved, title }) => ({ kind, resolved, title }))(index.ids.Q1), { kind: "open-question", resolved: true, title: "Which registry?" });
    assert.equal(index.ids.Q2.resolved, undefined);
    assert.deepEqual((({ file, hold_kind, kind, status, title }) => ({ file, hold_kind, kind, status, title }))(index.ids.H1), {
      file: "human-queue.md",
      hold_kind: "human-action",
      kind: "human-queue",
      status: "open",
      title: "Publish the package",
    });
    assert.deepEqual((({ kind, status, title }) => ({ kind, status, title }))(index.ids.R1), { kind: "risk", status: "open", title: "The parser is slow" });
    assert.deepEqual(index.aliases, { "D-1": "D1", "Q-2": "Q2", "T-2": "T2" });
    assert.deepEqual(
      index.duplicates.map((duplicate) => [duplicate.id, duplicate.first.line, duplicate.second.line]),
      [["D2", 6, 7]],
    );
    assert.deepEqual(index.unknown, [{ file: "docs/notes.md", id: "D77", line: 1 }]);

    const text = ctx.run("id-index.mjs");
    assert.match(text.stdout, /Ids in ids: T 5, D 2, H 1, R 1, Q 2/u);
    assert.match(text.stdout, /Duplicate D2: decision-log\.md:6 and decision-log\.md:7/u);
    assert.match(text.stdout, /Mentioned but not defined: D77/u);
  } finally {
    cleanup(ctx);
  }
});
