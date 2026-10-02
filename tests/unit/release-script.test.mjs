import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { VERSION_FILES, demoteChangelog, isNewer, nextVersion, promoteChangelog, readVersions, writeVersion } from "../../scripts/release.mjs";
import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const releaseScript = path.join(repoRoot, "scripts", "release.mjs");

test("release version bumps accept explicit versions and patch/minor/major", () => {
  assert.equal(nextVersion("0.1.0", "0.3.4"), "0.3.4");
  assert.equal(nextVersion("0.1.9", "patch"), "0.1.10");
  assert.equal(nextVersion("0.1.9", "minor"), "0.2.0");
  assert.equal(nextVersion("0.1.9", "major"), "1.0.0");
  assert.throws(() => nextVersion("0.1.0", "next"), /patch\|minor\|major/u);
  assert.equal(isNewer("0.10.0", "0.9.9"), true);
  assert.equal(isNewer("0.1.0", "0.1.0"), false);
});

test("release changelog promotion requires a non-empty Unreleased section and round-trips on abort", () => {
  const changelog = "# Changelog\n\n## Unreleased\n\n- Add things.\n\n## 0.1.0\n\n- First.\n";
  const promoted = promoteChangelog(changelog, "0.2.0");
  assert.match(promoted, /\n## 0\.2\.0\n\n- Add things\./u);
  assert.equal(promoteChangelog(promoted, "0.2.0"), promoted);
  assert.equal(demoteChangelog(promoted, "0.2.0"), changelog);

  assert.throws(() => promoteChangelog("# Changelog\n\n## Unreleased\n\n## 0.1.0\n\n- First.\n", "0.2.0"), /lists no changes/u);
  assert.throws(() => promoteChangelog("# Changelog\n\n## 0.1.0\n\n- First.\n", "0.2.0"), /neither a "## Unreleased"/u);
});

test("release stamp writes one version into every versioned file", () => {
  const root = makeTempRoot("release-stamp");
  for (const relativePath of Object.values(VERSION_FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relativePath), path.join(root, relativePath));
  }

  writeVersion(root, "7.8.9");
  assert.deepEqual(new Set(Object.values(readVersions(root))), new Set(["7.8.9"]));
});

test("release prepare refuses to run outside the release branch before touching anything", () => {
  const root = makeTempRoot("release-branch");
  spawnSync("git", ["init", "-q", "-b", "feature/x"], { cwd: root });
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: root });

  const result = spawnSync(process.execPath, [releaseScript, "prepare", "patch"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Releases are cut from main; current branch is feature\/x/u);
});
