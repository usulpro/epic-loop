import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { STOP_REPORT_FIXTURE, assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const PLATFORMS = ["codex", "claude-code"];
const REVIEW = "2026-10-20-header";

// A bound driver loop with an open role turn (iteration 2), an open H1 in the human queue and a
// checked review (review.json with a schema).
function setupGateLoop(prefix, platform, role = "manager", extra = {}) {
  const root = makeTempRoot(prefix);
  const slug = "gates";
  const sessionId = "gate-session";
  const transcriptPath = path.join(root, "transcript.jsonl");
  const epicDir = path.join(root, ".epic-loop", "epics", slug);
  const epicRuntime = path.join(epicDir, ".runtime");
  const reviewDir = path.join(epicDir, "reviews", REVIEW);

  fs.writeFileSync(transcriptPath, `${JSON.stringify({ type: "assistant", message: { content: "Role report in this turn" } })}\n`, "utf8");
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", platform, "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Gate project", "--slug", slug, "--no-gitignore"]));
  writeOpenImplementationTurn(root, slug, role, { turn_key: "prompt-gate", ...extra });
  writeSessionBinding(root, slug, sessionId);
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "page.html"), '<main class="el-main"><h1>Header</h1></main>\n', "utf8");
  fs.writeFileSync(path.join(reviewDir, "review.json"), `${JSON.stringify({ id: REVIEW, title: "Header", schema: { controls: [{ name: "layout", kind: "choice" }] } })}\n`, "utf8");

  const script = (name, args = [], input = undefined) => runNodeScript(name, ["--root", root, "--slug", slug, ...args], { input });
  assertSuccess(script("human-queue.mjs", ["add", "--kind", "product-decision", "--ask", "Pick the header", "--why", "landing page", "--blocks", "task 3"]));
  const hook = (event, fields = {}) => {
    const result = runNodeScript("hook.mjs", ["--root", root], {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: event,
        last_assistant_message: "Role report in this turn",
        session_id: sessionId,
        transcript_path: transcriptPath,
        turn_id: "turn-gate",
        ...fields,
      }),
    });
    assertSuccess(result);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };

  return {
    gate: (args) => script("gate.mjs", args),
    events: (action) =>
      fs
        .readFileSync(path.join(epicRuntime, "progress-log.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.action === action),
    loop: () => readJsonFile(path.join(epicRuntime, "runtime-state.json")).implementation_loop,
    prompt: (text, key = "prompt-user") => hook("UserPromptSubmit", { prompt: text, prompt_id: key }),
    reviewDir,
    root,
    script,
    stop: () => hook("Stop", { prompt_id: "prompt-gate", stop_hook_active: true }),
    submit: (submittedAt) => fs.writeFileSync(path.join(reviewDir, "answers.json"), `${JSON.stringify({ controls: { layout: "compact" }, submittedAt })}\n`, "utf8"),
  };
}

const cleanup = (...contexts) => {
  for (const ctx of contexts) fs.rmSync(ctx.root, { force: true, recursive: true });
};

for (const platform of PLATFORMS) {
  test(`${platform}: a non-blocking gate leaves the loop running and hands over to the techlead`, () => {
    const ctx = setupGateLoop("gate-non-blocking-", platform);
    try {
      assertSuccess(ctx.gate(["open", "--review", REVIEW, "--covers", "h1"]));
      const [gate] = ctx.loop().gates;
      assert.deepEqual({ ...gate, opened_at: undefined }, { blocking: false, covers: ["H1"], opened_at: undefined, opened_iteration: 2, review: REVIEW, status: "open" });

      const next = ctx.stop();
      assert.equal(next.decision, "block");
      assert.match(next.reason, /techlead turn 3/u);
      assert.equal(ctx.loop().status, "running");

      const [opened] = ctx.events("gate-opened");
      assert.deepEqual(
        { ...opened, timestamp: undefined },
        { action: "gate-opened", blocking: false, covers: ["H1"], iteration: 2, review: REVIEW, role: "manager", slug: "gates", timestamp: undefined },
      );
    } finally {
      cleanup(ctx);
    }
  });

  test(`${platform}: a blocking gate ends the manager turn in awaiting-review without a continuation`, () => {
    const ctx = setupGateLoop("gate-blocking-", platform);
    try {
      assertSuccess(ctx.gate(["open", "--review", REVIEW, "--covers", "H1", "--blocking"]));
      assert.equal(ctx.stop(), null);
      const loop = ctx.loop();
      assert.equal(loop.status, "awaiting-review");
      assert.ok(loop.active_turn_stopped_at);
      const [waiting] = ctx.events("awaiting-review");
      assert.deepEqual(waiting.reviews, [REVIEW]);
      assert.equal(waiting.iteration, 2);
      // The manager's final message is still recorded as its report.
      assert.ok(loop.last_manager_report_path);

      // Another Stop while awaiting the review stays quiet.
      assert.equal(ctx.stop(), null);

      const note = ctx.prompt("what is happening?").hookSpecificOutput.additionalContext;
      assert.match(note, /loop awaiting review: 2026-10-20-header \(\/gates\/reviews\/2026-10-20-header\/\)/u);
      assert.match(note, /bind-session\.mjs --current --slug gates --mode implementation/u);

      const summary = ctx.script("role-summary.mjs");
      assertSuccess(summary);
      assert.match(summary.stdout, /Loop: awaiting-review/u);
      assert.match(summary.stdout, /Open gates[^\n]*\n- 2026-10-20-header \[open\] blocking, covers H1: \/gates\/reviews\/2026-10-20-header\//u);

      // Resuming starts the loop again from a manager turn; the gate stays listed and does not
      // block that next turn, which did not open it.
      assertSuccess(ctx.script("bind-session.mjs", ["--session-id", "gate-session", "--mode", "implementation"]));
      assert.equal(ctx.loop().status, "running");
      assert.equal(ctx.stop().decision, "block");
      assert.equal(ctx.loop().current_role, "manager");
      assert.equal(ctx.stop().decision, "block");
      assert.equal(ctx.loop().current_role, "techlead");
      assert.equal(ctx.loop().gates.length, 1);
    } finally {
      cleanup(ctx);
    }
  });

  test(`${platform}: answers-submitted is logged once per submittedAt of an open gate`, () => {
    const ctx = setupGateLoop("gate-submitted-", platform);
    try {
      assertSuccess(ctx.gate(["open", "--review", REVIEW, "--blocking"]));
      assert.equal(ctx.stop(), null);
      ctx.submit("2026-10-20T10:00:00.000Z");

      ctx.prompt("answered");
      let submitted = ctx.events("answers-submitted");
      assert.equal(submitted.length, 1);
      assert.equal(submitted[0].review, REVIEW);
      assert.equal(submitted[0].submitted_at, "2026-10-20T10:00:00.000Z");
      assert.equal(submitted[0].event, "UserPromptSubmit");
      assert.equal(ctx.loop().gates[0].status, "submitted");
      // A user message does not route; the loop still awaits the review until the next Stop.
      assert.equal(ctx.loop().status, "awaiting-review");
      ctx.stop();
      assert.equal(ctx.events("answers-submitted").length, 1);

      ctx.submit("2026-10-20T11:00:00.000Z");
      ctx.stop();
      submitted = ctx.events("answers-submitted");
      assert.deepEqual(
        submitted.map((event) => event.submitted_at),
        ["2026-10-20T10:00:00.000Z", "2026-10-20T11:00:00.000Z"],
      );
    } finally {
      cleanup(ctx);
    }
  });
}

test("an accepted stop wins over a blocking gate opened in the same stop review", () => {
  const ctx = setupGateLoop("gate-accepted-stop-", "claude-code", "techlead");
  try {
    assertSuccess(ctx.script("request-stop.mjs", ["--class", "A", "--reason", "phase done", "--blocks", "nothing"]));
    assert.equal(ctx.stop().decision, "block");
    assertSuccess(ctx.gate(["open", "--review", REVIEW, "--blocking"]));
    assertSuccess(ctx.script("review-stop.mjs", ["--outcome", "accepted", "--stdin"], STOP_REPORT_FIXTURE));
    assert.equal(ctx.stop(), null);
    const loop = ctx.loop();
    assert.equal(loop.status, "idle");
    assert.equal(loop.gates[0].status, "open");
    assert.equal(ctx.events("awaiting-review").length, 0);
  } finally {
    cleanup(ctx);
  }
});

test("only an open manager turn opens or settles a gate", () => {
  const techlead = setupGateLoop("gate-techlead-", "codex", "techlead");
  const engineer = setupGateLoop("gate-engineer-", "codex", "engineer");
  const closed = setupGateLoop("gate-no-turn-", "codex", "manager", { active_turn_stopped_at: "2026-07-01T00:01:00+00:00" });
  try {
    for (const ctx of [techlead, engineer, closed]) {
      for (const command of ["open", "ingested", "close"]) {
        const result = ctx.gate([command, "--review", REVIEW]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`gate ${command} runs only inside an open manager turn`, "u"));
      }
    }
    assert.equal(techlead.loop().gates, undefined);
  } finally {
    cleanup(techlead, engineer, closed);
  }
});

test("gate open validates the review and the covered H items, and reopening keeps one entry", () => {
  const ctx = setupGateLoop("gate-validate-", "codex");
  try {
    const missing = ctx.gate(["open", "--review", "2026-10-20-missing"]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /No review "2026-10-20-missing"/u);

    fs.writeFileSync(path.join(ctx.reviewDir, "review.json"), `${JSON.stringify({ id: REVIEW, title: "Header" })}\n`, "utf8");
    const unchecked = ctx.gate(["open", "--review", REVIEW]);
    assert.notEqual(unchecked.status, 0);
    assert.match(unchecked.stderr, /no answer schema yet\. Run: epic-loop review check gates\/2026-10-20-header/u);
    fs.writeFileSync(path.join(ctx.reviewDir, "review.json"), `${JSON.stringify({ id: REVIEW, title: "Header", schema: { controls: [] } })}\n`, "utf8");

    const unknown = ctx.gate(["open", "--review", REVIEW, "--covers", "H1,H9"]);
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /--covers names H9, which is not an open item in human-queue\.md/u);

    assertSuccess(ctx.script("human-queue.mjs", ["resolve", "--id", "H1", "--resolution", "picked compact"]));
    const resolved = ctx.gate(["open", "--review", REVIEW, "--covers", "H1"]);
    assert.notEqual(resolved.status, 0);
    assert.match(resolved.stderr, /H1, which is not an open item/u);

    const invalid = ctx.gate(["open", "--review", REVIEW, "--covers", "D7"]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /expected human-queue ids like H3/u);

    assertSuccess(ctx.gate(["open", "--review", REVIEW]));
    assertSuccess(ctx.gate(["open", "--review", REVIEW, "--blocking"]));
    const gates = ctx.loop().gates;
    assert.equal(gates.length, 1);
    assert.equal(gates[0].blocking, true);
    assert.equal(ctx.events("gate-opened").length, 2);
  } finally {
    cleanup(ctx);
  }
});

