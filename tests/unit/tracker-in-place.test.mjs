import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, runNodeScript } from "./test-utils.mjs";

const SLUG = "shaped";

// Shaped by hand, the way trackers look after shaping: prose, extra phase lines, nested bullets
// and verification labels that the roadmap model does not know about.
const UNMIGRATED_TRACKER = `# Tracker

Epic: Shaped Epic

## Task Statuses

- todo
- doing
- need-review
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Active Roadmap

Order agreed in shaping: Phase 1 first, then Phase 2.

### Phase 1: Build

- Phase status: todo
- Delivery: main checkout, own branch.
- Intent: hand-written phase intent.

- [ ] Kind: implementation | Status: todo | Build the parser
  - Outcome:
    - Parses the input.
    - Rejects bad input.
  - Surface: \`src/parser.mjs\`
  - Acceptance: unit tests pass.
  - Docs: \`docs/parser.md\`

- [ ] Kind: verification | Status: todo | Verify the parser end to end
  - Method: run the CLI on fixtures.
  - Tools: node test runner.
  - Evidence:
    - stdout of each fixture run;
    - exit codes.
  - Cleanup: remove the temp fixtures.

### Phase 2: Ship

- Phase status: todo
- Intent: release it.

- [ ] Kind: review | Status: todo | Open the pull request
  - Outcome: a PR exists.
`;

// The same tracker after the stable-id migration (D27): T1-T3 in tracker order and the
// next-id header. The in-place tests below start from it, so they see only their own change.
const SHAPED_TRACKER = UNMIGRATED_TRACKER.replace("Epic: Shaped Epic\n", "Epic: Shaped Epic\n\nNext task id: T4\n")
  .replace("| Build the parser", "| T1 · Build the parser")
  .replace("| Verify the parser end to end", "| T2 · Verify the parser end to end")
  .replace("| Open the pull request", "| T3 · Open the pull request");
const shapedWithNext = (next) => SHAPED_TRACKER.replace("Next task id: T4", `Next task id: ${next}`);

function setupShaped(prefix) {
  const root = makeTempRoot(prefix);
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Shaped epic", "--slug", SLUG, "--no-gitignore"]));
  const trackerPath = path.join(root, ".epic-loop", "epics", SLUG, "tracker.md");
  fs.writeFileSync(trackerPath, SHAPED_TRACKER, "utf8");
  // init-epic cached its initial roadmap; the shaped tracker must win over that stale cache.
  return {
    root,
    run: (script, args = []) => runNodeScript(script, ["--root", root, "--slug", SLUG, ...args]),
    tracker: () => fs.readFileSync(trackerPath, "utf8"),
    trackerPath,
  };
}

// Line-level diff for same-length texts: { index: [before, after] } for each changed line.
function changedLines(before, after) {
  const left = before.split("\n");
  const right = after.split("\n");
  assert.equal(right.length, left.length, "line count changed");
  return Object.fromEntries(left.flatMap((line, index) => (line === right[index] ? [] : [[index, [line, right[index]]]])));
}

const line = (text) => SHAPED_TRACKER.split("\n").indexOf(text);
const PHASE_1_STATUS = line("- Phase status: todo");
const PHASE_2_STATUS = SHAPED_TRACKER.split("\n").lastIndexOf("- Phase status: todo");
const TASK_1 = line("- [ ] Kind: implementation | Status: todo | T1 · Build the parser");
const TASK_2 = line("- [ ] Kind: verification | Status: todo | T2 · Verify the parser end to end");

