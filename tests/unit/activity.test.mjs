import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { MAX_ITEMS, readActivity, readEpicActivity } from "../../packages/cli/src/epic/activity.mjs";
import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const fixtures = path.join(repoRoot, "tests", "fixtures", "activity");

test("the Claude Code reader turns the transcript tail into tool, result, message and turn items, newest first", () => {
  const items = readActivity(path.join(fixtures, "claude-session.jsonl"), "claude-code");
  assert.deepEqual(
    items.map((item) => item.kind),
    ["message", "turn", "message", "result", "tool", "result", "tool", "turn"],
  );
  const [typed, notification, message, error, bash, result, read, prompt] = items;
  assert.deepEqual(typed, { at: "2026-10-20T10:00:09.000Z", kind: "message", role: "user", summary: "please also check the footer" });
  assert.equal(notification.summary, 'background task: Agent "Build page" finished');
  assert.ok(message.summary.length <= 200 && message.summary.endsWith("…"), message.summary);
  assert.equal(error.summary, "error: Task not found");
  assert.equal(bash.name, "Bash");
  assert.match(bash.summary, /^Bash: node \.claude\/skills\/epic-loop\/scripts\/start-task\.mjs --slug demo/u);
  assert.ok(bash.summary.length <= 150 && bash.summary.endsWith("…"), "a long command is cut");
  assert.equal(result.summary, "1\t# Tracker", "tool output stays one line");
  assert.deepEqual(read, { at: "2026-10-20T10:00:03.000Z", kind: "tool", name: "Read", role: "assistant", summary: "Read: /project/.epic-loop/epics/demo/tracker.md" });
  assert.equal(prompt.summary, "role prompt: [$epic-loop] Implementation loop: techlead turn 4 for `demo`.");
  assert.doesNotMatch(JSON.stringify(items), /SECRET-THINKING|ignored system line/u);
});

test("the Codex reader keeps function calls, outputs and messages, and drops reasoning and injected context", () => {
  const items = readActivity(path.join(fixtures, "codex-rollout.jsonl"), "codex");
  assert.deepEqual(
    items.map((item) => [item.kind, item.summary]),
    [
      ["turn", "turn complete"],
      ["message", "Tests pass; the task is done."],
      ["result", "Script completed"],
      ["tool", "exec: cat tracker.md"],
      ["result", "tests passed: 12"],
      ["tool", "shell: bash -lc pnpm test"],
      ["message", "Run the next task."],
      ["turn", "role prompt: [$epic-loop] Implementation loop: techlead turn 2 for `demo`."],
      ["turn", "turn started"],
    ],
  );
  assert.doesNotMatch(JSON.stringify(items), /SECRET-REASONING|AGENTS\.md|developer instructions/u);
});

const bashLine = (index) =>
  JSON.stringify({
    type: "assistant",
    timestamp: `2026-10-20T10:00:00.${String(index % 1000).padStart(3, "0")}Z`,
    message: { content: [{ type: "tool_use", name: "Bash", input: { command: `echo ${index} ${"x".repeat(200)}` } }] },
  });

test("the reader reads only the tail of a large transcript and keeps the last items", () => {
  const dir = makeTempRoot("activity-tail");
  const file = path.join(dir, "large.jsonl");
  fs.writeFileSync(file, `${Array.from({ length: 4000 }, (_, index) => bashLine(index)).join("\n")}\n`);
  assert.ok(fs.statSync(file).size > 256 * 1024, "the fixture is larger than the window");
  const items = readActivity(file, "claude-code", { bytes: 64 * 1024 });
  assert.equal(items.length, MAX_ITEMS);
  assert.match(items[0].summary, /^Bash: echo 3999 /u);
  assert.match(items.at(-1).summary, new RegExp(`^Bash: echo ${4000 - MAX_ITEMS} `, "u"));
});

test("the epic activity drops the project root from summaries", () => {
  const root = makeTempRoot("activity-root");
  const epicDir = path.join(root, ".epic-loop", "epics", "demo");
  fs.mkdirSync(path.join(epicDir, ".runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, ".epic-loop", ".runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", ".runtime", "platform.json"), JSON.stringify({ platform: "claude-code" }));
  const transcript = path.join(root, "t.jsonl");
  fs.writeFileSync(
    transcript,
    `${JSON.stringify({ type: "assistant", timestamp: "2026-10-20T10:00:00.000Z", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: `${root}/src/index.mjs` } }] } })}\n`,
  );
  fs.writeFileSync(path.join(epicDir, ".runtime", "runtime-state.json"), JSON.stringify({ implementation_loop: { current_role: "engineer", driver_transcript_path: transcript } }));
  const activity = readEpicActivity(root, epicDir);
  assert.equal(activity.items[0].summary, "Edit: src/index.mjs");
  assert.equal(activity.role, "engineer");
});

test("a missing transcript reads as no activity", () => {
  assert.equal(readActivity(path.join(fixtures, "missing.jsonl"), "claude-code"), null);
  assert.equal(readActivity(null, "codex"), null);
});
