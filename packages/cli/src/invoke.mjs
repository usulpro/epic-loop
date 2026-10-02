import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

// Runs a specific published CLI version through npx, or the local CLI named by
// EPIC_LOOP_CLI (development and tests), mirroring the skill wrapper.
export function runCliVersion(version, args, options = {}) {
  const env = options.env ?? process.env;
  const devCli = env.EPIC_LOOP_CLI;
  const isWindows = process.platform === "win32";
  const [command, baseArgs] = devCli ? [process.execPath, [path.resolve(devCli)]] : [isWindows ? "npx.cmd" : "npx", ["--yes", "--prefer-offline", `epic-loop@${version}`]];

  return spawnSync(command, [...baseArgs, ...args], {
    encoding: "utf8",
    env,
    shell: isWindows && !devCli,
    stdio: options.stdio ?? "pipe",
  });
}
