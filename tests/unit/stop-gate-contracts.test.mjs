import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { STOP_REPORT_FIXTURE, assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const STOP_GATE_PLATFORMS = ["codex", "claude-code"];

// A bound driver loop with an open role turn (iteration 2), on the given platform.
function setupStopGateLoop(prefix, platform, role = "techlead", extra = {}, chat = "Role report in this turn") {
  const root = makeTempRoot(prefix);
  const slug = "stop-gate";
  const sessionId = "stop-gate-session";
  const transcriptPath = path.join(root, "transcript.jsonl");
  const epicRuntime = path.join(root, ".epic-loop", "epics", slug, ".runtime");

  fs.writeFileSync(transcriptPath, `${JSON.stringify({ type: "assistant", message: { content: chat } })}\n`, "utf8");
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Stop gate project", "--slug", slug, "--no-gitignore"]));
  fs.writeFileSync(path.join(epicRuntime, "current-engineer-prompt.md"), "Add mean(values) to src/stats.mjs.\n", "utf8");
  writeOpenImplementationTurn(root, slug, role, { turn_key: "prompt-stop-gate", ...extra });
  writeSessionBinding(root, slug, sessionId);

  const script = (name, args = [], input = undefined) => runNodeScript(name, ["--root", root, "--slug", slug, ...args], { input });
  const stop = () => {
    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "Stop",
        last_assistant_message: chat,
        prompt_id: "prompt-stop-gate",
        session_id: sessionId,
        stop_hook_active: true,
        transcript_path: transcriptPath,
        turn_id: "turn-stop-gate",
      }),
    });
    assertSuccess(result);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };

  return {
    epicRuntime,
    loop: () => readJsonFile(path.join(epicRuntime, "runtime-state.json")).implementation_loop,
    progressEvents: () =>
      fs
        .readFileSync(path.join(epicRuntime, "progress-log.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    requestStop: (stopClass, reason = "the epic is done", blocks = "nothing left") => script("request-stop.mjs", ["--class", stopClass, "--reason", reason, "--blocks", blocks]),
    root,
    script,
    stop,
  };
}

for (const platform of STOP_GATE_PLATFORMS) {
  test(`${platform}: set-next-role refuses idle inside techlead and manager turns`, () => {
    const techlead = setupStopGateLoop("stop-gate-idle-techlead-", platform, "techlead");
    const manager = setupStopGateLoop("stop-gate-idle-manager-", platform, "manager");
    const noTurn = setupStopGateLoop("stop-gate-idle-no-turn-", platform, "techlead", { active_turn_stopped_at: "2026-07-01T00:01:00+00:00" });

    try {
      const fromTechlead = techlead.script("set-next-role.mjs", ["--role", "idle"]);
      assert.notEqual(fromTechlead.status, 0);
      assert.match(fromTechlead.stderr, /request-stop\.mjs/u);
      assert.equal(techlead.loop().status, "running");

      const fromManager = manager.script("set-next-role.mjs", ["--role", "idle"]);
      assert.notEqual(fromManager.status, 0);
      assert.match(fromManager.stderr, /review-stop\.mjs/u);

      // Outside a role turn, tooling may still set the loop idle.
      assertSuccess(noTurn.script("set-next-role.mjs", ["--role", "idle"]));
      assert.equal(noTurn.loop().status, "idle");
    } finally {
      for (const ctx of [techlead, manager, noTurn]) {
        fs.rmSync(ctx.root, { force: true, recursive: true });
      }
    }
  });

  test(`${platform}: request-stop routes the techlead to a manager stop review`, () => {
    const ctx = setupStopGateLoop("stop-gate-request-", platform, "techlead");
    const engineer = setupStopGateLoop("stop-gate-request-engineer-", platform, "engineer");

    try {
      const invalid = ctx.requestStop("Z");
      assert.notEqual(invalid.status, 0);
      assert.match(invalid.stderr, /Invalid --class "Z"/u);

      const fromEngineer = engineer.requestStop("A");
      assert.notEqual(fromEngineer.status, 0);
      assert.match(fromEngineer.stderr, /only inside an open techlead turn/u);

      assertSuccess(ctx.requestStop("c", "pick a date format", "task 3"));
      let loop = ctx.loop();
      assert.equal(loop.next_role, "manager");
      assert.equal(loop.next_role_set_iteration, 2);
      assert.deepEqual(
        { ...loop.stop_request, requested_at: undefined },
        {
          blocks: "task 3",
          class: "C",
          reason: "pick a date format",
          requested_at: undefined,
          requested_iteration: 2,
          round: 1,
        },
      );

      const review = ctx.stop();
      assert.equal(review.decision, "block");
      assert.match(review.reason, /manager stop review turn 3/u);
      assert.match(review.reason, /Class: `C`/u);
      assert.match(review.reason, /Reason: pick a date format/u);
      assert.match(review.reason, /What it blocks: task 3/u);
      assert.match(review.reason, /Round: 1/u);
      assert.match(review.reason, /review-stop\.mjs --slug "stop-gate" --outcome accepted/u);
      assert.doesNotMatch(review.reason, /housekeeping reason/u);
      loop = ctx.loop();
      assert.equal(loop.current_role, "manager");
      assert.equal(loop.stop_review_iteration, 3);

      const fromManager = ctx.requestStop("A");
      assert.notEqual(fromManager.status, 0);

      const setNext = ctx.script("set-next-role.mjs", ["--role", "techlead"]);
      assert.notEqual(setNext.status, 0);
      assert.match(setNext.stderr, /stop-review turn/u);
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
      fs.rmSync(engineer.root, { force: true, recursive: true });
    }
  });

  test(`${platform}: an accepted stop review ends the loop and logs a stop-gate event`, () => {
    const ctx = setupStopGateLoop("stop-gate-accept-", platform, "techlead");
    const housekeeping = setupStopGateLoop("stop-gate-accept-housekeeping-", platform, "manager");

    try {
      const outsideReview = housekeeping.script("review-stop.mjs", ["--outcome", "accepted"]);
      assert.notEqual(outsideReview.status, 0);
      assert.match(outsideReview.stderr, /only inside a manager stop-review turn/u);

      assertSuccess(ctx.requestStop("A", "phase 1 verified", "nothing left"));
      assert.equal(ctx.stop().decision, "block");

      const badOutcome = ctx.script("review-stop.mjs", ["--outcome", "maybe"]);
      assert.notEqual(badOutcome.status, 0);

      assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE));
      const loop = ctx.loop();
      assert.equal(loop.status, "idle");
      assert.equal(loop.next_role, "idle");
      assert.equal(loop.stop_request, null);

      assert.equal(ctx.stop(), null);
      // The saved English stop report is the manager report.
      assert.match(fs.readFileSync(path.join(ctx.epicRuntime, "latest-manager-report.md"), "utf8"), /# Stop Report 01[\s\S]*## Next And How To Resume/u);

      const gates = ctx.progressEvents().filter((event) => event.action === "stop-gate");
      assert.equal(gates.length, 1);
      assert.deepEqual(
        { ...gates[0], timestamp: undefined },
        {
          action: "stop-gate",
          blocks: "nothing left",
          class: "A",
          instruction: null,
          iteration: 3,
          outcome: "accepted",
          reason: "phase 1 verified",
          report_path: loop.last_stop_report_path,
          round: 1,
          slug: "stop-gate",
          timestamp: undefined,
        },
      );
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
      fs.rmSync(housekeeping.root, { force: true, recursive: true });
    }
  });

  test(`${platform}: a challenged stop returns to the techlead with the instruction and counts rounds`, () => {
    const ctx = setupStopGateLoop("stop-gate-challenge-", platform, "techlead");

    try {
      assertSuccess(ctx.requestStop("D", "port 3000 is busy", "browser verification"));
      assert.equal(ctx.stop().decision, "block");

      const noInstruction = ctx.script("review-stop.mjs", ["--outcome", "challenged"]);
      assert.notEqual(noInstruction.status, 0);
      assert.match(noInstruction.stderr, /--instruction/u);

      assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "challenged", "--instruction", "Run the dev server on port 3001 and continue."]));
      assert.equal(ctx.loop().status, "running");
      assert.equal(ctx.loop().next_role, "techlead");

      const techlead = ctx.stop();
      assert.equal(techlead.decision, "block");
      assert.match(techlead.reason, /techlead turn 4/u);
      assert.match(techlead.reason, /Stop Request Challenged/u);
      assert.match(techlead.reason, /class D, round 1/u);
      assert.match(techlead.reason, /Your reason: port 3000 is busy/u);
      assert.match(techlead.reason, /Run the dev server on port 3001 and continue\./u);
      assert.equal(ctx.loop().stop_challenge, null);

      // A repeated request after the challenge is round 2.
      assertSuccess(ctx.requestStop("D", "port 3001 is busy too", "browser verification"));
      assert.equal(ctx.loop().stop_request.round, 2);
      const secondReview = ctx.stop();
      assert.match(secondReview.reason, /Round: 2/u);
      assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "challenged", "--instruction", "Defer the browser check to the phase verification."]));

      // The challenge is delivered once; an engineer turn resets the round counter.
      const nextTechlead = ctx.stop();
      assert.match(nextTechlead.reason, /Defer the browser check/u);
      const promptFile = ".epic-loop/epics/stop-gate/.runtime/current-engineer-prompt.md";
      assertSuccess(ctx.script("set-next-role.mjs", ["--role", "engineer", "--prompt-file", promptFile]));
      assert.equal(ctx.loop().stop_rounds, 0);
      assert.match(ctx.stop().reason, /Focused implementation task/u);
      const afterEngineer = ctx.stop();
      assert.match(afterEngineer.reason, /techlead turn/u);
      assert.doesNotMatch(afterEngineer.reason, /Stop Request Challenged/u);
      assertSuccess(ctx.requestStop("A"));
      assert.equal(ctx.loop().stop_request.round, 1);

      const gates = ctx.progressEvents().filter((event) => event.action === "stop-gate");
      assert.deepEqual(
        gates.map((event) => [event.class, event.outcome, event.round, event.instruction]),
        [
          ["D", "challenged", 1, "Run the dev server on port 3001 and continue."],
          ["D", "challenged", 2, "Defer the browser check to the phase verification."],
        ],
      );
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
    }
  });

  test(`${platform}: the user stop still ends the loop from techlead and stop-review turns`, () => {
    const techlead = setupStopGateLoop("stop-gate-user-techlead-", platform, "techlead");
    const review = setupStopGateLoop("stop-gate-user-review-", platform, "techlead");

    try {
      assertSuccess(techlead.script("stop-loop.mjs"));
      assert.equal(techlead.loop().status, "interrupted");
      assert.equal(techlead.loop().next_role, "idle");
      assert.equal(techlead.stop(), null);

      assertSuccess(review.requestStop("F", "pick the pricing model", "all remaining tasks"));
      assert.equal(review.stop().decision, "block");
      assertSuccess(review.script("stop-loop.mjs"));
      assert.equal(review.loop().status, "interrupted");
      assert.equal(review.stop(), null);
      assert.equal(review.progressEvents().filter((event) => event.action === "stop-gate").length, 0);
    } finally {
      fs.rmSync(techlead.root, { force: true, recursive: true });
      fs.rmSync(review.root, { force: true, recursive: true });
    }
  });
}

