import fs from "node:fs";
import path from "node:path";

import { epicRoot, readJson, runtimeStatePath, writeJson } from "./common.mjs";
import { readHumanQueue } from "./human-queue.mjs";
import { appendLoopLog, executionDir } from "./loop-artifacts.mjs";
import { AWAITING_REVIEW, awaitReviewIfBlocked, readGates, reviewPath } from "./loop-gates.mjs";
import { SKILL_DIR, renderTemplate } from "./loop-prompts.mjs";

// Pickup of human input at role transitions (Phase 4 Task 2 of the visual-review epic, D22, D23).
// Pending input is a gate whose review has a submittedAt not yet ingested, or an inbox entry
// after `implementation_loop.inbox_through`. A manager ingest turn records it; the hook marks
// exactly the snapshot it was given (`implementation_loop.ingest`) when that turn stops, and the
// next techlead turn gets a one-time "Human Input Ingested" note (`implementation_loop.ingest_note`).
export const INGEST_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "assets", "templates", "implementation-manager-ingest-prompt.md");

export function readInboxEntries(projectRoot, slug) {
  let text;
  try {
    text = fs.readFileSync(path.join(epicRoot(projectRoot, slug), "inbox.jsonl"), "utf8");
  } catch {
    return [];
  }
  const entries = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.id === "string" && /^I\d+$/u.test(entry.id)) entries.push({ ...entry, number: Number(entry.id.slice(1)) });
    } catch {}
  }
  return entries.sort((left, right) => left.number - right.number);
}

function readSubmittedAt(projectRoot, slug, review) {
  const answers = readJson(path.join(epicRoot(projectRoot, slug), "reviews", review, "answers.json"), null);
  return answers && typeof answers.submittedAt === "string" && answers.submittedAt ? answers.submittedAt : null;
}

export function pendingHumanInput(projectRoot, slug, loop) {
  const gates = readGates(loop)
    .filter((gate) => gate.status !== "closed")
    .map((gate) => ({ gate, submittedAt: readSubmittedAt(projectRoot, slug, gate.review) }))
    .filter(({ gate, submittedAt }) => submittedAt && submittedAt !== gate.ingested_submitted_at)
    .map(({ gate, submittedAt }) => ({ covers: gate.covers ?? [], review: gate.review, submitted_at: submittedAt }));
  const through = Number.isFinite(loop.inbox_through) ? loop.inbox_through : 0;
  const inbox = readInboxEntries(projectRoot, slug).filter((entry) => entry.number > through);
  return { gates, inbox };
}

const hasInput = (pending) => pending.gates.length > 0 || pending.inbox.length > 0;

// Human gates on Stop: an ingest turn that stopped marks exactly what it was given as ingested;
// a manager turn that opened a blocking gate ends with the loop awaiting the review; a loop
// awaiting a review runs again once the human's input has arrived.
export function settleHumanGates(projectRoot, slug, runtime, loop, payload, timestamp) {
  ({ loop, runtime } = finishIngestIfStopped(projectRoot, slug, runtime, loop, timestamp));
  if (loop.status === "running" && awaitReviewIfBlocked(projectRoot, slug, runtime, loop, payload, timestamp)) {
    return { awaiting: true, loop, runtime };
  }
  return { awaiting: false, ...resumeAwaitingReviewIfInput(projectRoot, slug, runtime, loop, payload, timestamp) };
}

// Stop path: the loop awaits a review and the human answered (or wrote to the inbox): it runs
// again, and the pickup below starts the ingest turn.
export function resumeAwaitingReviewIfInput(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (loop.status !== AWAITING_REVIEW || !hasInput(pendingHumanInput(projectRoot, slug, loop))) return { loop, runtime };
  const nextLoop = { ...loop, last_reason: "human-input-arrived", last_transition_at: timestamp, last_transition_by: "pickup", next_role: "techlead", status: "running" };
  const nextRuntime = { ...runtime, implementation_loop: nextLoop, updated_at: timestamp };
  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  appendLoopLog(projectRoot, { action: "review-answered", iteration: loop.iteration ?? null, session_id: payload.session_id ?? null, slug, timestamp });
  return { loop: nextLoop, runtime: nextRuntime };
}

