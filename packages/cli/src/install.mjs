import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import { runDoctor } from "./doctor/index.mjs";
import { PLATFORMS, writeRuntimePlatform } from "./doctor/common.mjs";
import { bundledSkillDir, readCliVersion } from "./paths.mjs";
import { findProjectRoot } from "./project-root.mjs";
import { readSkillVersion, requireSkill, updateCommandFor } from "./skill.mjs";
import { copySkillAtomically } from "./skill-copy.mjs";

const SKILL_PARENT_BY_PLATFORM = {
  "claude-code": ".claude",
  codex: ".codex",
};

function shippedSkill() {
  const dir = bundledSkillDir();
  const version = readSkillVersion(dir);
  const cliVersion = readCliVersion();
  if (version !== cliVersion) {
    throw new Error(`Shipped skill version ${version ?? "unknown"} does not match CLI version ${cliVersion}; the package build is inconsistent.`);
  }
  return { dir, version };
}

// `epic-loop install --platform <p>`: project-local skill copy + platform selection +
// hooks, i.e. the same end state as copying the skill folder by hand and running setup.
export async function runInstall(flags = {}, { env = process.env } = {}) {
  const platform = flags.platform;
  if (!PLATFORMS.includes(platform)) {
    throw new Error(`Missing or invalid --platform. Expected one of: ${PLATFORMS.join(", ")}.`);
  }

  const root = path.resolve(typeof flags.root === "string" ? flags.root : ".");
  const target = path.join(root, SKILL_PARENT_BY_PLATFORM[platform], "skills", "epic-loop");
  const shipped = shippedSkill();
  const previousVersion = fs.existsSync(path.join(target, "SKILL.md")) ? readSkillVersion(target) : null;
  const alreadyInstalled = previousVersion === shipped.version;

  if (!alreadyInstalled) {
    copySkillAtomically(shipped.dir, target);
  }
  console.log(
    alreadyInstalled
      ? `epic-loop skill ${shipped.version} already installed: ${target}`
      : `Installed epic-loop skill ${shipped.version}${previousVersion ? ` (was ${previousVersion})` : ""}: ${target}`,
  );

  writeRuntimePlatform(root, platform);

  if (!flags["no-hooks"]) {
    const hooks = spawnSync(process.execPath, [path.join(target, "scripts", "install-hooks.mjs"), "--root", root], { encoding: "utf8", env });
    process.stdout.write(hooks.stdout ?? "");
    if (hooks.status !== 0) {
      process.stderr.write(hooks.stderr ?? "");
      throw new Error("Hook installation failed.");
    }
  }

  console.log("");
  return runDoctor({ platform, root, "skill-dir": target }, { env: { ...env, EPIC_LOOP_SKIP_AUTOUPDATE: "1" } });
}

// `epic-loop update`: replaces a local skill copy with the one this CLI version ships.
// Plugin installs are owned by their host and are only pointed at the host command.
export function runUpdate(flags = {}, { env = process.env } = {}) {
  const root = path.resolve(typeof flags.root === "string" ? flags.root : (findProjectRoot(process.cwd()) ?? "."));
  const platform = typeof flags.platform === "string" ? flags.platform : null;
  const skill = requireSkill({ env, flags, platform, root });
  const shipped = shippedSkill();

  if (skill.installType !== "copy") {
    throw new Error(
      `The skill at ${skill.dir} is a ${skill.installType} install; update it through the host instead:\n  ${updateCommandFor(skill, shipped.version)}\nThen run doctor again.`,
    );
  }

  const upToDate = skill.version === shipped.version && !flags.force;
  if (!upToDate) {
    copySkillAtomically(shipped.dir, skill.dir);
  }

  const result = {
    action: upToDate ? "up-to-date" : "updated",
    from: skill.version,
    skillDir: skill.dir,
    to: shipped.version,
  };

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (upToDate) {
    console.log(`epic-loop skill is already at ${shipped.version}: ${skill.dir}`);
  } else {
    console.log(`Updated epic-loop skill ${skill.version ?? "unknown"} -> ${shipped.version}: ${skill.dir}`);
    console.log("Next: run doctor through the skill wrapper to verify hooks and epic state.");
  }
  return 0;
}
