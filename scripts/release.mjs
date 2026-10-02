// Stamps one version across every place that carries it: the npm CLI package, the
// skill wrapper pin, both plugin manifests, and the root package. Publishing,
// committing, and tagging stay manual (see README "Releasing").

import fs from "node:fs";
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

function main() {
  const root = process.cwd();
  const version = process.argv[2];

  if (!/^\d+\.\d+\.\d+$/u.test(version ?? "")) {
    console.error("Usage: pnpm run release <major.minor.patch>");
    console.error(`Current versions: ${JSON.stringify(readVersions(root))}`);
    process.exit(1);
  }

  writeVersion(root, version);
  const mismatched = Object.entries(readVersions(root)).filter(([, value]) => value !== version);
  if (mismatched.length > 0) {
    console.error(`Failed to stamp ${version} into: ${mismatched.map(([key]) => VERSION_FILES[key]).join(", ")}`);
    process.exit(1);
  }

  for (const relativePath of Object.values(VERSION_FILES)) {
    console.log(`Stamped ${version}: ${relativePath}`);
  }

  if (!fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").includes(`## ${version}`)) {
    console.log(`\nReminder: CHANGELOG.md has no "## ${version}" section yet.`);
  }

  console.log(`
Next (order matters: npm must have the version before git points at it):
  1. pnpm run validate && pnpm run test:unit
  2. cd packages/cli && npm publish        # prepack builds dist/ and copies the skill
  3. git commit -am "release: v${version}" && git tag v${version}
  4. git push && git push --tags`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
