// Release pipeline for epic-loop. One version moves in lockstep across the npm CLI
// package, the skill wrapper pin, both plugin manifests, and the root package.
//
//   stamp <version>                        write the version into every versioned file
//   prepare <version|patch|minor|major>    preflight, stamp, changelog, validate, tests,
//                                          build + pack check, local release commit
//   wait <version>                         poll npm until the manual `npm publish` lands
//   finish <version>                       smoke-test the published package, tag, push,
//                                          sync the repo's runtime skill copies
//   abort <version>                        undo an unpublished release commit
//
// The only manual step is `npm publish` between prepare and finish. Order matters: the
// skill on main pins the new version, so npm must have it before anything is pushed.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const VERSION_FILES = {
  claudePlugin: "plugins/epic-loop/.claude-plugin/plugin.json",
  cliPackage: "packages/cli/package.json",
  codexPlugin: "plugins/epic-loop/.codex-plugin/plugin.json",
  rootPackage: "package.json",
  skillWrapper: "plugins/epic-loop/skills/epic-loop/scripts/epic-loop.mjs",
};

const WRAPPER_VERSION_PATTERN = /^const SKILL_VERSION = "([^"]+)";$/mu;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const RELEASE_BRANCH = process.env.EPIC_LOOP_RELEASE_BRANCH || "main";
const CHANGELOG = "CHANGELOG.md";
const RUNTIME_SKILL_COPIES = [".claude/skills/epic-loop", ".codex/skills/epic-loop"];
const SOURCE_SKILL = "plugins/epic-loop/skills/epic-loop";

export function readVersions(root) {
  const versions = {};
  for (const [key, relativePath] of Object.entries(VERSION_FILES)) {
    const content = fs.readFileSync(path.join(root, relativePath), "utf8");
    versions[key] = key === "skillWrapper" ? (content.match(WRAPPER_VERSION_PATTERN)?.[1] ?? null) : JSON.parse(content).version;
  }
  return versions;
}

export function writeVersion(root, version) {
  for (const [key, relativePath] of Object.entries(VERSION_FILES)) {
    const filePath = path.join(root, relativePath);
    const content = fs.readFileSync(filePath, "utf8");
    const next =
      key === "skillWrapper" ? content.replace(WRAPPER_VERSION_PATTERN, `const SKILL_VERSION = "${version}";`) : content.replace(/^(\s*"version":\s*)"[^"]*"/mu, `$1"${version}"`);
    fs.writeFileSync(filePath, next, "utf8");
  }
}

export function nextVersion(current, spec) {
  if (VERSION_PATTERN.test(spec ?? "")) {
    return spec;
  }

  const parts = String(current).split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`Cannot bump invalid current version: ${current}`);
  }

  const [major, minor, patch] = parts;
  if (spec === "major") {
    return `${major + 1}.0.0`;
  }
  if (spec === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  if (spec === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }
  throw new Error(`Expected a version (x.y.z) or patch|minor|major, got: ${spec}`);
}

export function isNewer(candidate, current) {
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] > b[index];
    }
  }
  return false;
}

// Turns the "## Unreleased" section into "## <version>". The section must list at
// least one change; a changelog that already has "## <version>" is left as is.
export function promoteChangelog(content, version) {
  if (content.includes(`\n## ${version}\n`)) {
    return content;
  }

  const match = content.match(/\n## Unreleased\n([\s\S]*?)(?=\n## |$)/u);
  if (!match) {
    throw new Error(`${CHANGELOG} has neither a "## Unreleased" nor a "## ${version}" section; describe the release first.`);
  }
  if (!/^- \S/mu.test(match[1])) {
    throw new Error(`${CHANGELOG} "## Unreleased" lists no changes; describe the release first.`);
  }
  return content.replace("\n## Unreleased\n", `\n## ${version}\n`);
}

export function demoteChangelog(content, version) {
  return content.replace(`\n## ${version}\n`, "\n## Unreleased\n");
}

function run(command, args, { cwd = process.cwd(), env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env, stdio: capture ? "pipe" : "inherit" });
  if (result.error) {
    throw new Error(`${command} ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = capture ? `\n${(result.stderr || result.stdout || "").trim()}` : "";
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}${detail}`);
  }
  return capture ? result.stdout.trim() : "";
}

