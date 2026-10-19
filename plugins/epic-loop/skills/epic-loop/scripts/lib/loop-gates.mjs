import fs from "node:fs";
import path from "node:path";

import { epicRoot, nowIso, readJson, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import { readHumanQueue } from "./human-queue.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";
import { hasOpenTurn, mergeEpicStateIntoRuntime, normalizeObject } from "./loop.mjs";

// Human gates (Phase 4 of the visual-review epic, docs/human-gates.md). A gate is a checked
// review page the human answers. Only a manager turn opens one (D1). A blocking gate ends the
// manager's turn with the loop in `awaiting-review`; a non-blocking one leaves the loop running.
// Gates live in `implementation_loop.gates`:
//   { review, covers: ["H3"], blocking, status: open|submitted|ingested|closed, opened_at,
//     opened_iteration, submitted_at?, ingested_at?, closed_at?, close_reason? }
export const AWAITING_REVIEW = "awaiting-review";
const OPEN_STATUSES = ["open", "submitted", "ingested"];

export function gateCommand(flags = {}, positionals = []) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const command = positionals[0];

  if (command === "open") return openGate(root, slug, flags);
  if (command === "ingested") return markIngested(root, slug, flags);
  if (command === "close") return closeGate(root, slug, flags);
  if (command === "list") return listGates(root, slug, flags);
  throw new Error(`Unknown gate command "${command ?? ""}". Expected one of: open, ingested, close, list.`);
}

export function readGates(loop) {
  return Array.isArray(loop?.gates) ? loop.gates.filter((gate) => gate && typeof gate === "object" && typeof gate.review === "string") : [];
}

export function openGates(loop) {
  return readGates(loop).filter((gate) => OPEN_STATUSES.includes(gate.status));
}

export function reviewPath(slug, review) {
  return `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(review)}/`;
}

function openGate(root, slug, flags) {
  const review = requireReviewId(flags);
  const covers = parseCovers(flags.covers);
  const blocking = flags.blocking === true;
  const { loop, runtime, runtimePath } = readLoop(root, slug);
  requireManagerTurn(loop, "open");

  const reviewJson = readJson(path.join(epicRoot(root, slug), "reviews", review, "review.json"), null);
  if (!reviewJson || typeof reviewJson !== "object") {
    throw new Error(`No review "${review}" in .epic-loop/epics/${slug}/reviews/. Have the page builder write it and pass review check first.`);
  }
  if (!reviewJson.schema || typeof reviewJson.schema !== "object") {
    throw new Error(`Review "${review}" has no answer schema yet. Run: epic-loop review check ${slug}/${review}`);
  }

  const openItems = new Set(
    readHumanQueue(root, slug)
      .filter((item) => item.status === "open")
      .map((item) => item.id),
  );
  const unknown = covers.filter((id) => !openItems.has(id));
  if (unknown.length > 0) {
    throw new Error(`--covers names ${unknown.join(", ")}, which ${unknown.length === 1 ? "is not an open item" : "are not open items"} in human-queue.md.`);
  }

  const timestamp = nowIso();
  const previous = readGates(loop).find((item) => item.review === review);
  // Reopening keeps the last submittedAt seen, so the same answers are not reported twice.
  const gate = {
    blocking,
    covers,
    opened_at: timestamp,
    opened_iteration: loop.iteration,
    review,
    status: "open",
    ...(previous?.submitted_at ? { submitted_at: previous.submitted_at } : {}),
  };
  const others = readGates(loop).filter((item) => item.review !== review);
  writeLoop(runtimePath, runtime, { ...loop, gates: [...others, gate] }, timestamp);
  logGate(root, slug, loop, "gate-opened", timestamp, { blocking, covers, review });
  console.log(`Opened ${blocking ? "a blocking" : "a non-blocking"} gate for review ${review}: ${reviewPath(slug, review)}`);
  if (blocking) console.log("The loop waits in awaiting-review when this manager turn ends.");
}

function markIngested(root, slug, flags) {
  const review = requireReviewId(flags);
  const { loop, runtime, runtimePath } = readLoop(root, slug);
  requireManagerTurn(loop, "ingested");
  const gate = requireOpenGate(loop, review);
  // The ingest turn's Stop already marked these answers: do not log them twice.
  if (gate.status === "ingested" && gate.ingested_submitted_at && gate.ingested_submitted_at === (gate.submitted_at ?? gate.ingested_submitted_at)) {
    console.log(`The answers of review ${review} are already ingested.`);
    return;
  }
  const timestamp = nowIso();
  replaceGate(runtimePath, runtime, loop, { ...gate, ingested_at: timestamp, ingested_submitted_at: gate.submitted_at ?? null, status: "ingested" }, timestamp);
  logGate(root, slug, loop, "gate-ingested", timestamp, { review, submitted_at: gate.submitted_at ?? null });
  console.log(`Marked the answers of review ${review} ingested.`);
}

function closeGate(root, slug, flags) {
  const review = requireReviewId(flags);
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : null;
  const { loop, runtime, runtimePath } = readLoop(root, slug);
  requireManagerTurn(loop, "close");
  const gate = requireOpenGate(loop, review);
  const timestamp = nowIso();
  replaceGate(runtimePath, runtime, loop, { ...gate, close_reason: reason, closed_at: timestamp, status: "closed" }, timestamp);
  logGate(root, slug, loop, "gate-closed", timestamp, { reason, review });
  console.log(`Closed the gate for review ${review}.`);
}