test("task and phase scripts change only the intended tracker lines", () => {
  const cases = [
    {
      args: ["--task-id", "phase-1-task-1", "--status", "doing"],
      expected: {
        [PHASE_1_STATUS]: ["- Phase status: todo", "- Phase status: doing"],
        [TASK_1]: ["- [ ] Kind: implementation | Status: todo | T1 · Build the parser", "- [ ] Kind: implementation | Status: doing | T1 · Build the parser"],
      },
      script: "set-task-status.mjs",
    },
    {
      args: ["--task-id", "phase-1-task-2"],
      expected: {
        [PHASE_1_STATUS]: ["- Phase status: todo", "- Phase status: doing"],
        [TASK_2]: ["- [ ] Kind: verification | Status: todo | T2 · Verify the parser end to end", "- [ ] Kind: verification | Status: doing | T2 · Verify the parser end to end"],
      },
      script: "start-task.mjs",
    },
    {
      args: ["--task-id", "phase-1-task-1"],
      expected: { [TASK_1]: ["- [ ] Kind: implementation | Status: todo | T1 · Build the parser", "- [x] Kind: implementation | Status: done | T1 · Build the parser"] },
      script: "close-task.mjs",
    },
    { args: ["--phase-id", "phase-2"], expected: { [PHASE_2_STATUS]: ["- Phase status: todo", "- Phase status: doing"] }, script: "start-phase.mjs" },
    { args: ["--phase-id", "phase-1"], expected: { [PHASE_1_STATUS]: ["- Phase status: todo", "- Phase status: done"] }, script: "close-phase.mjs" },
    { args: ["--task-id", "phase-2-task-1"], expected: { [PHASE_2_STATUS]: ["- Phase status: todo", "- Phase status: doing"] }, script: "set-active-task.mjs" },
    { args: ["--phase-id", "phase-2"], expected: {}, script: "set-active-phase.mjs" },
  ];

  for (const { args, expected, script } of cases) {
    const ctx = setupShaped(`tracker-in-place-${script.replace(".mjs", "")}-`);
    try {
      assertSuccess(ctx.run(script, args));
      assert.deepEqual(changedLines(SHAPED_TRACKER, ctx.tracker()), expected, script);
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
    }
  }
});

