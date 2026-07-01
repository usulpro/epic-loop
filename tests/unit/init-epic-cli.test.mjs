import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { assertSuccess, makeTempRoot, runNodeScript } from "./test-utils.mjs";

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

    const runtimeState = JSON.parse(fs.readFileSync(path.join(epicRoot, ".runtime", "runtime-state.json"), "utf8"));
    assert.equal(runtimeState.slug, "unit-harness");
    assert.equal(runtimeState.mode, "shaping");
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});