function listGates(root, slug, flags) {
  const { loop } = readLoop(root, slug);
  const gates = flags.all ? readGates(loop) : openGates(loop);
  if (flags.json) {
    console.log(JSON.stringify({ gates: gates.map((gate) => ({ ...gate, path: reviewPath(slug, gate.review) })), status: loop.status ?? null }, null, 2));
    return;
  }
  if (gates.length === 0) {
    console.log(flags.all ? "No gates." : "No open gates.");
    return;
  }
  for (const gate of gates) console.log(describeGate(slug, gate));
}

export function describeGate(slug, gate) {
  const covers = gate.covers?.length ? `covers ${gate.covers.join(", ")}` : "covers no H item";
  return `${gate.review} [${gate.status}] ${gate.blocking ? "blocking" : "non-blocking"}, ${covers}: ${reviewPath(slug, gate.review)}`;
}

// Stop path: a manager turn that opened a blocking gate (still unanswered) ends here, with no
// continuation. Returns true when the loop now awaits the review.
export function awaitReviewIfBlocked(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (loop.current_role !== "manager" || !loop.active_turn_stopped_at) return false;
  const waiting = readGates(loop).filter((gate) => gate.blocking && gate.status === "open" && gate.opened_iteration === loop.iteration);
  if (waiting.length === 0) return false;

  const reviews = waiting.map((gate) => gate.review);
  writeJson(runtimeStatePath(projectRoot, slug), {
    ...runtime,
    implementation_loop: { ...loop, last_reason: `awaiting-review:${reviews.join(",")}`, last_transition_at: timestamp, last_transition_by: "gate", status: AWAITING_REVIEW },
    updated_at: timestamp,
  });
  appendLoopLog(projectRoot, {
    action: "awaiting-review",
    iteration: loop.iteration,
    next_role: loop.next_role ?? null,
    reviews,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
  });
  return true;
}

// Any hook event of the bound driver session: log `answers-submitted` once per submittedAt of
// an open gate's review. Nothing is routed yet.
export function recordSubmittedGateAnswers(projectRoot, payload, binding) {
  const slug = binding?.epic_slug;
  if (!slug) return;
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);
  if (runtime.mode !== "implementation" || loop.driver_session_id !== payload.session_id) return;

  const timestamp = nowIso();
  const seen = [];
  const gates = readGates(loop).map((gate) => {
    if (!OPEN_STATUSES.includes(gate.status)) return gate;
    const submittedAt = readSubmittedAt(projectRoot, slug, gate.review);
    if (!submittedAt || submittedAt === gate.submitted_at) return gate;
    seen.push({ review: gate.review, submittedAt });
    return { ...gate, status: "submitted", submitted_at: submittedAt };
  });
  if (seen.length === 0) return;

  writeJson(runtimePath, { ...runtime, implementation_loop: { ...loop, gates }, updated_at: timestamp });
  for (const { review, submittedAt } of seen) {
    appendLoopLog(projectRoot, {
      action: "answers-submitted",
      event: payload.hook_event_name ?? null,
      review,
      session_id: payload.session_id ?? null,
      slug,
      submitted_at: submittedAt,
      timestamp,
    });
  }
}

function readSubmittedAt(projectRoot, slug, review) {
  const answers = readJson(path.join(epicRoot(projectRoot, slug), "reviews", review, "answers.json"), null);
  return answers && typeof answers.submittedAt === "string" && answers.submittedAt ? answers.submittedAt : null;
}

function readLoop(root, slug) {
  const runtimePath = runtimeStatePath(root, slug);
  if (!fs.existsSync(epicRoot(root, slug))) throw new Error(`No epic "${slug}" in this project.`);
  const runtime = mergeEpicStateIntoRuntime(root, slug, normalizeObject(readJson(runtimePath, {})));
  return { loop: normalizeObject(runtime.implementation_loop), runtime, runtimePath };
}

function requireManagerTurn(loop, command) {
  if (!hasOpenTurn(loop) || loop.current_role !== "manager") {
    throw new Error(`gate ${command} runs only inside an open manager turn: only the manager opens and settles gates (D1).`);
  }
}

function requireReviewId(flags) {
  const review = requireFlag(flags, "review").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(review)) throw new Error(`Invalid --review "${review}": use the review id (lowercase letters, digits and hyphens).`);
  return review;
}

function requireOpenGate(loop, review) {
  const gate = openGates(loop).find((item) => item.review === review);
  if (!gate) throw new Error(`There is no open gate for review "${review}".`);
  return gate;
}

function parseCovers(value) {
  if (value === undefined || value === true) return [];
  const ids = String(value)
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
  const invalid = ids.filter((id) => !/^H\d+$/u.test(id));
  if (invalid.length > 0) throw new Error(`Invalid --covers ${invalid.join(", ")}: expected human-queue ids like H3.`);
  return [...new Set(ids)];
}

function replaceGate(runtimePath, runtime, loop, gate, timestamp) {
  writeLoop(runtimePath, runtime, { ...loop, gates: readGates(loop).map((item) => (item.review === gate.review ? gate : item)) }, timestamp);
}

function writeLoop(runtimePath, runtime, loop, timestamp) {
  writeJson(runtimePath, { ...runtime, implementation_loop: loop, updated_at: timestamp });
}

function logGate(root, slug, loop, action, timestamp, fields) {
  appendLoopLog(root, { action, iteration: loop.iteration ?? null, role: loop.current_role ?? null, slug, timestamp, ...fields });
}
