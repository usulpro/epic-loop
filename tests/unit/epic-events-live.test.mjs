import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, test } from "node:test";

import { assertSuccess, makeTempRoot, repoRoot, runNodeScript } from "./test-utils.mjs";

// Regression from the Phase 5 verification run: the event stream connected before the bind, and
// the skill writes runtime-state.json atomically (tmp + rename). Node's recursive fs.watch on Linux
// went silent after the first replacement, so the transcript path never re-armed and the activity
// feed only moved on other file changes.
const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");
let server = null;

after(() => {
  if (!server) return;
  spawnSync(process.execPath, [cliEntry, "serve", "--root", server.root, "--stop", "--json"], { encoding: "utf8", env: server.env });
  try {
    process.kill(server.pid, "SIGKILL");
  } catch {}
});

test("activity events start after a bind in a fresh epic, and atomic runtime writes keep being reported", { timeout: 30000 }, async () => {
  const root = fs.realpathSync(makeTempRoot("events-live"));
  const transcript = path.join(root, "transcript.jsonl");
  fs.writeFileSync(transcript, `${JSON.stringify({ timestamp: "2026-10-20T00:00:00Z", type: "user" })}\n`);
  assertSuccess(runNodeScript("doctor.mjs", ["--root", root, "--platform", "claude-code", "--json"]));
  assertSuccess(runNodeScript("init-epic.mjs", ["--root", root, "--description", "Demo", "--slug", "demo", "--no-gitignore"]));
  const env = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1", HOME: makeTempRoot("events-live-home") };
  const started = spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--json", "--detach"], { encoding: "utf8", env });
  assert.equal(started.status, 0, started.stderr);
  const info = JSON.parse(started.stdout);
  server = { env, pid: info.pid, root };

  const events = [];
  const req = http.get({ headers: { host: `127.0.0.1:${info.port}` }, host: "127.0.0.1", path: "/api/demo/events", port: info.port }, (res) => {
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      for (const match of chunk.matchAll(/event: (\w+)\ndata: (.*)\n/gu)) events.push({ at: Date.now(), data: match[2], event: match[1] });
    });
  });
  req.on("error", () => {});
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await wait(500);
  const hook = (event) =>
    assertSuccess(
      runNodeScript("hook.mjs", ["--root", root], {
        env: { CLAUDE_CODE_STOP_HOOK_BLOCK_CAP: "0" },
        input: JSON.stringify({ cwd: root, hook_event_name: event, session_id: "driver", stop_hook_active: false, transcript_path: transcript }),
      }),
    );
  hook("SessionStart");
  assertSuccess(runNodeScript("bind-session.mjs", ["--root", root, "--current", "--slug", "demo", "--mode", "implementation"]));
  hook("UserPromptSubmit");
  await wait(1000);
  const appended = Date.now();
  fs.appendFileSync(transcript, `${JSON.stringify({ timestamp: new Date().toISOString(), type: "user" })}\n`);
  await wait(1500);
  const activity = events.find((item) => item.event === "activity" && item.at >= appended);
  assert.ok(activity, `an activity event after the append: ${JSON.stringify(events)}`);
  assert.ok(activity.at - appended < 1500, `within 1.5 s (${activity.at - appended} ms)`);

  const before = events.length;
  hook("Stop");
  await wait(1500);
  assert.ok(
    events.slice(before).some((item) => item.event === "change"),
    `the Stop hook's atomic runtime write is still reported: ${JSON.stringify(events.slice(before))}`,
  );
  req.destroy();
});
