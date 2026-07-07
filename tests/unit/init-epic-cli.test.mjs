import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, repoRoot, runNodeScript } from "./test-utils.mjs";

test("init-epic CLI initializes an isolated temporary project", () => {
  const tempRoot = makeTempRoot("init-");

  try {
    const result = runNodeScript("init-epic.mjs", ["--root", tempRoot, "--description", "Unit harness smoke project", "--no-gitignore"]);

    assertSuccess(result);
    assert.match(result.stdout, /Epic initialized: unit-harness/u);

    const epicRoot = path.join(tempRoot, ".epic-loop", "epics", "unit-harness");
    assert.equal(fs.existsSync(path.join(epicRoot, "state-of-epic.md")), true);
    assert.equal(fs.existsSync(path.join(epicRoot, "tracker.md")), true);
    assert.equal(fs.existsSync(path.join(epicRoot, "docs", "problem-framing.md")), true);
    assert.doesNotMatch(fs.readFileSync(path.join(epicRoot, "state-of-epic.md"), "utf8"), /^Current mode:/mu);

    const runtimeState = JSON.parse(fs.readFileSync(path.join(epicRoot, ".runtime", "runtime-state.json"), "utf8"));
    assert.equal(runtimeState.slug, "unit-harness");
    assert.equal(runtimeState.mode, "shaping");
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test("set-epic-mode CLI updates only the runtime mode source", () => {
  const tempRoot = makeTempRoot("mode-");

  try {
    assertSuccess(runNodeScript("init-epic.mjs", ["--root", tempRoot, "--description", "Mode source smoke", "--no-gitignore"]));

    const epicRoot = path.join(tempRoot, ".epic-loop", "epics", "mode-source");
    const runtimePath = path.join(epicRoot, ".runtime", "runtime-state.json");
    const before = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    fs.writeFileSync(runtimePath, `${JSON.stringify({ ...before, updated_at: "2000-01-01T00:00:00+00:00" }, null, 2)}\n`, "utf8");

    const setReview = runNodeScript("set-epic-mode.mjs", ["--root", tempRoot, "--slug", "mode-source", "--mode", "review"]);
    assertSuccess(setReview);
    assert.match(setReview.stdout, /Epic mode set for mode-source: review/u);

    const after = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    assert.equal(after.mode, "review");
    assert.notEqual(after.updated_at, "2000-01-01T00:00:00+00:00");
    assert.doesNotMatch(fs.readFileSync(path.join(epicRoot, "state-of-epic.md"), "utf8"), /^Current mode:/mu);

    const invalid = runNodeScript("set-epic-mode.mjs", ["--root", tempRoot, "--slug", "mode-source", "--mode", "planning"]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Invalid --mode "planning"/u);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test("loop summaries do not parse lifecycle mode from state-of-epic prose", () => {
  const loopSource = fs.readFileSync(path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop", "scripts", "lib", "loop.mjs"), "utf8");

  assert.doesNotMatch(loopSource, /readStateLine\(text,\s*["']Current mode["']\)/u);
});
