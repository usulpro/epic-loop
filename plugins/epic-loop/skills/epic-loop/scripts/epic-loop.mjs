#!/usr/bin/env node

// Thin entry point into the `epic-loop` npm CLI, pinned to this skill's version.
// The skill and the npm package share one version; `scripts/release.mjs` stamps
// SKILL_VERSION on release. EPIC_LOOP_CLI points at a local CLI entry (for
// development and tests) and bypasses npx entirely.

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SKILL_VERSION = "0.2.0";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devCli = process.env.EPIC_LOOP_CLI;
const isWindows = process.platform === "win32";

const [command, baseArgs] = devCli ? [process.execPath, [path.resolve(devCli)]] : [isWindows ? "npx.cmd" : "npx", ["--yes", "--prefer-offline", `epic-loop@${SKILL_VERSION}`]];

const result = spawnSync(command, [...baseArgs, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    EPIC_LOOP_SKILL_DIR: skillDir,
    EPIC_LOOP_SKILL_VERSION: SKILL_VERSION,
  },
  shell: isWindows && !devCli,
  stdio: "inherit",
});

if (result.error) {
  console.error(`epic-loop: failed to run ${devCli ? devCli : `epic-loop@${SKILL_VERSION} via npx`}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