// Routing: the turn about to start (techlead or engineer) yields to a manager ingest turn when
// human input is pending. A stop review keeps its turn, and the turn right after an ingest is
// always the techlead's (D23: only the techlead plans).
export function planIngest(projectRoot, slug, loop, role) {
  if (!["techlead", "engineer"].includes(role) || loop.stop_request || loop.ingest_note) return null;
  const pending = pendingHumanInput(projectRoot, slug, loop);
  if (!hasInput(pending)) return null;
  return { ...pending, skipped_role: role };
}

export function ingestSnapshot(plan, iteration) {
  return {
    gates: plan.gates.map(({ review, submitted_at }) => ({ review, submitted_at })),
    inbox_ids: plan.inbox.map((entry) => entry.id),
    inbox_through: plan.inbox.length > 0 ? plan.inbox.at(-1).number : null,
    iteration,
    skipped_role: plan.skipped_role,
  };
}

export function logIngestStart(projectRoot, slug, plan, iteration, payload, timestamp) {
  appendLoopLog(projectRoot, {
    action: "ingest-start",
    inbox_ids: plan.inbox.map((entry) => entry.id),
    iteration,
    reviews: plan.gates.map((gate) => gate.review),
    session_id: payload.session_id ?? null,
    skipped_role: plan.skipped_role,
    slug,
    timestamp,
  });
}

// Stop path: the ingest turn ended. Mark exactly its snapshot ingested and leave the techlead
// its note. Input that arrived during the turn stays pending.
export function finishIngestIfStopped(projectRoot, slug, runtime, loop, timestamp) {
  const snapshot = loop.ingest;
  if (!snapshot || snapshot.iteration !== loop.iteration || loop.current_role !== "manager" || !loop.active_turn_stopped_at) return { loop, runtime };

  const marked = new Map(snapshot.gates.map((gate) => [gate.review, gate.submitted_at]));
  // A gate the manager already marked by hand (gate.mjs ingested) for the same answers is not logged twice.
  const alreadyMarked = new Set(
    readGates(loop)
      .filter((gate) => marked.has(gate.review) && gate.ingested_submitted_at === marked.get(gate.review))
      .map((gate) => gate.review),
  );
  const gates = readGates(loop).map((gate) =>
    marked.has(gate.review) && gate.status !== "closed"
      ? {
          ...gate,
          ingested_at: timestamp,
          ingested_submitted_at: marked.get(gate.review),
          status: gate.submitted_at && gate.submitted_at !== marked.get(gate.review) ? "submitted" : "ingested",
        }
      : gate,
  );
  const inboxThrough = Number.isFinite(snapshot.inbox_through) ? Math.max(snapshot.inbox_through, loop.inbox_through ?? 0) : (loop.inbox_through ?? 0);
  const inboxEntries = readInboxEntries(projectRoot, slug).filter((entry) => snapshot.inbox_ids.includes(entry.id));
  const nextLoop = {
    ...loop,
    gates,
    inbox_through: inboxThrough,
    ingest: null,
    ingest_note: {
      inbox: inboxEntries.map(({ createdAt, id, text }) => ({ createdAt, id, text })),
      iteration: loop.iteration,
      report: readManagerReport(projectRoot, slug, loop.iteration),
      reviews: snapshot.gates.map((gate) => gate.review),
      skipped_role: snapshot.skipped_role,
    },
  };
  const nextRuntime = { ...runtime, implementation_loop: nextLoop, updated_at: timestamp };
  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);

  for (const gate of snapshot.gates.filter((item) => !alreadyMarked.has(item.review))) {
    appendLoopLog(projectRoot, { action: "gate-ingested", by: "ingest-turn", iteration: loop.iteration, review: gate.review, slug, submitted_at: gate.submitted_at, timestamp });
  }
  if (snapshot.inbox_ids.length > 0) {
    appendLoopLog(projectRoot, { action: "inbox-ingested", ids: snapshot.inbox_ids, iteration: loop.iteration, slug, through: snapshot.inbox_through, timestamp });
  }
  return { loop: nextLoop, runtime: nextRuntime };
}

function readManagerReport(projectRoot, slug, iteration) {
  try {
    const lines = fs
      .readFileSync(path.join(executionDir(projectRoot, slug), "manager-reports.jsonl"), "utf8")
      .trim()
      .split("\n");
    const last = JSON.parse(lines.at(-1));
    return last.iteration === iteration && typeof last.message === "string" ? last.message.trim() : null;
  } catch {
    return null;
  }
}

