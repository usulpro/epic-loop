import fs from "node:fs";
import path from "node:path";

// The human-facing files of an epic that the docs browser serves (Phase 5 Task 4): the top-level
// markdown artifacts (state, tracker and archive layers, logs, registers, queue), `docs/**` and
// `stop-reports/**`. Hidden paths (`.runtime/`) and `reviews/` are never served.

// `relative` uses "/" separators and is relative to the epic directory.
export function isServableDoc(relative) {
  const parts = String(relative ?? "").split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return false;
  if (parts.length === 1) return parts[0].endsWith(".md");
  return parts[0] === "docs" || parts[0] === "stop-reports";
}

export const isMarkdown = (relative) => relative.toLowerCase().endsWith(".md");

// Resolves a docs URL path to a real file inside the epic, or null: no "..", no absolute or
// encoded escapes, no symlink that leaves the epic, and only servable files.
export function resolveEpicDoc(epicDir, relative) {
  const parts = String(relative ?? "")
    .split("/")
    .filter((part) => part !== "");
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("\0") || part.includes("\\"))) return null;
  let real;
  let realBase;
  try {
    real = fs.realpathSync(path.join(epicDir, ...parts));
    realBase = fs.realpathSync(epicDir);
  } catch {
    return null;
  }
  const inside = path.relative(realBase, real);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return null;
  const rel = inside.split(path.sep).join("/");
  if (!isServableDoc(rel) || !isServableDoc(parts.join("/"))) return null;
  try {
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  return { file: real, relative: parts.join("/") };
}

function walk(dir, base) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (entry.isDirectory()) return walk(full, base);
    return entry.isFile() && isMarkdown(rel) && isServableDoc(rel) ? [rel] : [];
  });
}

const ARTIFACT_ORDER = ["state-of-epic.md", "tracker.md", "human-queue.md", "decision-log.md", "risk-register.md", "implementation-log.md"];

// The epic's markdown files, grouped for the home's Docs section.
export function listEpicDocs(epicDir) {
  const top = walk(epicDir, epicDir).filter((rel) => !rel.includes("/"));
  const rank = (rel) => (ARTIFACT_ORDER.includes(rel) ? ARTIFACT_ORDER.indexOf(rel) : ARTIFACT_ORDER.length);
  return {
    artifacts: top.toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
    docs: walk(path.join(epicDir, "docs"), epicDir).toSorted(),
    stopReports: walk(path.join(epicDir, "stop-reports"), epicDir).toSorted(),
  };
}
