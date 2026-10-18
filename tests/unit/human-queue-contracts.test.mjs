import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, readJsonFile, runNodeScript, writeOpenImplementationTurn, writeSessionBinding } from "./test-utils.mjs";

const SLUG = "queue";

function setupEpic(prefix) {
  const root = makeTempRoot(prefix);
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Human queue project", "--slug", SLUG, "--no-gitignore"]));
  const epicDir = path.join(root, ".epic-loop", "epics", SLUG);
  const run = (script, args = []) => runNodeScript(script, [...args, "--root", root, "--slug", SLUG]);
  return {
    epicDir,
    queuePath: path.join(epicDir, "human-queue.md"),
    decisionsPath: path.join(epicDir, "decision-log.md"),
    root,
    run,
    addItem: (ask, kind = "human-action") => run("human-queue.mjs", ["add", "--kind", kind, "--ask", ask, "--why", `why ${ask}`, "--blocks", `before ${ask}`]),
    summary: () => JSON.parse(run("role-summary.mjs", ["--json"]).stdout),
  };
}

const HAND_WRITTEN_LOG = `# Decision Log

## Active Decisions

- **D1 — First decision** (2026-10-01).
  - Nested detail.
    - Deeper detail with a D7 reference.
${Array.from({ length: 28 }, (_, index) => `- **D${index + 2} — Decision ${index + 2}** (2026-10-02).`).join("\n")}
- **D30 — Last hand-written decision** (2026-10-03).
  - Why: it is hand-written.

## Open Questions

- **Q1 — Something open.** Mentions D12.

## Historical Decisions

- None recorded yet.
`;