function git(args, options = {}) {
  return run("git", args, { ...options, capture: true });
}

function registryUrl() {
  return (process.env.EPIC_LOOP_REGISTRY_URL || "https://registry.npmjs.org").replace(/\/+$/u, "");
}

async function isPublished(version) {
  const response = await fetch(`${registryUrl()}/epic-loop/${version}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`npm registry responded ${response.status} for epic-loop@${version}`);
  }
  return true;
}

function requireVersion(version) {
  if (!VERSION_PATTERN.test(version ?? "")) {
    throw new Error("Expected a version argument in x.y.z form.");
  }
  return version;
}

function assertReleaseBranch(root) {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
  if (branch !== RELEASE_BRANCH) {
    throw new Error(`Releases are cut from ${RELEASE_BRANCH}; current branch is ${branch}.`);
  }
}

function assertVersionsEqual(root, expected) {
  const versions = readVersions(root);
  const mismatched = Object.entries(versions).filter(([, value]) => value !== expected);
  if (mismatched.length > 0) {
    throw new Error(`Versioned files disagree with ${expected}: ${mismatched.map(([key, value]) => `${VERSION_FILES[key]}=${value}`).join(", ")}`);
  }
}

function assertReleaseCommit(root, version) {
  const subject = git(["log", "-1", "--format=%s"], { cwd: root });
  if (subject !== `release: v${version}`) {
    throw new Error(`HEAD is not the release commit for v${version} (HEAD: "${subject}").`);
  }
}

function tagExists(root, tag, remote) {
  if (remote) {
    return git(["ls-remote", "--tags", "origin", `refs/tags/${tag}`], { cwd: root }) !== "";
  }
  return spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { cwd: root }).status === 0;
}

function checkPackedTarball(root, version) {
  const cliDir = path.join(root, "packages", "cli");
  const [pack] = JSON.parse(run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { capture: true, cwd: cliDir }));
  const files = new Set(pack.files.map((file) => file.path));
  const missing = ["dist/epic-loop.mjs", "skill/SKILL.md", "skill/scripts/epic-loop.mjs"].filter((file) => !files.has(file));
  if (pack.version !== version || missing.length > 0) {
    throw new Error(`Packed tarball is wrong: version ${pack.version}, missing ${missing.join(", ") || "nothing"}.`);
  }

  const packedWrapper = fs.readFileSync(path.join(cliDir, "skill", "scripts", "epic-loop.mjs"), "utf8");
  if (packedWrapper.match(WRAPPER_VERSION_PATTERN)?.[1] !== version) {
    throw new Error("The skill copy inside the package does not pin the release version.");
  }
  console.log(`Packed tarball OK: epic-loop@${version}, ${pack.files.length} files, skill included.`);
}

function stamp(root, version) {
  writeVersion(root, requireVersion(version));
  assertVersionsEqual(root, version);
  for (const relativePath of Object.values(VERSION_FILES)) {
    console.log(`Stamped ${version}: ${relativePath}`);
  }
}

async function prepare(root, spec) {
  assertReleaseBranch(root);

  // Changed paths, not `git status --porcelain` lines: the git() helper trims output,
  // which would eat the status column of the first line.
  const dirty = [...git(["diff", "--name-only", "HEAD"], { cwd: root }).split("\n"), ...git(["ls-files", "--others", "--exclude-standard"], { cwd: root }).split("\n")]
    .filter(Boolean)
    .filter((file) => file !== CHANGELOG);
  if (dirty.length > 0) {
    throw new Error(`Working tree must be clean (only ${CHANGELOG} may be edited):\n${dirty.join("\n")}`);
  }

  git(["fetch", "--quiet", "origin", RELEASE_BRANCH], { cwd: root });
  const behind = Number(git(["rev-list", "--count", `HEAD..origin/${RELEASE_BRANCH}`], { cwd: root }));
  if (behind > 0) {
    throw new Error(`${RELEASE_BRANCH} is ${behind} commit(s) behind origin; pull first.`);
  }

  const current = readVersions(root).cliPackage;
  assertVersionsEqual(root, current);
  const version = nextVersion(current, spec);
  if (!isNewer(version, current)) {
    throw new Error(`Release version ${version} must be newer than the current ${current}.`);
  }
  if (tagExists(root, `v${version}`, false) || tagExists(root, `v${version}`, true)) {
    throw new Error(`Tag v${version} already exists.`);
  }
  if (await isPublished(version)) {
    throw new Error(`epic-loop@${version} is already on npm.`);
  }

  console.log(`Preparing epic-loop v${current} -> v${version}\n`);
  const changelogPath = path.join(root, CHANGELOG);
  const originalChangelog = fs.readFileSync(changelogPath, "utf8");

  try {
    fs.writeFileSync(changelogPath, promoteChangelog(originalChangelog, version), "utf8");
    stamp(root, version);
    run("pnpm", ["run", "validate"], { cwd: root });
    run("pnpm", ["run", "test:unit"], { cwd: root });
    run(process.execPath, ["scripts/build.mjs"], { cwd: path.join(root, "packages", "cli") });
    checkPackedTarball(root, version);
  } catch (error) {
    git(["checkout", "--", ...Object.values(VERSION_FILES)], { cwd: root });
    fs.writeFileSync(changelogPath, originalChangelog, "utf8");
    console.error("\nRelease preparation failed; versioned files and the changelog were restored.");
    throw error;
  }

  git(["add", "--", ...Object.values(VERSION_FILES), CHANGELOG], { cwd: root });
  git(["commit", "--quiet", "-m", `release: v${version}`], { cwd: root });

  console.log(`
Release commit created locally: release: v${version} (nothing pushed, no tag yet).

Manual step:
  cd packages/cli && npm publish

Then: node scripts/release.mjs wait ${version}   (or finish ${version} once published)`);
}

async function wait(version, flags) {
  requireVersion(version);
  const intervalMs = Number(flags.interval ?? 15) * 1000;
  const deadline = Date.now() + Number(flags.timeout ?? 60) * 60 * 1000;
  const startedAt = Date.now();
  let lastReport = startedAt;

  console.log(`Waiting for epic-loop@${version} on ${registryUrl()} ...`);
  while (Date.now() < deadline) {
    try {
      if (await isPublished(version)) {
        console.log(`epic-loop@${version} is published.`);
        return;
      }
    } catch (error) {
      console.log(`Registry check failed, retrying: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (Date.now() - lastReport >= 60000) {
      console.log(`Still waiting (${Math.round((Date.now() - startedAt) / 60000)} min).`);
      lastReport = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for epic-loop@${version} on npm.`);
}

async function smokePublishedCli(version) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-release-"));
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const result = spawnSync("npx", ["--yes", `epic-loop@${version}`, "--version"], { cwd, encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim() === `epic-loop v${version}`) {
      console.log(`npx epic-loop@${version} --version OK.`);
      return;
    }
    console.log(`npx smoke attempt ${attempt} failed; registry may still be propagating.`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error(`npx epic-loop@${version} --version did not report v${version}.`);
}

function smokeRuntimeDoctor(root, version) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-release-doctor-"));
  const env = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" };
  delete env.EPIC_LOOP_CLI;
  delete env.EPIC_LOOP_SKILL_DIR;

  const wrapper = path.join(root, RUNTIME_SKILL_COPIES[0], "scripts", "epic-loop.mjs");
  const output = run(process.execPath, [wrapper, "doctor", "--platform", "claude-code", "--json", "--root", projectRoot], { capture: true, env });
  const status = JSON.parse(output);
  if (status.cli?.version !== version || status.skill?.version !== version) {
    throw new Error(`Runtime doctor reports cli ${status.cli?.version} / skill ${status.skill?.version}, expected ${version}.`);
  }
  console.log(`Runtime skill copy runs the published CLI: doctor reports cli ${version}, skill ${version}.`);
}

async function finish(root, version) {
  requireVersion(version);
  assertReleaseBranch(root);
  assertReleaseCommit(root, version);
  assertVersionsEqual(root, version);
  if (git(["status", "--porcelain"], { cwd: root }) !== "") {
    throw new Error("Working tree must be clean before finishing the release.");
  }
  if (!(await isPublished(version))) {
    throw new Error(`epic-loop@${version} is not on npm yet. Publish it (cd packages/cli && npm publish), then rerun finish.`);
  }

  await smokePublishedCli(version);

  if (!tagExists(root, `v${version}`, false)) {
    git(["tag", "-a", `v${version}`, "-m", `epic-loop v${version}`], { cwd: root });
  }
  run("git", ["push", "origin", RELEASE_BRANCH], { cwd: root });
  run("git", ["push", "origin", `v${version}`], { cwd: root });

  run(process.execPath, ["scripts/self-update-skill.mjs"], { cwd: root });
  for (const copy of RUNTIME_SKILL_COPIES) {
    run("diff", ["-rq", "--exclude=.runtime", SOURCE_SKILL, copy], { capture: true, cwd: root });
  }
  console.log("Runtime skill copies match the source.");
  smokeRuntimeDoctor(root, version);

  console.log(`
Released epic-loop v${version}:
  - npm: epic-loop@${version}
  - git: release commit + tag v${version} pushed to origin/${RELEASE_BRANCH}
  - runtime skill copies (.claude, .codex) synced and verified
Plugin users pick it up via their host's marketplace update.`);
}

async function abort(root, version) {
  requireVersion(version);
  assertReleaseCommit(root, version);
  if (await isPublished(version)) {
    throw new Error(`epic-loop@${version} is already on npm; finish the release instead of aborting it.`);
  }
  if (tagExists(root, `v${version}`, true)) {
    throw new Error(`Tag v${version} is already on origin; resolve it by hand.`);
  }
  if (tagExists(root, `v${version}`, false)) {
    git(["tag", "-d", `v${version}`], { cwd: root });
  }

  git(["reset", "--quiet", "--mixed", "HEAD~1"], { cwd: root });
  git(["checkout", "--", ...Object.values(VERSION_FILES)], { cwd: root });
  const changelogPath = path.join(root, CHANGELOG);
  fs.writeFileSync(changelogPath, demoteChangelog(fs.readFileSync(changelogPath, "utf8"), version), "utf8");
  console.log(`Aborted v${version}: release commit removed, versions restored, ${CHANGELOG} back to "## Unreleased".`);
}

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) {
      flags[argv[index].slice(2)] = argv[index + 1];
      index += 1;
    } else {
      positionals.push(argv[index]);
    }
  }
  return { flags, positionals };
}

const USAGE = "Usage: node scripts/release.mjs <stamp <x.y.z> | prepare <x.y.z|patch|minor|major> | wait <x.y.z> [--interval s] [--timeout min] | finish <x.y.z> | abort <x.y.z>>";

async function main() {
  const root = process.cwd();
  const { flags, positionals } = parseFlags(process.argv.slice(2));
  const [command, argument] = positionals;

  switch (command) {
    case "stamp":
      return stamp(root, argument);
    case "prepare":
      return prepare(root, argument);
    case "wait":
      return wait(argument, flags);
    case "finish":
      return finish(root, argument);
    case "abort":
      return abort(root, argument);
    default:
      console.error(USAGE);
      console.error(`Current versions: ${JSON.stringify(readVersions(root))}`);
      process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
