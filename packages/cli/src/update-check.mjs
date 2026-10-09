import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

function cachePath(root) {
  return path.join(root, ".epic-loop", ".runtime", "update-check.json");
}

function readCache(root) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(root), "utf8"));
  } catch {
    return null;
  }
}

function writeCache(root, value) {
  const filePath = cachePath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseVersion(version) {
  const match = String(version ?? "").match(/^(\d+)\.(\d+)\.(\d+)$/u);
  return match ? match.slice(1).map(Number) : null;
}

export function isNewerVersion(candidate, current) {
  const next = parseVersion(candidate);
  const base = parseVersion(current);
  if (!next || !base) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== base[index]) {
      return next[index] > base[index];
    }
  }
  return false;
}

async function fetchLatestVersion(registryUrl) {
  const response = await fetch(`${registryUrl.replace(/\/+$/u, "")}/epic-loop/latest`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`registry responded ${response.status}`);
  }

  const body = await response.json();
  if (typeof body?.version !== "string") {
    throw new Error("registry response has no version");
  }
  return body.version;
}

// Looks up the latest published version at most once per day per project. Never
// throws: an offline or failing registry yields `checked: false`.
export async function checkLatestVersion(root, env = process.env) {
  if (env.EPIC_LOOP_NO_UPDATE_CHECK === "1") {
    return { checked: false, latest: null, reason: "disabled" };
  }

  const registry = env.EPIC_LOOP_REGISTRY_URL || DEFAULT_REGISTRY_URL;
  const cached = readCache(root);
  const cachedAt = Date.parse(cached?.checked_at ?? "");

  if (cached?.registry === registry && typeof cached.latest === "string" && Number.isFinite(cachedAt) && Date.now() - cachedAt < CHECK_TTL_MS) {
    return { checked: true, latest: cached.latest, reason: "cache" };
  }

  try {
    const latest = await fetchLatestVersion(registry);
    try {
      writeCache(root, { checked_at: new Date().toISOString(), latest, registry });
    } catch {
      // A read-only checkout must not turn an update check into a doctor failure.
    }
    return { checked: true, latest, reason: "registry" };
  } catch (error) {
    return { checked: false, latest: null, reason: `unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}