const CLASS_RULE_EXPECTATIONS = {
  A: [/Accept\. Never challenge a class A stop\./u],
  B: [
    /independent work left: queue the item, then challenge/iu,
    /human-queue\.mjs add --slug "stop-gate" --kind human-action/u,
    /`security-hold`/u,
    /Nothing independent left: accept\./u,
  ],
  C: [/Challenge with: "take the default <X>, record it with `agent-decision\.mjs add`/u, /--kind costly-decision/u],
  D: [/Challenge with a concrete workaround/u, /Accept only when nothing else is left\./u],
  E: [/Never a stop\. Challenge with: "reorder/u],
  F: [/human-queue\.mjs add --slug "stop-gate" --kind product-decision/u, /Nothing independent left: accept\./u],
};

test("the stop-review prompt carries the rule of the requested class only", () => {
  for (const [stopClass, patterns] of Object.entries(CLASS_RULE_EXPECTATIONS)) {
    const ctx = setupStopGateLoop(`stop-gate-rule-${stopClass}-`, "codex", "techlead");
    try {
      assertSuccess(ctx.requestStop(stopClass, `reason for ${stopClass}`, "the next task"));
      const review = ctx.stop().reason;
      assert.match(review, new RegExp(`^Class ${stopClass}, `, "mu"), stopClass);
      for (const other of Object.keys(CLASS_RULE_EXPECTATIONS).filter((key) => key !== stopClass)) {
        assert.doesNotMatch(review, new RegExp(`^Class ${other}, `, "mu"), `${stopClass} prompt has the ${other} rule`);
      }
      for (const pattern of patterns) {
        assert.match(review, pattern, stopClass);
      }
      assert.doesNotMatch(review, /repeated request after a challenge: accept it/u);
      assert.doesNotMatch(review, /<HumanQueueAdd>|-<<\*\{\{/u);
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
    }
  }
});

test("a repeated stop request is reviewed with the accept rule and the challenge points to the techlead guidance", () => {
  const ctx = setupStopGateLoop("stop-gate-rule-round-2-", "codex", "techlead");

  try {
    assertSuccess(ctx.requestStop("E", "task 3 must wait for task 4", "task 3"));
    assert.equal(ctx.stop().decision, "block");
    assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "challenged", "--instruction", "Reorder: start task 4 first."]));

    const techlead = ctx.stop().reason;
    assert.match(techlead, /What to do for each class: see "After A Challenge" in .*implementation-techlead-role\.md\./u);

    assertSuccess(ctx.requestStop("E", "task 4 needs task 3 too", "tasks 3 and 4"));
    const review = ctx.stop().reason;
    assert.match(review, /This is a repeated request after a challenge: accept it\./u);
    assert.match(review, /^Class E, /mu);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

const STOP_REPORT_HEADINGS = [
  "## Where The Epic Stands",
  "## Achieved Since The Last Report",
  "## Why The Loop Stopped",
  "## What You Need To Do Or Decide",
  "## Agent-Made Decisions To Confirm",
  "## Next And How To Resume",
];
// The chat copy of a report is in the user's language; German here, as plain test data.
const GERMAN_CHAT_REPORT = "Bericht: Phase 1 ist abgeschlossen. Bitte den Pull Request pruefen.";

test("an accepted stop saves a numbered English stop report and the next review points to it", () => {
  const ctx = setupStopGateLoop("stop-report-save-", "codex", "techlead");

  try {
    assertSuccess(ctx.requestStop("A", "phase 1 verified", "nothing left"));
    const firstReview = ctx.stop().reason;
    assert.match(firstReview, /## Stop Report/u);
    for (const heading of STOP_REPORT_HEADINGS) {
      assert.ok(firstReview.includes(heading), heading);
    }
    assert.match(firstReview, /Previous stop report: `none`/u);
    assert.match(firstReview, /bind-session\.mjs --current --slug stop-gate --mode implementation/u);
    assert.match(firstReview, /review-stop\.mjs --slug "stop-gate" --outcome accepted --stdin/u);
    assert.match(firstReview, /same report in the user's language/u);

    const accepted = ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE);
    assertSuccess(accepted);
    const loop = ctx.loop();
    assert.equal(loop.status, "idle");
    assert.match(loop.last_stop_report_path, /^\.epic-loop\/epics\/stop-gate\/stop-reports\/01-\d{4}-\d{2}-\d{2}-class-A\.md$/u);
    const saved = fs.readFileSync(path.join(ctx.root, loop.last_stop_report_path), "utf8");
    assert.match(saved, /^# Stop Report 01\n\n- Date: \d{4}-\d{2}-\d{2}\n- Stop class: A\n- Techlead reason: phase 1 verified\n\n## Where The Epic Stands\n/u);
    assert.ok(saved.endsWith(STOP_REPORT_FIXTURE));
    assert.equal(ctx.progressEvents().find((event) => event.action === "stop-gate").report_path, loop.last_stop_report_path);
    assert.equal(ctx.stop(), null);

    // A later run of the loop (rebound) numbers the next report 02 and shows 01 as previous.
    writeOpenImplementationTurn(ctx.root, "stop-gate", "techlead", { driver_session_id: "stop-gate-session", turn_key: "prompt-stop-gate" });
    assertSuccess(ctx.requestStop("B", "npm publish needs the human", "the release task"));
    assert.ok(ctx.stop().reason.includes(`Previous stop report: \`${loop.last_stop_report_path}\``));
    assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE));
    assert.match(ctx.loop().last_stop_report_path, /\/02-\d{4}-\d{2}-\d{2}-class-B\.md$/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("an incomplete or empty stop report is refused and the review stays open", () => {
  const ctx = setupStopGateLoop("stop-report-refused-", "codex", "techlead");

  try {
    assertSuccess(ctx.requestStop("F", "pick the pricing model", "all remaining tasks"));
    assert.equal(ctx.stop().decision, "block");

    const partial = STOP_REPORT_FIXTURE.replace("## Why The Loop Stopped\n", "").replace("## Agent-Made Decisions To Confirm\n", "");
    const missing = ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], partial);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /missing headings: ## Why The Loop Stopped, ## Agent-Made Decisions To Confirm\./u);

    const empty = ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], "  \n");
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /stop report is empty/u);

    const noStdin = ctx.script("review-stop.mjs", ["--outcome", "accepted"]);
    assert.notEqual(noStdin.status, 0);
    assert.match(noStdin.stderr, /requires the English stop report on stdin/u);

    const loop = ctx.loop();
    assert.equal(loop.status, "running");
    assert.equal(loop.stop_request.class, "F");
    assert.equal(fs.existsSync(path.join(ctx.root, ".epic-loop", "epics", "stop-gate", "stop-reports")), false);
    assert.equal(ctx.progressEvents().filter((event) => event.action === "stop-gate").length, 0);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

for (const platform of STOP_GATE_PLATFORMS) {
  test(`${platform}: the manager report of an accepted stop is the saved English copy`, () => {
    const ctx = setupStopGateLoop(`stop-report-copy-${platform}-`, platform, "techlead", {}, GERMAN_CHAT_REPORT);

    try {
      assertSuccess(ctx.requestStop("A", "phase 1 verified", "nothing left"));
      assert.equal(ctx.stop().decision, "block");
      assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE));
      assert.equal(ctx.stop(), null);

      const latest = fs.readFileSync(path.join(ctx.epicRuntime, "latest-manager-report.md"), "utf8");
      assert.match(latest, /# Stop Report 01/u);
      assert.match(latest, /## Next And How To Resume\nReview the PR, then rebind the session\./u);
      assert.doesNotMatch(latest, /Bericht/u);
      assert.doesNotMatch(fs.readFileSync(path.join(ctx.epicRuntime, "manager-reports.jsonl"), "utf8"), /Bericht/u);
    } finally {
      fs.rmSync(ctx.root, { force: true, recursive: true });
    }
  });
}

test("human waits always go through the gate and B/F challenges name the on-hold command", () => {
  const ctx = setupStopGateLoop("stop-gate-human-wait-", "codex", "techlead");

  try {
    assertSuccess(ctx.requestStop("B", "npm publish needs the owner's login", "the publish task"));
    const review = ctx.stop().reason;
    assert.match(review, /set-task-status\.mjs --slug "stop-gate" --task-id <phase-N-task-k> --status on-hold --hold-kind human-action --hold-item H<n>/u);
    assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "challenged", "--instruction", "Queued H1; set phase-1-task-5 on-hold; continue with phase-1-task-6."]));
    // The techlead prompt carries the rule on every turn, including the one after a challenge.
    const techlead = ctx.stop().reason;
    assert.match(techlead, /file a stop request for it even if other work is independent/u);
    assert.match(techlead, /Never mark such a task `blocked`/u);

    assertSuccess(ctx.requestStop("F", "tier names have no default", "the footer task"));
    assert.match(ctx.stop().reason, /--status on-hold --hold-kind product-decision --hold-item H<n>/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("an accepted stop prints the one commit for its report and the review's epic changes", () => {
  const ctx = setupStopGateLoop("stop-gate-report-commit-", "codex", "techlead");

  try {
    assertSuccess(ctx.script("human-queue.mjs", ["add", "--kind", "human-action", "--ask", "publish", "--why", "login", "--blocks", "release"]));
    assertSuccess(ctx.requestStop("A", "epic done", "nothing left"));
    const review = ctx.stop().reason;
    assert.match(review, /git commit -m "docs\(epic\): stop report NN \(class X\)"/u);
    assert.match(review, /never `git add -A`/u);

    const accepted = ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE);
    assertSuccess(accepted);
    const reportPath = ctx.loop().last_stop_report_path;
    assert.ok(accepted.stdout.includes(`git add ${reportPath} .epic-loop/epics/stop-gate/human-queue.md .epic-loop/epics/stop-gate/decision-log.md`), accepted.stdout);
    assert.match(accepted.stdout, /git commit -m "docs\(epic\): stop report 01 \(class A\)"/u);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});
