import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";

import {
  STOP_REPORT_FIXTURE,
  assertSuccess,
  makeTempRoot,
  readJsonFile,
  repoRoot,
  runNodeScript,
  scriptPath,
  writeOpenImplementationTurn,
  writeSessionBinding,
} from "./test-utils.mjs";

const SLUG = "stops";
const SESSION = "stops-session";
const REVIEW = "2026-10-20-stop-report";
const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
const started = new Set();

after(() => {
  for (const pid of started) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
});

// A stop-report page in the shape the manager asks for: H1 and the decision as h1 / d<n>
// controls, and the continue-after-submit switch.
function stopReportPage(decisionId, { withDecision = true, withSwitch = true } = {}) {
  const d = decisionId.toLowerCase();
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Stop report</title></head>
  <body>
    <main class="el-main">
      <div class="el-page-head"><div class="el-label">stop-report</div><h1>The loop stopped: the Stripe key is missing</h1><p>Phase 2 waits for one human action.</p></div>
      <el-card id="h1" title="H1: add the Stripe test key to CI">
        <p>The checkout test needs STRIPE_TEST_KEY in the CI secrets.</p>
        <el-check name="h1">Done: the key is set</el-check>
      </el-card>
${
  withDecision
    ? `      <el-card id="${d}" title="${decisionId}: system font stack">
        <el-choice name="${d}" recommended="confirm" rule="D2">
          <el-option value="confirm" note="Keeps the system fonts; no work.">Confirm</el-option>
          <el-option value="reverse" note="Adds the font files and one task.">Reverse</el-option>
        </el-choice>
      </el-card>
`
    : ""
}${withSwitch ? '      <el-card id="next" title="After you submit"><el-check name="continue-after-submit">Continue the loop after I submit</el-check></el-card>\n' : ""}    </main>
  </body>
</html>
`;
}

// A bound loop whose techlead filed a class B stop; the next Stop starts the manager stop review.
function setupStopLoop(prefix, platform = "claude-code") {
  const root = makeTempRoot(prefix);
  const epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  const transcript = path.join(root, "transcript.jsonl");
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Stops project", "--slug", SLUG, "--no-gitignore"]));
  writeOpenImplementationTurn(root, SLUG, "techlead", { turn_key: "prompt-stops" });
  writeSessionBinding(root, SLUG, SESSION);
  const script = (name, args = [], input = undefined) => runNodeScript(name, ["--root", root, "--slug", SLUG, ...args], { input });
  assertSuccess(script("human-queue.mjs", ["add", "--kind", "human-action", "--ask", "Add the Stripe test key to CI", "--why", "checkout test", "--blocks", "task 5"]));
  const decision = script("agent-decision.mjs", ["add", "--title", "System font stack", "--default", "system fonts", "--why", "saves 90 KB"]);
  assertSuccess(decision);
  const decisionId = decision.stdout.trim();

  const say = (text) => fs.writeFileSync(transcript, `${JSON.stringify({ type: "assistant", message: { content: text } })}\n`);
  say("Role report in this turn");
  const hook = (event, fields = {}) => {
    const message = JSON.parse(fs.readFileSync(transcript, "utf8")).message.content;
    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: event,
        last_assistant_message: message,
        session_id: SESSION,
        transcript_path: transcript,
        turn_id: "turn-stops",
        ...fields,
      }),
    });
    assertSuccess(result);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  const writePage = (id, html) => {
    const dir = path.join(epicDir, "reviews", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "page.html"), html);
    fs.writeFileSync(path.join(dir, "review.json"), `${JSON.stringify({ id, title: "Stop report", kind: "stop-report", created: "2026-10-20T10:00:00Z", languages: [] })}\n`);
    const check = spawnSync(process.execPath, [cliEntry, "review", "check", `${SLUG}/${id}`, "--root", root, "--json"], {
      encoding: "utf8",
      env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
    });
    return JSON.parse(check.stdout);
  };

  return {
    decisionId,
    epicDir,
    events: (action) =>
      fs
        .readFileSync(path.join(epicDir, ".runtime", "progress-log.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.action === action),
    gate: (args) => script("gate.mjs", args),
    loop: () => readJsonFile(path.join(epicDir, ".runtime", "runtime-state.json")).implementation_loop,
    reviewDir: (id = REVIEW) => path.join(epicDir, "reviews", id),
    root,
    say,
    script,
    stop: () => hook("Stop", { prompt_id: "prompt-stops", stop_hook_active: true }),
    writePage,
  };
}

const cleanup = (...contexts) => {
  for (const ctx of contexts) fs.rmSync(ctx.root, { force: true, recursive: true });
};

// Up to the accepted stop: stop review, a checked stop-report page, its gate, review-stop.
function acceptWithPage(ctx) {
  assertSuccess(ctx.script("request-stop.mjs", ["--class", "B", "--reason", "needs the Stripe key", "--blocks", "task 5"]));
  assert.match(ctx.stop().reason, /manager stop review turn 3/u);
  const check = ctx.writePage(REVIEW, stopReportPage(ctx.decisionId));
  assert.equal(check.ok, true, JSON.stringify(check.errors));
  assertSuccess(ctx.gate(["open", "--stop-report", "--review", REVIEW, "--covers", "H1"]));
  const accepted = ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE);
  assertSuccess(accepted);
  assert.match(accepted.stdout, /The loop waits for the stop report page \/stops\/reviews\/2026-10-20-stop-report\//u);
}

const submit = (ctx, controls) => fs.writeFileSync(path.join(ctx.reviewDir(), "answers.json"), `${JSON.stringify({ controls, submittedAt: "2026-10-20T11:00:00.000Z" })}\n`);

test("an accepted stop with a stop-report page waits for it; the stop-gate event names the review", () => {
  const ctx = setupStopLoop("stops-awaiting");
  try {
    acceptWithPage(ctx);
    const loop = ctx.loop();
    assert.equal(loop.status, "awaiting-review");
    assert.deepEqual((({ blocking, covers, kind, stop_class, status }) => ({ blocking, covers, kind, stop_class, status }))(loop.gates[0]), {
      blocking: true,
      covers: ["H1"],
      kind: "stop-report",
      stop_class: "B",
      status: "open",
    });
    assert.match(loop.gates[0].report_path, /stop-reports\/01-.*-class-B\.md$/u);
    const [gateEvent] = ctx.events("stop-gate");
    assert.equal(gateEvent.review, REVIEW);
    assert.equal(ctx.stop(), null, "the stop review turn ends with the loop waiting");
    assert.equal(ctx.loop().status, "awaiting-review");
    assert.match(ctx.script("role-summary.mjs").stdout, /2026-10-20-stop-report \[open\] stop report \(class B\), covers H1/u);
  } finally {
    cleanup(ctx);
  }
});

test("gate open --stop-report runs only in a stop review and refuses a page that misses what the human owes", () => {
  const housekeeping = setupStopLoop("stops-housekeeping");
  const ctx = setupStopLoop("stops-coverage");
  try {
    // A plain manager turn (housekeeping) cannot open a stop-report gate.
    writeOpenImplementationTurn(housekeeping.root, SLUG, "manager", { driver_session_id: SESSION });
    housekeeping.writePage(REVIEW, stopReportPage(housekeeping.decisionId));
    const outside = housekeeping.gate(["open", "--stop-report", "--review", REVIEW, "--covers", "H1"]);
    assert.notEqual(outside.status, 0);
    assert.match(outside.stderr, /only inside a manager stop-review turn/u);

    assertSuccess(ctx.script("request-stop.mjs", ["--class", "B", "--reason", "needs the key", "--blocks", "task 5"]));
    ctx.stop();
    ctx.writePage(REVIEW, stopReportPage(ctx.decisionId));
    const noCovers = ctx.gate(["open", "--stop-report", "--review", REVIEW]);
    assert.notEqual(noCovers.status, 0);
    assert.match(noCovers.stderr, /--covers misses open human-queue items H1/u);

    ctx.writePage("2026-10-20-no-decision", stopReportPage(ctx.decisionId, { withDecision: false }));
    const noDecision = ctx.gate(["open", "--stop-report", "--review", "2026-10-20-no-decision", "--covers", "H1"]);
    assert.notEqual(noDecision.status, 0);
    assert.match(noDecision.stderr, new RegExp(`no control for unconfirmed agent-made decisions ${ctx.decisionId} \\(name it d<n>\\)`, "u"));

    ctx.writePage("2026-10-20-no-switch", stopReportPage(ctx.decisionId, { withSwitch: false }));
    const noSwitch = ctx.gate(["open", "--stop-report", "--review", "2026-10-20-no-switch", "--covers", "H1"]);
    assert.notEqual(noSwitch.status, 0);
    assert.match(noSwitch.stderr, /no continue-after-submit check/u);
    assert.equal(ctx.loop().gates, undefined);
  } finally {
    cleanup(housekeeping, ctx);
  }
});

test("switch on (unanswered): the submit resumes into ingest and then the techlead, with the auto-continue note", () => {
  const ctx = setupStopLoop("stops-continue");
  try {
    acceptWithPage(ctx);
    ctx.stop();
    submit(ctx, { h1: true, [ctx.decisionId.toLowerCase()]: "confirm" });
    assert.match(ctx.stop().reason, /manager ingest turn 4/u);
    ctx.say("Resolved H1 and confirmed the decision.");
    const techlead = ctx.stop();
    assert.match(techlead.reason, /techlead turn 5/u);
    assert.match(techlead.reason, /This was the stop report page `2026-10-20-stop-report`, and the human left "continue after submit" on/u);
    const [event] = ctx.events("stop-report-continue");
    assert.equal(event.review, REVIEW);
    assert.equal(ctx.loop().status, "running");
  } finally {
    cleanup(ctx);
  }
});

test("switch off: the ingest records the answers and the loop stays paused", () => {
  const ctx = setupStopLoop("stops-paused");
  try {
    acceptWithPage(ctx);
    ctx.stop();
    submit(ctx, { "continue-after-submit": false, h1: true, [ctx.decisionId.toLowerCase()]: "reverse" });
    assert.match(ctx.stop().reason, /manager ingest turn 4/u);
    ctx.say("Recorded the answers; the loop stays paused.");
    assert.equal(ctx.stop(), null);
    const loop = ctx.loop();
    assert.equal(loop.status, "idle");
    assert.equal(loop.next_role, "idle");
    assert.equal(loop.gates[0].status, "ingested");
    const [event] = ctx.events("stop-report-paused");
    assert.equal(event.review, REVIEW);
    assert.equal(ctx.events("stop-report-continue").length, 0);
    assert.equal(ctx.stop(), null, "nothing runs until the loop is resumed");
  } finally {
    cleanup(ctx);
  }
});

test("a problem report on a gate's page rings, routes an ingest with its text, and is ingested once", async () => {
  const ctx = setupStopLoop("stops-problem");
  try {
    acceptWithPage(ctx);
    ctx.stop();
    // The waiter rings for the problem report.
    const waiter = spawn(process.execPath, [scriptPath("doorbell-waiter.mjs"), "--root", ctx.root], {
      env: { ...process.env, EPIC_LOOP_DOORBELL_POLL_MS: "50" },
      stdio: ["pipe", "ignore", "pipe"],
    });
    started.add(waiter.pid);
    let stderr = "";
    waiter.stderr.on("data", (chunk) => (stderr += chunk));
    const done = new Promise((resolve) => waiter.on("close", resolve));
    waiter.stdin.end(JSON.stringify({ cwd: ctx.root, hook_event_name: "Stop", session_id: SESSION }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.appendFileSync(path.join(ctx.reviewDir(), "problems.jsonl"), `${JSON.stringify({ at: "2026-10-20T11:00:00Z", text: "The H1 card shows no control." })}\n`);
    assert.equal(await done, 2);
    assert.match(stderr, /\(problem reports on 2026-10-20-stop-report\)/u);

    const ingest = ctx.stop();
    assert.match(ingest.reason, /manager ingest turn 4/u);
    assert.match(ingest.reason, /### Problem reports \(verbatim\)/u);
    assert.ok(ingest.reason.includes("The H1 card shows no control."));
    assert.match(ingest.reason, /have the page builder fix that page/u);
    const [start] = ctx.events("ingest-start");
    assert.deepEqual(start.problem_reviews, [REVIEW]);

    ctx.say("Had the page fixed; new link /stops/reviews/2026-10-20-stop-report/.");
    const techlead = ctx.stop();
    assert.match(techlead.reason, /problem reports on 2026-10-20-stop-report/u);
    assert.equal(ctx.loop().gates[0].problems_through, 1);
    const [ingested] = ctx.events("problems-ingested");
    assert.deepEqual({ review: ingested.review, through: ingested.through }, { review: REVIEW, through: 1 });

    // Nothing new: the next transition routes normally.
    assertSuccess(ctx.script("set-next-role.mjs", ["--role", "manager", "--reason", "housekeeping"]));
    assert.match(ctx.stop().reason, /manager housekeeping turn 6/u);
    assert.equal(ctx.events("ingest-start").length, 1);
  } finally {
    cleanup(ctx);
  }
});