const script = (name) => `node ${path.join(SKILL_DIR, "scripts", name)}`;

export function buildIngestPrompt(projectRoot, slug, iteration, plan) {
  return renderTemplate(fs.readFileSync(INGEST_PROMPT_TEMPLATE_PATH, "utf8"), {
    AgentDecision: `${script("agent-decision.mjs")} confirm --slug "${slug}" --id D<n> [--reversed "<what the human chose instead>"]`,
    EpicSlug: slug,
    GateClose: `${script("gate.mjs")} close --slug "${slug}" --review <review-id> --reason "<what was answered>"`,
    HumanQueueResolve: `${script("human-queue.mjs")} resolve --slug "${slug}" --id H<n> --resolution "<the answer>"`,
    IngestItems: formatIngestItems(projectRoot, slug, plan),
    Iteration: String(iteration),
    SkillDir: SKILL_DIR,
  });
}

function formatIngestItems(projectRoot, slug, plan) {
  const kinds = new Map(readHumanQueue(projectRoot, slug).map((item) => [item.id, `${item.kind}, ${item.status}`]));
  const lines = [];
  if (plan.gates.length > 0) {
    lines.push("### Answered review pages", "");
    for (const gate of plan.gates) {
      const dir = `.epic-loop/epics/${slug}/reviews/${gate.review}`;
      const schema = readJson(path.join(epicRoot(projectRoot, slug), "reviews", gate.review, "review.json"), {})?.schema;
      lines.push(`- \`${gate.review}\` (${reviewPath(slug, gate.review)}), submitted ${gate.submitted_at}`);
      lines.push(`  - Page: \`${dir}/page.html\`; answers: \`${dir}/answers.json\``);
      lines.push(`  - Covers: ${gate.covers.length ? gate.covers.map((id) => `${id} (${kinds.get(id) ?? "unknown"})`).join(", ") : "no human-queue item"}`);
      lines.push(`  - Controls: ${formatControls(schema)}`);
    }
    lines.push("");
  }
  if (plan.inbox.length > 0) {
    lines.push("### Inbox requests (verbatim)", "");
    for (const entry of plan.inbox) lines.push(`- ${entry.id}, sent ${entry.createdAt ?? "unknown"}:`, "", "````text", String(entry.text ?? ""), "````", "");
  }
  return lines.join("\n").trim();
}

function formatControls(schema) {
  const controls = Array.isArray(schema?.controls) ? schema.controls : [];
  if (controls.length === 0) return "none";
  return controls
    .map((control) => {
      const options = Array.isArray(control.options) ? `: ${control.options.map((option) => option.value).join(" | ")}` : "";
      const recommended = control.recommended ? `; recommended ${control.recommended}` : "";
      return `\`${control.name}\` (${control.kind}${options}${recommended}${control.optional ? ", optional" : ""}${control.card ? `, card ${control.card}` : ""})`;
    })
    .join(", ");
}

// The one-time section at the top of the techlead prompt after an ingest turn.
export function formatIngestNote(note) {
  const lines = ["## Human Input Ingested", ""];
  const sources = [
    note.reviews.length ? `review pages ${note.reviews.join(", ")}` : null,
    note.inbox.length ? `inbox ${note.inbox.map((entry) => entry.id).join(", ")}` : null,
  ].filter(Boolean);
  lines.push(`A manager ingest turn (turn ${note.iteration}) recorded the human's input before this turn: ${sources.join("; ") || "nothing new"}.`);
  if (note.skipped_role === "engineer") {
    lines.push(
      "",
      "The engineer turn you chose before this input arrived was not run. Re-decide with the input: hand the same brief over again, rewrite it, or plan the follow-ups first.",
    );
  }
  lines.push("", "Manager ingest report:", "", note.report ?? "(no report was captured)");
  if (note.inbox.length > 0) {
    lines.push("", "Inbox requests (verbatim):", "");
    for (const entry of note.inbox) lines.push(`- ${entry.id}:`, "", "````text", String(entry.text ?? ""), "````", "");
  }
  lines.push("", `Plan the follow-ups as "Human Input Ingested" in ${path.join(SKILL_DIR, "references", "implementation-techlead-role.md")} describes.`);
  return lines.join("\n");
}
