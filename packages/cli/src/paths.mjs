import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `src/` when running from source, `dist/` when running the published bundle.
const ENTRY_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.dirname(ENTRY_DIR);

const REPO_SKILL_DIR = path.join(PACKAGE_ROOT, "..", "..", "plugins", "epic-loop", "skills", "epic-loop");
const PACKAGED_SKILL_DIR = path.join(PACKAGE_ROOT, "skill");

export function readCliVersion() {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")).version;
}

// The skill content this CLI version ships. The published package carries a copy
// made at build time; running from source uses the repository's skill directly so a
// stale build copy can never leak into development.
export function bundledSkillDir() {
  if (path.basename(ENTRY_DIR) === "src" && fs.existsSync(REPO_SKILL_DIR)) {
    return REPO_SKILL_DIR;
  }

  return PACKAGED_SKILL_DIR;
}