test("human-queue ids stay stable across add and resolve", () => {
  const ctx = setupEpic("queue-ids-");

  try {
    assert.deepEqual(
      ["one", "two", "three"].map((ask) => ctx.addItem(ask).stdout.trim()),
      ["H1", "H2", "H3"],
    );
    assertSuccess(ctx.run("human-queue.mjs", ["resolve", "--id", "H2", "--resolution", "done by hand"]));
    assert.equal(ctx.addItem("four").stdout.trim(), "H4");

    const missing = ctx.run("human-queue.mjs", ["resolve", "--id", "H9", "--resolution", "x"]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /not found: H9/u);
    const twice = ctx.run("human-queue.mjs", ["resolve", "--id", "H2", "--resolution", "again"]);
    assert.notEqual(twice.status, 0);
    assert.match(twice.stderr, /already resolved/u);
    const badKind = ctx.run("human-queue.mjs", ["add", "--kind", "urgent", "--ask", "a", "--why", "b", "--blocks", "c"]);
    assert.notEqual(badKind.status, 0);
    assert.match(badKind.stderr, /Invalid --kind "urgent"/u);

    const open = JSON.parse(ctx.run("human-queue.mjs", ["list", "--json"]).stdout);
    assert.deepEqual(
      open.map((item) => item.id),
      ["H1", "H3", "H4"],
    );
    const all = JSON.parse(ctx.run("human-queue.mjs", ["list", "--all", "--json"]).stdout);
    assert.deepEqual(
      all.map((item) => [item.id, item.status]),
      [
        ["H1", "open"],
        ["H2", "resolved"],
        ["H3", "open"],
        ["H4", "open"],
      ],
    );
    assert.equal(all[1].resolution, "done by hand");
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("human-queue renders deterministically and shows empty sections", () => {
  const first = setupEpic("queue-render-a-");
  const second = setupEpic("queue-render-b-");

  try {
    assert.match(fs.readFileSync(first.queuePath, "utf8"), /## Open\n\n- None\.\n\n## Resolved\n\n- None\.\n$/u);

    for (const ctx of [first, second]) {
      ctx.addItem("publish the package");
      assertSuccess(
        ctx.run("human-queue.mjs", ["add", "--kind", "product-decision", "--ask", "pick pricing", "--why", "no default", "--blocks", "phase 3", "--default", "free tier"]),
      );
      assertSuccess(ctx.run("human-queue.mjs", ["resolve", "--id", "H1", "--resolution", "published"]));
    }

    const text = fs.readFileSync(first.queuePath, "utf8");
    assert.equal(text, fs.readFileSync(second.queuePath, "utf8"));
    assert.match(
      text,
      /## Open\n\n- \*\*H2\*\*\n {2}- Kind: product-decision\n {2}- Ask: pick pricing\n {2}- Why: no default\n {2}- Default: free tier\n {2}- Blocks: phase 3\n {2}- Raised: \d{4}-\d{2}-\d{2}\n/u,
    );
    assert.match(text, /## Resolved\n\n- \*\*H1\*\*\n[\s\S]*- Default: none\n[\s\S]*- Resolution: published\n$/u);

    // A no-op rewrite (resolve after add) leaves an untouched file byte-identical.
    first.addItem("third");
    assertSuccess(first.run("human-queue.mjs", ["resolve", "--id", "H3", "--resolution", "r"]));
    second.addItem("third");
    assertSuccess(second.run("human-queue.mjs", ["resolve", "--id", "H3", "--resolution", "r"]));
    assert.equal(fs.readFileSync(first.queuePath, "utf8"), fs.readFileSync(second.queuePath, "utf8"));
  } finally {
    fs.rmSync(first.root, { force: true, recursive: true });
    fs.rmSync(second.root, { force: true, recursive: true });
  }
});

test("agent-decision add keeps the hand-written log byte-identical and continues the D ids", () => {
  const ctx = setupEpic("agent-decision-add-");

  try {
    fs.writeFileSync(ctx.decisionsPath, HAND_WRITTEN_LOG, "utf8");
    assert.equal(ctx.run("agent-decision.mjs", ["add", "--title", "Use ISO dates", "--default", "YYYY-MM-DD", "--why", "matches the logs"]).stdout.trim(), "D31");
    assert.equal(ctx.run("agent-decision.mjs", ["add", "--title", "Port 3001", "--default", "3001", "--why", "3000 is busy", "--stop-class", "d"]).stdout.trim(), "D32");

    const text = fs.readFileSync(ctx.decisionsPath, "utf8");
    const entries = text.match(/- \*\*D31 — [\s\S]*?- Why: 3000 is busy\n/u)[0];
    assert.equal(text.replace(entries, ""), HAND_WRITTEN_LOG);
    assert.match(
      entries,
      /^- \*\*D31 — Use ISO dates\*\* \(\d{4}-\d{2}-\d{2}; agent-made, stop class C; unconfirmed\)\.\n {2}- Default taken: YYYY-MM-DD\n {2}- Why: matches the logs\n- \*\*D32 — Port 3001\*\* \(\d{4}-\d{2}-\d{2}; agent-made, stop class D; unconfirmed\)\.\n/u,
    );
    assert.ok(text.indexOf("D32 — Port 3001") < text.indexOf("## Open Questions"));

    const badClass = ctx.run("agent-decision.mjs", ["add", "--title", "t", "--default", "d", "--why", "w", "--stop-class", "Z"]);
    assert.notEqual(badClass.status, 0);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("agent-decision replaces the empty placeholder and confirms or reverses one entry", () => {
  const ctx = setupEpic("agent-decision-confirm-");

  try {
    assertSuccess(ctx.run("agent-decision.mjs", ["add", "--title", "First", "--default", "a", "--why", "b"]));
    assertSuccess(ctx.run("agent-decision.mjs", ["add", "--title", "Second", "--default", "c", "--why", "d"]));
    let text = fs.readFileSync(ctx.decisionsPath, "utf8");
    assert.match(text, /## Active Decisions\n\n- \*\*D1 — First\*\*/u);
    assert.doesNotMatch(text.split("## Historical Decisions")[0], /None recorded yet/u);
    assert.match(text, /## Historical Decisions\n\n- None recorded yet\.\n$/u);

    assertSuccess(ctx.run("agent-decision.mjs", ["confirm", "--id", "D1", "--note", "fine"]));
    assertSuccess(ctx.run("agent-decision.mjs", ["confirm", "--id", "d2", "--reversed", "use the other default"]));
    text = fs.readFileSync(ctx.decisionsPath, "utf8");
    assert.match(
      text,
      /- \*\*D1 — First\*\* \(\d{4}-\d{2}-\d{2}; agent-made, stop class C; confirmed \d{4}-\d{2}-\d{2}\)\.\n {2}- Default taken: a\n {2}- Why: b\n {2}- Note: fine\n/u,
    );
    assert.match(
      text,
      /- \*\*D2 — Second\*\* \(\d{4}-\d{2}-\d{2}; agent-made, stop class C; reversed \d{4}-\d{2}-\d{2}\)\.\n {2}- Default taken: c\n {2}- Why: d\n {2}- Reversed: use the other default\n/u,
    );

    const again = ctx.run("agent-decision.mjs", ["confirm", "--id", "D1"]);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /already confirmed or reversed/u);
    assert.notEqual(ctx.run("agent-decision.mjs", ["confirm", "--id", "D9"]).status, 0);

    const all = JSON.parse(ctx.run("agent-decision.mjs", ["list", "--json"]).stdout);
    assert.deepEqual(
      all.map((decision) => [decision.id, decision.state]),
      [
        ["D1", "confirmed"],
        ["D2", "reversed"],
      ],
    );
    assert.deepEqual(JSON.parse(ctx.run("agent-decision.mjs", ["list", "--unconfirmed", "--json"]).stdout), []);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("role-summary lists open human-queue items and unconfirmed agent decisions", () => {
  const ctx = setupEpic("queue-summary-");

  try {
    let summary = ctx.summary();
    assert.deepEqual(summary.open_human_queue, []);
    assert.deepEqual(summary.unconfirmed_agent_decisions, []);
    assert.doesNotMatch(ctx.run("role-summary.mjs").stdout, /human-queue items|agent-made decisions/u);

    ctx.addItem("sign in to the registry");
    assertSuccess(ctx.run("agent-decision.mjs", ["add", "--title", "Use ISO dates", "--default", "YYYY-MM-DD", "--why", "logs"]));
    summary = ctx.summary();
    assert.deepEqual(summary.open_human_queue, [{ ask: "sign in to the registry", blocks: "before sign in to the registry", id: "H1", kind: "human-action" }]);
    assert.deepEqual(summary.unconfirmed_agent_decisions, [{ id: "D1", title: "Use ISO dates" }]);
    const text = ctx.run("role-summary.mjs").stdout;
    assert.match(text, /Open human-queue items .*:\n- H1 human-action: sign in to the registry \(blocks: before sign in to the registry\)/u);
    assert.match(text, /Unconfirmed agent-made decisions .*:\n- D1 Use ISO dates/u);

    assertSuccess(ctx.run("human-queue.mjs", ["resolve", "--id", "H1", "--resolution", "signed in"]));
    assertSuccess(ctx.run("agent-decision.mjs", ["confirm", "--id", "D1"]));
    summary = ctx.summary();
    assert.deepEqual(summary.open_human_queue, []);
    assert.deepEqual(summary.unconfirmed_agent_decisions, []);
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});

test("epics without human-queue.md keep working and reads create no file", () => {
  const ctx = setupEpic("queue-legacy-");
  const sessionId = "legacy-session";

  try {
    assert.ok(fs.existsSync(ctx.queuePath), "init-epic creates human-queue.md");
    fs.rmSync(ctx.queuePath);

    assert.deepEqual(ctx.summary().open_human_queue, []);
    assertSuccess(ctx.run("role-summary.mjs"));
    assert.equal(ctx.run("human-queue.mjs", ["list"]).stdout.trim(), "No open human-queue items.");
    assert.deepEqual(JSON.parse(ctx.run("human-queue.mjs", ["list", "--all", "--json"]).stdout), []);

    assertSuccess(runNodeScript("doctor.mjs", ["--root", ctx.root, "--platform", "codex", "--json"]));
    writeOpenImplementationTurn(ctx.root, SLUG, "engineer");
    writeSessionBinding(ctx.root, SLUG, sessionId);
    const stop = runNodeScript("hook.mjs", ["--root", ctx.root], {
      input: JSON.stringify({ cwd: ctx.root, hook_event_name: "Stop", last_assistant_message: "report", session_id: sessionId, stop_hook_active: true, turn_id: "t" }),
    });
    assertSuccess(stop);
    assert.equal(JSON.parse(stop.stdout).decision, "block");
    assert.equal(readJsonFile(path.join(ctx.epicDir, ".runtime", "runtime-state.json")).implementation_loop.current_role, "techlead");

    assert.equal(fs.existsSync(ctx.queuePath), false);
    assert.equal(ctx.addItem("first after migration").stdout.trim(), "H1");
    assert.ok(fs.existsSync(ctx.queuePath));
  } finally {
    fs.rmSync(ctx.root, { force: true, recursive: true });
  }
});
