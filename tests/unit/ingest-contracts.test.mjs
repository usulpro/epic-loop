import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { appendInbox } from "../../packages/cli/src/serve/inbox.mjs";
import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const PLATFORMS = ["codex", "claude-code"];
const REVIEW = "2026-10-20-header";
const MANAGER_REPORT = "Ingested H1: compact header recorded as D9.";

// A bound driver loop with an open manager turn (iteration 2), an open H1 and a checked review.
function setupIngestLoop(prefix, platform, role = "manager", extra = {}) {
  const root = makeTempRoot(prefix);
  const slug = "ingest";
  const sessionId = "ingest-session";
  const transcriptPath = path.join(root, "transcript.jsonl");
  const epicDir = path.join(root, ".epic-loop", "epics", slug);
  const epicRuntime = path.join(epicDir, ".runtime");
  const reviewDir = path.join(epicDir, "reviews", REVIEW);
  const briefPath = `.epic-loop/epics/${slug}/.runtime/current-engineer-prompt.md`;

  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Ingest project", "--slug", slug, "--no-gitignore"]));
  fs.writeFileSync(path.join(root, briefPath), "Add mean(values) to src/stats.mjs.\n", "utf8");
  writeOpenImplementationTurn(root, slug, role, { turn_key: "prompt-ingest", ...extra });
  writeSessionBinding(root, slug, sessionId);
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "page.html"), '<main class="el-main"><h1>Header</h1></main>\n', "utf8");
  const schema = { controls: [{ name: "layout", kind: "choice", optional: false, options: [{ value: "compact" }, { value: "stacked" }], recommended: "compact", card: "q1" }] };
  fs.writeFileSync(path.join(reviewDir, "review.json"), `${JSON.stringify({ id: REVIEW, title: "Header", schema })}\n`, "utf8");

  const script = (name, args = [], input = undefined) => runNodeScript(name, ["--root", root, "--slug", slug, ...args], { input });
  assertSuccess(script("human-queue.mjs", ["add", "--kind", "product-decision", "--ask", "Pick the header", "--why", "landing page", "--blocks", "task 3"]));

  // The role's final message; each Stop reads it as the report of the turn that ends.
  const say = (text) => fs.writeFileSync(transcriptPath, `${JSON.stringify({ type: "assistant", message: { content: text } })}\n`, "utf8");
  say("Role report in this turn");
  const hook = (event, fields = {}) => {
    const message = JSON.parse(fs.readFileSync(transcriptPath, "utf8")).message.content;
    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: event,
        last_assistant_message: message,
        session_id: sessionId,
        transcript_path: transcriptPath,
        turn_id: "turn-ingest",
        ...fields,
      }),
    });
    assertSuccess(result);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };

  return {
    epicDir,
    events: (action) =>
      fs
        .readFileSync(path.join(epicRuntime, "progress-log.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.action === action),
    gate: (args) => script("gate.mjs", args),
    handToEngineer: () => assertSuccess(script("set-next-role.mjs", ["--role", "engineer", "--prompt-file", briefPath])),
    loop: () => readJsonFile(path.join(epicRuntime, "runtime-state.json")).implementation_loop,
    root,
    say,
    script,
    stop: () => hook("Stop", { prompt_id: "prompt-ingest", stop_hook_active: true }),
    submit: (submittedAt) => fs.writeFileSync(path.join(reviewDir, "answers.json"), `${JSON.stringify({ controls: { layout: "stacked" }, submittedAt })}\n`, "utf8"),
  };
}

const cleanup = (...contexts) => {
  for (const ctx of contexts) fs.rmSync(ctx.root, { force: true, recursive: true });
};

for (const platform of PLATFORMS) {
  test(`${platform}: submitted answers route to a manager ingest turn before the engineer, and the techlead gets the note`, () => {
    const ctx = setupIngestLoop("ingest-running-", platform);
    try {
      assertSuccess(ctx.gate(["open", "--review", REVIEW, "--covers", "H1"]));
      assert.match(ctx.stop().reason, /techlead turn 3/u);

      ctx.submit("2026-10-20T10:00:00.000Z");
      ctx.handToEngineer();
      const ingest = ctx.stop();
      assert.match(ingest.reason, /manager ingest turn 4/u);
      assert.doesNotMatch(ingest.reason, /Focused implementation task/u);
      assert.match(ingest.reason, /`2026-10-20-header` \(\/ingest\/reviews\/2026-10-20-header\/\), submitted 2026-10-20T10:00:00\.000Z/u);
      assert.match(ingest.reason, /Covers: H1 \(product-decision, open\)/u);
      assert.match(ingest.reason, /`layout` \(choice: compact \| stacked; recommended compact, card q1\)/u);
      assert.match(ingest.reason, /human-queue\.mjs resolve --slug "ingest" --id H<n>/u);
      let loop = ctx.loop();
      assert.equal(loop.current_role, "manager");
      assert.deepEqual(loop.ingest, {
        gates: [{ review: REVIEW, submitted_at: "2026-10-20T10:00:00.000Z" }],
        inbox_ids: [],
        inbox_through: null,
        iteration: 4,
        problems: [],
        skipped_role: "engineer",
      });
      const [start] = ctx.events("ingest-start");
      assert.deepEqual(
        { inbox_ids: start.inbox_ids, iteration: start.iteration, reviews: start.reviews, skipped_role: start.skipped_role },
        { inbox_ids: [], iteration: 4, reviews: [REVIEW], skipped_role: "engineer" },
      );

      ctx.say(MANAGER_REPORT);
      const techlead = ctx.stop();
      assert.match(techlead.reason, /techlead turn 5/u);
      assert.match(techlead.reason, /## Human Input Ingested/u);
      assert.match(techlead.reason, /review pages 2026-10-20-header/u);
      assert.match(techlead.reason, /Ingested H1: compact header recorded as D9\./u);
      assert.match(techlead.reason, /The engineer turn you chose before this input arrived was not run/u);
      loop = ctx.loop();
      assert.equal(loop.ingest, null);
      assert.equal(loop.ingest_note, null);
      assert.equal(loop.gates[0].status, "ingested");
      assert.equal(loop.gates[0].ingested_submitted_at, "2026-10-20T10:00:00.000Z");
      const [ingested] = ctx.events("gate-ingested");
      assert.deepEqual(
        { by: ingested.by, review: ingested.review, submitted_at: ingested.submitted_at },
        { by: "ingest-turn", review: REVIEW, submitted_at: "2026-10-20T10:00:00.000Z" },
      );

      // Nothing new: the engineer runs, and nothing more is logged.
      ctx.handToEngineer();
      assert.match(ctx.stop().reason, /Focused implementation task 6/u);
      assert.equal(ctx.events("ingest-start").length, 1);
      assert.equal(ctx.events("gate-ingested").length, 1);
      const techleadAgain = ctx.stop();
      assert.match(techleadAgain.reason, /techlead turn 7/u);
      assert.doesNotMatch(techleadAgain.reason, /Human Input Ingested/u);

      // A resubmit is new input.
      ctx.submit("2026-10-20T12:00:00.000Z");
      ctx.handToEngineer();
      assert.match(ctx.stop().reason, /manager ingest turn 8/u);
    } finally {
      cleanup(ctx);
    }
  });

  test(`${platform}: answers to a blocking gate resume the loop with an ingest turn`, () => {
    const ctx = setupIngestLoop("ingest-blocking-", platform);
    try {
      assertSuccess(ctx.gate(["open", "--review", REVIEW, "--covers", "H1", "--blocking"]));
      assert.equal(ctx.stop(), null);
      assert.equal(ctx.loop().status, "awaiting-review");
      // Nothing answered yet: still quiet.
      assert.equal(ctx.stop(), null);

      ctx.submit("2026-10-20T10:00:00.000Z");
      const ingest = ctx.stop();
      assert.match(ingest.reason, /manager ingest turn 3/u);
      assert.equal(ctx.loop().status, "running");
      assert.equal(ctx.events("review-answered").length, 1);

      ctx.say(MANAGER_REPORT);
      const techlead = ctx.stop();
      assert.match(techlead.reason, /techlead turn 4/u);
      assert.match(techlead.reason, /## Human Input Ingested/u);
      assert.doesNotMatch(techlead.reason, /was not run/u);
    } finally {
      cleanup(ctx);
    }
  });
}

test("an inbox entry from the server is ingested verbatim, and entries that arrive during ingest wait for the next pickup", async () => {
  const ctx = setupIngestLoop("ingest-inbox-", "claude-code", "techlead");
  try {
    const first = await appendInbox(ctx.epicDir, "Please keep the footer links.\nAlso: no carousel.");
    assert.equal(first.id, "I1");
    ctx.handToEngineer();
    const ingest = ctx.stop();
    assert.match(ingest.reason, /manager ingest turn 3/u);
    assert.match(ingest.reason, /### Inbox requests \(verbatim\)/u);
    assert.ok(ingest.reason.includes("Please keep the footer links.\nAlso: no carousel."));

    const second = await appendInbox(ctx.epicDir, "One more: dark mode later.");
    assert.equal(second.id, "I2");
    ctx.say(MANAGER_REPORT);
    const techlead = ctx.stop();
    assert.match(techlead.reason, /techlead turn 4/u);
    assert.match(techlead.reason, /inbox I1/u);
    assert.ok(techlead.reason.includes("Please keep the footer links.\nAlso: no carousel."));
    assert.doesNotMatch(techlead.reason, /dark mode later/u);
    const [inboxEvent] = ctx.events("inbox-ingested");
    assert.deepEqual({ ids: inboxEvent.ids, through: inboxEvent.through }, { ids: ["I1"], through: 1 });
    assert.equal(ctx.loop().inbox_through, 1);

    const summary = ctx.script("role-summary.mjs");
    assert.match(summary.stdout, /Pending human input[^\n]*0 answered review\(s\), 1 inbox entry \(I2\)/u);

    ctx.handToEngineer();
    const next = ctx.stop();
    assert.match(next.reason, /manager ingest turn 5/u);
    assert.ok(next.reason.includes("One more: dark mode later."));
    assert.doesNotMatch(next.reason, /no carousel/u);
  } finally {
    cleanup(ctx);
  }
});

test("a pending stop review runs before ingest, and a challenge leads to the ingest", () => {
  const ctx = setupIngestLoop("ingest-stop-review-", "codex", "techlead");
  try {
    fs.writeFileSync(path.join(ctx.epicDir, "inbox.jsonl"), `${JSON.stringify({ id: "I1", text: "Ship it.", createdAt: "2026-10-20T09:00:00.000Z" })}\n`, "utf8");
    assertSuccess(ctx.script("request-stop.mjs", ["--class", "E", "--reason", "bookkeeping", "--blocks", "task 2"]));
    const review = ctx.stop();
    assert.match(review.reason, /manager stop review turn 3/u);
    assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "challenged", "--instruction", "Fix the bookkeeping and continue."]));
    const ingest = ctx.stop();
    assert.match(ingest.reason, /manager ingest turn 4/u);
    ctx.say(MANAGER_REPORT);
    const techlead = ctx.stop();
    assert.match(techlead.reason, /## Human Input Ingested/u);
    assert.match(techlead.reason, /## Stop Request Challenged/u);
  } finally {
    cleanup(ctx);
  }
});

test("gate ingested by hand inside the ingest turn is not logged again by the hook", () => {
  const ctx = setupIngestLoop("ingest-manual-", "codex");
  try {
    assertSuccess(ctx.gate(["open", "--review", REVIEW]));
    ctx.stop();
    ctx.submit("2026-10-20T10:00:00.000Z");
    ctx.handToEngineer();
    assert.match(ctx.stop().reason, /manager ingest turn 4/u);
    assertSuccess(ctx.gate(["ingested", "--review", REVIEW]));
    assert.match(ctx.gate(["ingested", "--review", REVIEW]).stdout, /already ingested/u);
    ctx.stop();
    assert.equal(ctx.events("gate-ingested").length, 1);
    assert.equal(ctx.loop().gates[0].status, "ingested");
  } finally {
    cleanup(ctx);
  }
});

test("a security-hold is not resolved by a plain resolve", () => {
  const ctx = setupIngestLoop("ingest-security-", "codex");
  try {
    assertSuccess(ctx.script("human-queue.mjs", ["add", "--kind", "security-hold", "--ask", "Allow the force push", "--why", "a guard stopped it", "--blocks", "task 4"]));
    const plain = ctx.script("human-queue.mjs", ["resolve", "--id", "H2", "--resolution", "submitted"]);
    assert.notEqual(plain.status, 0);
    assert.match(plain.stderr, /H2 is a security-hold: .*--confirmation/u);
    assertSuccess(ctx.script("human-queue.mjs", ["resolve", "--id", "H2", "--resolution", "allowed", "--confirmation", "Yes, force-push main"]));
    const queue = fs.readFileSync(path.join(ctx.epicDir, "human-queue.md"), "utf8");
    assert.match(queue, /allowed \(confirmed: "Yes, force-push main"\)/u);
  } finally {
    cleanup(ctx);
  }
});