test("hand edits to tracker.md are respected after the roadmap cache exists", () => {
  const ctx = setupShaped("tracker-in-place-hand-edit-");

  try {
    assertSuccess(ctx.run("start-task.mjs", ["--task-id", "phase-1-task-1"]));
    const handTask = "- [ ] Kind: follow-up | Status: todo | Hand-added task\n  - Outcome:\n    - written after the cache existed.\n";
    fs.writeFileSync(ctx.trackerPath, ctx.tracker().replace("### Phase 2: Ship", `${handTask}\n### Phase 2: Ship`), "utf8");
    const before = ctx.tracker();

    const started = ctx.run("start-task.mjs", ["--task-id", "phase-1-task-3"]);
    assertSuccess(started);
    const after = ctx.tracker();
    // The hand-added task line gets the next stable id, and the header moves on.
    assert.match(after, /- \[ \] Kind: follow-up \| Status: doing \| T4 · Hand-added task\n {2}- Outcome:\n {4}- written after the cache existed\.\n/u);
    assert.deepEqual(
      Object.values(changedLines(before, after)).map(([, right]) => right),
      ["Next task id: T5", "- [ ] Kind: follow-up | Status: doing | T4 · Hand-added task"],
    );
    assert.match(ctx.run("role-summary.mjs").stdout, /Active task: Phase 1 Task 3 \(T4\) - Hand-added task/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("on-hold needs an open human-queue item and writes, then clears, the Hold line", () => {
  const ctx = setupShaped("tracker-in-place-on-hold-");
  const hold = (extra) => ctx.run("set-task-status.mjs", ["--task-id", "phase-1-task-2", "--status", "on-hold", ...extra]);

  try {
    for (const ask of ["publish the package", "sign in"]) {
      assertSuccess(ctx.run("human-queue.mjs", ["add", "--kind", "human-action", "--ask", ask, "--why", "needs the human", "--blocks", "before shipping"]));
    }
    assertSuccess(ctx.run("human-queue.mjs", ["resolve", "--id", "H2", "--resolution", "signed in"]));

    const refusals = [
      [["--hold-kind", "urgent", "--hold-item", "H1"], /Invalid --hold-kind "urgent"/u],
      [["--hold-kind", "human-action"], /requires both --hold-kind/u],
      [["--hold-item", "H1"], /requires both --hold-kind/u],
      [["--hold-kind", "human-action", "--hold-item", "H9"], /Human-queue item not found: H9/u],
      [["--hold-kind", "human-action", "--hold-item", "H2"], /H2 is resolved/u],
    ];
    for (const [extra, message] of refusals) {
      const result = hold(extra);
      assert.notEqual(result.status, 0, extra.join(" "));
      assert.match(result.stderr, message);
    }
    const holdWithoutStatus = ctx.run("set-task-status.mjs", ["--task-id", "phase-1-task-2", "--status", "doing", "--hold-item", "H1"]);
    assert.notEqual(holdWithoutStatus.status, 0);
    assert.equal(ctx.tracker(), SHAPED_TRACKER);

    assertSuccess(hold(["--hold-kind", "human-action", "--hold-item", "h1"]));
    const held = ctx.tracker();
    assert.match(held, /- blocked\n- on-hold\n- partially-satisfied/u);
    assert.match(
      held,
      /- \[ \] Kind: verification \| Status: on-hold \| T2 · Verify the parser end to end\n {2}- Hold: human-action \(H1\)\n {2}- Method: run the CLI on fixtures\.\n {2}- Tools: node test runner\.\n {2}- Evidence:\n {4}- stdout of each fixture run;\n {4}- exit codes\.\n {2}- Cleanup: remove the temp fixtures\.\n/u,
    );
    assert.match(held, /### Phase 1: Build\n\n- Phase status: todo\n/u, "on-hold does not start the phase");
    assert.doesNotMatch(ctx.run("role-summary.mjs").stdout, /Active task: Phase 1 Task 2/u);

    assertSuccess(ctx.run("set-task-status.mjs", ["--task-id", "phase-1-task-2", "--status", "doing"]));
    const resumed = ctx.tracker();
    assert.doesNotMatch(resumed, /Hold:/u);
    assert.deepEqual(changedLines(SHAPED_TRACKER.replace("- blocked\n", "- blocked\n- on-hold\n"), resumed), {
      [PHASE_1_STATUS + 1]: ["- Phase status: todo", "- Phase status: doing"],
      [TASK_2 + 1]: ["- [ ] Kind: verification | Status: todo | T2 · Verify the parser end to end", "- [ ] Kind: verification | Status: doing | T2 · Verify the parser end to end"],
    });
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("add-follow-up-task appends under Follow-Up Tasks and changes nothing else", () => {
  const ctx = setupShaped("tracker-in-place-follow-up-");

  try {
    assertSuccess(ctx.run("add-follow-up-task.mjs", ["--title", "Document the parser", "--outcome", "Docs exist."]));
    const first = ctx.tracker();
    assert.ok(first.startsWith(shapedWithNext("T5")));
    assert.equal(first.slice(SHAPED_TRACKER.length), "\n## Follow-Up Tasks\n\n- [ ] Kind: follow-up | Status: todo | T4 · Document the parser\n  - Outcome: Docs exist.\n");

    const second = ctx.run("add-follow-up-task.mjs", ["--title", "Benchmark the parser"]);
    assertSuccess(second);
    assert.match(second.stdout, /T5 \(follow-up-02-benchmark-the-parser\)/u);
    assert.equal(ctx.tracker(), `${first.replace("Next task id: T5", "Next task id: T6")}\n- [ ] Kind: follow-up | Status: todo | T5 · Benchmark the parser\n`);

    assertSuccess(ctx.run("set-task-status.mjs", ["--task-id", "follow-up-01-document-the-parser", "--status", "doing"]));
    assert.match(ctx.tracker(), /Status: doing \| T4 · Document the parser/u);
    assert.match(ctx.run("role-summary.mjs").stdout, /Active task: Follow-up \(T4\) - Document the parser/u);
    assert.ok(ctx.tracker().startsWith(shapedWithNext("T6")));
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("render-tracker still re-renders the full model and drops hand-written detail", () => {
  const ctx = setupShaped("tracker-in-place-render-");

  try {
    assertSuccess(ctx.run("render-tracker.mjs"));
    const rendered = ctx.tracker();
    assert.match(
      rendered,
      /### Phase 1: Build\n\n- Phase status: todo\n\n- \[ \] Kind: implementation \| Status: todo \| T1 · Build the parser\n {2}- Surface: `src\/parser\.mjs`/u,
    );
    assert.match(rendered, /- on-hold/u);
    assert.doesNotMatch(rendered, /Intent: hand-written phase intent|Order agreed in shaping|Method: run the CLI/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});
