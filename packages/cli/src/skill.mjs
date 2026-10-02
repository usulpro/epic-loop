import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const SKILL_VERSION_PATTERN = /^const SKILL_VERSION = "([^"]+)";$/mu;

export const INSTALL_TYPES = ["copy", "claude-plugin", "codex-plugin"];

function homeDir(env) {
  return env.HOME || os.homedir();
}

function isSkillDir(dir) {
  return typeof dir === "string" && fs.existsSync(path.join(dir, "SKILL.md"));
}

// The skill's version lives in its wrapper (`scripts/epic-loop.mjs`), which pins the
// CLI version it runs. Returns null for skill copies that predate the wrapper.
export function readSkillVersion(skillDir) {
  const wrapperPath = path.join(skillDir, "scripts", "epic-loop.mjs");
  if (!fs.existsSync(wrapperPath)) {
    return null;
  }

  return fs.readFileSync(wrapperPath, "utf8").match(SKILL_VERSION_PATTERN)?.[1] ?? null;
}

export function detectInstallType(skillDir) {
  const normalized = path.resolve(skillDir).split(path.sep).join("/");
  if (normalized.includes("/.claude/plugins/cache/")) {
    return "claude-plugin";
  }
  if (normalized.includes("/.codex/plugins/cache/")) {
    return "codex-plugin";
  }
  return "copy";
}

function claudePluginSkillDirs(root, env) {
  const registryPath = path.join(homeDir(env), ".claude", "plugins", "installed_plugins.json");
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch {
    return [];
  }

  const plugins = registry && typeof registry.plugins === "object" && registry.plugins ? registry.plugins : {};
  return Object.entries(plugins)
    .filter(([key]) => key.startsWith("epic-loop@"))
    .flatMap(([, installs]) => (Array.isArray(installs) ? installs : []))
    .filter((install) => install?.scope === "user" || install?.projectPath === root)
    .map((install) => path.join(String(install.installPath ?? ""), "skills", "epic-loop"));
}

function candidateSkillDirs(root, platform, env) {
  const home = homeDir(env);
  const claude = [path.join(root, ".claude", "skills", "epic-loop"), ...claudePluginSkillDirs(root, env), path.join(home, ".claude", "skills", "epic-loop")];
  const codex = [
    path.join(root, ".codex", "skills", "epic-loop"),
    path.join(root, ".agents", "skills", "epic-loop"),
    path.join(home, ".codex", "skills", "epic-loop"),
    path.join(home, ".agents", "skills", "epic-loop"),
  ];

  if (platform === "claude-code") {
    return claude;
  }
  if (platform === "codex") {
    return codex;
  }
  return [...claude, ...codex];
}

// Resolution order: explicit --skill-dir, then EPIC_LOOP_SKILL_DIR (set by the skill
// wrapper), then well-known install locations for the selected platform.
export function resolveSkill({ flags = {}, root, platform = null, env = process.env }) {
  let dir = null;
  let source = null;

  if (typeof flags["skill-dir"] === "string") {
    dir = path.resolve(flags["skill-dir"]);
    source = "flag";
  } else if (env.EPIC_LOOP_SKILL_DIR) {
    dir = path.resolve(env.EPIC_LOOP_SKILL_DIR);
    source = "env";
  } else {
    dir = candidateSkillDirs(root, platform, env).find(isSkillDir) ?? null;
    source = dir ? "discovered" : null;
  }

  if (!dir) {
    return null;
  }

  if (!isSkillDir(dir)) {
    throw new Error(`Not an epic-loop skill directory (no SKILL.md): ${dir}`);
  }

  return {
    dir,
    installType: detectInstallType(dir),
    source,
    version: readSkillVersion(dir),
  };
}

export function requireSkill(options) {
  const skill = resolveSkill(options);
  if (!skill) {
    throw new Error("Cannot locate the epic-loop skill. Run through `node <skill-dir>/scripts/epic-loop.mjs ...` or pass --skill-dir <path>.");
  }
  return skill;
}

// The exact command that updates this kind of installation to `version`.
export function updateCommandFor(skill, version) {
  if (skill.installType === "claude-plugin") {
    return "claude plugin marketplace update epic-loop && claude plugin update epic-loop@epic-loop";
  }
  if (skill.installType === "codex-plugin") {
    return "codex plugin marketplace upgrade epic-loop && codex plugin add epic-loop@epic-loop";
  }
  return `npx --yes epic-loop@${version} update --skill-dir '${skill.dir.replace(/'/gu, "'\\''")}'`;
}