test("gate ingested and close log their events, and list shows open gates", () => {
  const ctx = setupGateLoop("gate-settle-", "claude-code");
  try {
    assertSuccess(ctx.gate(["open", "--review", REVIEW, "--covers", "H1"]));
    ctx.submit("2026-10-20T10:00:00.000Z");
    // A message inside the open manager turn (same host turn) only records the submit.
    ctx.prompt("answered", "prompt-gate");

    const listed = ctx.gate(["list", "--json"]);
    assertSuccess(listed);
    const list = JSON.parse(listed.stdout);
    assert.equal(list.status, "running");
    assert.deepEqual(
      list.gates.map(({ blocking, covers, path: reviewPath, review, status, submitted_at }) => ({ blocking, covers, path: reviewPath, review, status, submitted_at })),
      [{ blocking: false, covers: ["H1"], path: "/gates/reviews/2026-10-20-header/", review: REVIEW, status: "submitted", submitted_at: "2026-10-20T10:00:00.000Z" }],
    );

    assertSuccess(ctx.gate(["ingested", "--review", REVIEW]));
    assert.equal(ctx.loop().gates[0].status, "ingested");
    const [ingested] = ctx.events("gate-ingested");
    assert.equal(ingested.review, REVIEW);
    assert.equal(ingested.submitted_at, "2026-10-20T10:00:00.000Z");

    assertSuccess(ctx.gate(["close", "--review", REVIEW, "--reason", "H1 resolved"]));
    const [closedGate] = ctx.loop().gates;
    assert.equal(closedGate.status, "closed");
    assert.equal(closedGate.close_reason, "H1 resolved");
    const [closedEvent] = ctx.events("gate-closed");
    assert.deepEqual({ review: closedEvent.review, reason: closedEvent.reason, role: closedEvent.role }, { review: REVIEW, reason: "H1 resolved", role: "manager" });

    assert.match(ctx.gate(["list"]).stdout, /No open gates\./u);
    assert.match(ctx.gate(["list", "--all"]).stdout, /2026-10-20-header \[closed\]/u);
    const again = ctx.gate(["close", "--review", REVIEW]);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /no open gate for review/u);

    const summary = JSON.parse(ctx.script("role-summary.mjs", ["--json"]).stdout);
    assert.deepEqual(summary.open_gates, []);
  } finally {
    cleanup(ctx);
  }
});

test("stop-loop stops a loop that awaits a review", () => {
  const ctx = setupGateLoop("gate-stop-loop-", "codex");
  try {
    assertSuccess(ctx.gate(["open", "--review", REVIEW, "--blocking"]));
    assert.equal(ctx.stop(), null);
    const stopped = ctx.script("stop-loop.mjs");
    assertSuccess(stopped);
    assert.match(stopped.stdout, /Stopped the implementation loop/u);
    assert.equal(ctx.loop().status, "interrupted");
    assert.equal(ctx.loop().gates.length, 1);
  } finally {
    cleanup(ctx);
  }
});
