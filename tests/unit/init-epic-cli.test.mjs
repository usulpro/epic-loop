import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const initEpicScript = path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop", "scripts", "init-epic.mjs");

test("init-epic CLI initializes an isolated temporary project", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-init-"));

  try {
    const result = spawnSync(
      process.execPath,
      [initEpicScript, "--root", tempRoot, "--description", "Unit harness smoke project", "--no-gitignore"],
      {
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
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
