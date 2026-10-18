import fs from "node:fs";
import path from "node:path";

import { epicRoot, nowIso, readJson, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";
import { hasOpenTurn, mergeEpicStateIntoRuntime, normalizeObject } from "./loop.mjs";
import { missingStopReportHeadings, saveStopReport } from "./stop-reports.mjs";

// Stop classes (decision D16 of the visual-review epic):
// A done, B needs the human's hands or authority, C decision with a reasonable default,
// D environment friction, E ordering or bookkeeping, F product decision with no default.
export const STOP_CLASSES = ["A", "B", "C", "D", "E", "F"];
const REVIEW_OUTCOMES = ["accepted", "challenged"];

// The techlead never ends the loop itself: it files a stop request and the next role is a
// manager stop review, which either accepts the stop (loop idle) or challenges it.
export function requestStop(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const stopClass = requireFlag(flags, "class").trim().toUpperCase();
  const reason = requireFlag(flags, "reason").trim();
  const blocks = requireFlag(flags, "blocks").trim();

  if (!STOP_CLASSES.includes(stopClass)) {
    throw new Error(`Invalid --class "${flags.class}". Expected one of: ${STOP_CLASSES.join(", ")}.`);
  }

  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = mergeEpicStateIntoRuntime(root, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (!hasOpenTurn(loop) || loop.current_role !== "techlead") {
    throw new Error("request-stop runs only inside an open techlead turn.");
  }

  const round = (Number.isFinite(loop.stop_rounds) ? loop.stop_rounds : 0) + 1;
  const stopRequest = { blocks, class: stopClass, reason, requested_at: timestamp, requested_iteration: loop.iteration, round };

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      last_reason: `stop-request:${stopClass}`,
      last_transition_at: timestamp,
      last_transition_by: "request-stop",
      next_role: "manager",
      // Filing the request completes the techlead turn, like set-next-role.
      next_role_set_iteration: loop.iteration,
      prompt_file: null,
      stop_request: stopRequest,
      stop_rounds: round,
    },
    implementation_submode: "manager",
    updated_at: timestamp,
  });

  appendLoopLog(root, {
    action: "role-command",
    blocks,
    class: stopClass,
    command: "request-stop",
    current_iteration: loop.iteration,
    current_role: loop.current_role,
    next_role: "manager",
    phase: runtime.active_phase ?? null,
    reason,
    round,
    slug,
    task: runtime.active_task ?? null,
    timestamp,
  });

  console.log(`Stop request (class ${stopClass}, round ${round}) filed for ${slug}. Next implementation role: manager (stop review).`);
}

// The manager resolves the stop request it was routed to review.
export function reviewStop(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const outcome = requireFlag(flags, "outcome").trim();
  const instruction = typeof flags.instruction === "string" && flags.instruction.trim() ? flags.instruction.trim() : null;

  if (!REVIEW_OUTCOMES.includes(outcome)) {
    throw new Error(`Invalid --outcome "${outcome}". Expected one of: ${REVIEW_OUTCOMES.join(", ")}.`);
  }

  if (outcome === "challenged" && !instruction) {
    throw new Error("Missing required --instruction for --outcome challenged.");
  }

  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = mergeEpicStateIntoRuntime(root, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (!isStopReviewTurn(loop)) {
    throw new Error("review-stop runs only inside a manager stop-review turn.");
  }

  const request = loop.stop_request;
  const accepted = outcome === "accepted";
  const nextRole = accepted ? "idle" : "techlead";
  // Accepting requires the English stop report; it is checked before anything changes.
  const reportBody = accepted ? readStopReport(flags) : null;
  const reportPath = accepted ? saveStopReport(root, slug, { body: reportBody, reason: request.reason, stopClass: request.class }) : null;

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      last_reason: `stop-review:${outcome}:${request.class}`,
      last_transition_at: timestamp,
      last_transition_by: "review-stop",
      next_role: nextRole,
      next_role_set_iteration: loop.iteration,
      status: accepted ? "idle" : "running",
      ...(accepted ? { last_stop_report_path: reportPath, stop_report_copy_iteration: loop.iteration } : {}),
      stop_challenge: accepted ? null : { blocks: request.blocks, class: request.class, instruction, reason: request.reason, round: request.round },
      stop_request: null,
      stop_review_iteration: null,
    },
    implementation_submode: accepted ? "manager" : "techlead",
    updated_at: timestamp,
  });

  appendLoopLog(root, {
    action: "stop-gate",
    blocks: request.blocks,
    class: request.class,
    instruction,
    iteration: loop.iteration,
    outcome,
    reason: request.reason,
    ...(reportPath ? { report_path: reportPath } : {}),
    round: request.round,
    slug,
    timestamp,
  });

  if (!accepted) {
    console.log(`Stop challenged for ${slug} (class ${request.class}). The techlead resumes with your instruction.`);
    return;
  }

  console.log(`Stop accepted for ${slug} (class ${request.class}). Report saved: ${reportPath}`);
  console.log("Commit the report with this review's queue and decision changes (only these files):");
  for (const line of stopReportCommitCommand(root, slug, reportPath, request.class)) {
    console.log(`  ${line}`);
  }
  console.log("The loop goes idle; end the turn with the same report in the user's language.");
}

// D32: the manager commits each accepted stop's report with that review's artifact changes.
function stopReportCommitCommand(root, slug, reportPath, stopClass) {
  const epicDir = path.relative(root, epicRoot(root, slug));
  const files = [reportPath, ...["human-queue.md", "decision-log.md"].map((name) => path.join(epicDir, name)).filter((file) => fs.existsSync(path.join(root, file)))];
  const number = path.basename(reportPath).split("-")[0];
  return [`git add ${files.map(shellQuote).join(" ")}`, `git commit -m "docs(epic): stop report ${number} (class ${stopClass})"`];
}

function shellQuote(value) {
  return /^[\w./-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

function readStopReport(flags) {
  if (!flags.stdin) {
    throw new Error("--outcome accepted requires the English stop report on stdin (--stdin).");
  }
  const body = fs.readFileSync(0, "utf8");
  if (!body.trim()) {
    throw new Error("The stop report is empty.");
  }
  const missing = missingStopReportHeadings(body);
  if (missing.length > 0) {
    throw new Error(`The stop report is missing headings: ${missing.join(", ")}.`);
  }
  return body;
}

export function isStopReviewTurn(loop) {
  return hasOpenTurn(loop) && loop.current_role === "manager" && Boolean(loop.stop_request) && loop.stop_review_iteration === loop.iteration;
}
