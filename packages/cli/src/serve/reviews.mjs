import fs from "node:fs";
import path from "node:path";

import { listEpics } from "../epics.mjs";
import { readAnswers } from "./answers.mjs";

// Slugs and review ids are folder names; only plain names are routable.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function isName(value) {
  return typeof value === "string" && NAME.test(value) && !value.includes("..");
}

export function epicDir(root, slug) {
  return path.join(root, ".epic-loop", "epics", slug);
}

export function reviewDir(root, slug, id) {
  return path.join(epicDir(root, slug), "reviews", id);
}

export function epicExists(root, slug) {
  return isName(slug) && fs.existsSync(path.join(epicDir(root, slug), "state-of-epic.md"));
}

export function reviewExists(root, slug, id) {
  return epicExists(root, slug) && isName(id) && fs.existsSync(path.join(reviewDir(root, slug, id), "page.html"));
}

function readTitle(dir, id) {
  try {
    const review = JSON.parse(fs.readFileSync(path.join(dir, "review.json"), "utf8"));
    if (review.title) return String(review.title);
  } catch {}
  try {
    const match = fs.readFileSync(path.join(dir, "page.html"), "utf8").match(/<title>([^<]*)<\/title>/iu);
    if (match?.[1]?.trim()) return match[1].trim();
  } catch {}
  return id;
}

export function listReviews(root, slug) {
  const dir = path.join(epicDir(root, slug), "reviews");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isName(entry.name) && fs.existsSync(path.join(dir, entry.name, "page.html")))
    .map((entry) => {
      const reviewPath = path.join(dir, entry.name);
      const answers = readAnswers(reviewPath);
      return {
        id: entry.name,
        title: readTitle(reviewPath, entry.name),
        submittedAt: answers.submittedAt ?? null,
        savedAt: answers.savedAt ?? null,
        created: fs.statSync(path.join(reviewPath, "page.html")).mtime.toISOString(),
      };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

// Open gates from the loop state the skill keeps in .runtime/runtime-state.json
// (implementation_loop.gates). A missing or malformed state means no gates.
const OPEN_GATE_STATUSES = ["open", "submitted", "ingested"];

export function listOpenGates(root, slug) {
  try {
    const runtime = JSON.parse(fs.readFileSync(path.join(epicDir(root, slug), ".runtime", "runtime-state.json"), "utf8"));
    const gates = runtime?.implementation_loop?.gates;
    if (!Array.isArray(gates)) return [];
    return gates
      .filter((gate) => gate && typeof gate === "object" && isName(gate.review) && OPEN_GATE_STATUSES.includes(gate.status))
      .map((gate) => ({ review: gate.review, blocking: gate.blocking === true, kind: gate.kind === "stop-report" ? "stop-report" : null, status: gate.status }));
  } catch {
    return [];
  }
}

export function listEpicsWithReviews(root) {
  return listEpics(root).map((epic) => {
    const reviews = listReviews(root, epic.slug);
    return { ...epic, reviews, pending: reviews.filter((review) => !review.submittedAt).length };
  });
}
