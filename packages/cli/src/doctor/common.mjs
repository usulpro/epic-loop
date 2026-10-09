// Temporary duplicate of the subset of plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs
// that `epic-loop doctor` needs. Remove once the skill scripts migrate into this package.

import fs from "node:fs";
import path from "node:path";

export const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"];
export const MODES = ["shaping", "implementation", "review"];
export const PLATFORMS = ["codex", "claude-code"];
export const CODEX_HOOKS_RELATIVE_PATH = path.join(".codex", "hooks.json");
export const CODEX_CONFIG_RELATIVE_PATH = path.join(".codex", "config.toml");
export const PLATFORM_CONFIG_RELATIVE_PATH = path.join(".epic-loop", ".runtime", "platform.json");

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "+00:00");
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readJsonStrict(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      error: null,
      exists: false,
      value: null,
    };
  }

  try {
    return {
      error: null,
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf8")),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      exists: true,
      value: null,
    };
  }
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

export function canWritePath(targetPath) {
  let existingPath = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
  while (!fs.existsSync(existingPath) && path.dirname(existingPath) !== existingPath) {
    existingPath = path.dirname(existingPath);
  }

  try {
    fs.accessSync(existingPath, fs.constants.W_OK);
    return {
      ok: true,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function canReadPath(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return {
      ok: true,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function epicLoopRoot(projectRoot) {
  return path.join(projectRoot, ".epic-loop");
}

export function sessionRoot(projectRoot) {
  return path.join(epicLoopRoot(projectRoot), ".runtime");
}

export function platformConfigPath(projectRoot) {
  return path.join(projectRoot, PLATFORM_CONFIG_RELATIVE_PATH);
}

export function normalizeRuntimePlatform(value) {
  return typeof value === "string" && PLATFORMS.includes(value) ? value : null;
}

export function writeRuntimePlatform(projectRoot, platform) {
  const normalizedPlatform = normalizeRuntimePlatform(platform);
  if (!normalizedPlatform) {
    throw new Error(`Invalid --platform "${platform}". Expected one of: ${PLATFORMS.join(", ")}.`);
  }

  const timestamp = nowIso();
  writeJson(platformConfigPath(projectRoot), {
    platform: normalizedPlatform,
    selected_at: timestamp,
  });

  return {
    path: platformConfigPath(projectRoot),
    platform: normalizedPlatform,
    selected_at: timestamp,
  };
}

export function epicsRoot(projectRoot) {
  return path.join(epicLoopRoot(projectRoot), "epics");
}

export function validateEpicSlug(slug) {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new Error("Invalid epic slug: expected a non-empty lowercase kebab-case path segment.");
  }
  if (slug !== slug.trim()) {
    throw new Error(`Invalid epic slug "${slug}": leading or trailing whitespace is not allowed.`);
  }
  if (path.isAbsolute(slug) || slug.includes("/") || slug.includes("\\")) {
    throw new Error(`Invalid epic slug "${slug}": path separators are not allowed.`);
  }
  if (slug === "." || slug === ".." || slug.includes("..")) {
    throw new Error(`Invalid epic slug "${slug}": dot segments are not allowed.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new Error(`Invalid epic slug "${slug}": expected lowercase kebab-case letters and numbers.`);
  }
  return slug;
}

export function epicRoot(projectRoot, slug) {
  const safeSlug = validateEpicSlug(slug);
  const root = epicsRoot(projectRoot);
  const epicPath = path.join(root, safeSlug);
  const relative = path.relative(path.resolve(root), path.resolve(epicPath));

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Epic path must stay inside .epic-loop/epics/: ${slug}`);
  }

  return epicPath;
}

export function epicRuntimeRoot(projectRoot, slug) {
  return path.join(epicRoot(projectRoot, slug), ".runtime");
}

export function runtimeStatePath(projectRoot, slug) {
  return path.join(epicRuntimeRoot(projectRoot, slug), "runtime-state.json");
}

export function roadmapStatePath(projectRoot, slug) {
  return path.join(epicRuntimeRoot(projectRoot, slug), "roadmap-state.json");
}

export function formatList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}
