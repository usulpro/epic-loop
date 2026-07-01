import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  appendGitignore,
  epicLoopRoot,
  epicSlugify,
  platformSetupCommand,
  parseArgs,
  readJson,
  readRuntimePlatform,
  requireFlag,
  requireRuntimePlatform,
  slugify,
  writeJson,
  writeRuntimePlatform,
  writeOnce,
} from "../../plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs";

test("common helpers can be imported and used from the unit harness", () => {
  assert.equal(slugify("Deterministic Unit Tests!"), "deterministic-unit-tests");
  assert.equal(epicSlugify("Deterministic Unit Test Harness"), "deterministic-unit");
  assert.match(epicSlugify(""), /^epic-\d{14}$/u);
  assert.equal(epicLoopRoot("/tmp/example-project"), "/tmp/example-project/.epic-loop");

  assert.deepEqual(parseArgs(["--slug", "test-coverage", "status", "--json"]), {
    flags: {
      json: true,
      slug: "test-coverage",
    },
    positionals: ["status"],
  });
});

test("JSON and write-once helpers handle fallback and idempotency", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-common-"));

  try {
    const jsonPath = path.join(tempRoot, "nested", "state.json");
    assert.deepEqual(readJson(jsonPath, { fallback: true }), { fallback: true });

    writeJson(jsonPath, { ok: true });
    assert.deepEqual(readJson(jsonPath, null), { ok: true });

    fs.writeFileSync(jsonPath, "{not-json", "utf8");
    assert.deepEqual(readJson(jsonPath, { malformed: true }), { malformed: true });

    const writeOncePath = path.join(tempRoot, "once.txt");
    writeOnce(writeOncePath, "first");
    writeOnce(writeOncePath, "second");
    assert.equal(fs.readFileSync(writeOncePath, "utf8"), "first");
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test("runtime platform helpers persist and validate explicit platform selection", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-platform-"));

  try {
    assert.throws(() => requireRuntimePlatform(tempRoot), /doctor\.mjs --platform codex\|claude-code --json/u);
    assert.equal(platformSetupCommand(), "doctor.mjs --platform codex|claude-code --json");

    const codexConfig = writeRuntimePlatform(tempRoot, "codex");
    assert.equal(codexConfig.platform, "codex");
    assert.equal(readRuntimePlatform(tempRoot).platform, "codex");
    assert.equal(requireRuntimePlatform(tempRoot), "codex");

    const claudeConfig = writeRuntimePlatform(tempRoot, "claude-code");
    assert.equal(claudeConfig.platform, "claude-code");
    assert.equal(requireRuntimePlatform(tempRoot), "claude-code");

    assert.throws(() => writeRuntimePlatform(tempRoot, "auto"), /Invalid --platform "auto"/u);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test("appendGitignore adds runtime ignores once", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-gitignore-"));

  try {
    const gitignorePath = path.join(tempRoot, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n", "utf8");

    appendGitignore(tempRoot);
    appendGitignore(tempRoot);

    const lines = fs.readFileSync(gitignorePath, "utf8").trim().split(/\r?\n/u);
    assert.deepEqual(lines, ["node_modules/", ".epic-loop/.runtime/", ".epic-loop/epics/*/.runtime/"]);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test("requireFlag reports missing required flags clearly", () => {
  assert.equal(requireFlag({ slug: "test-coverage" }, "slug"), "test-coverage");
  assert.throws(() => requireFlag({}, "slug"), /Missing required --slug/u);
  assert.throws(() => requireFlag({ slug: true }, "slug"), /Missing required --slug/u);
});
