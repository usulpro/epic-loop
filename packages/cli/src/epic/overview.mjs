import fs from "node:fs";
import path from "node:path";

import { parseAgentDecisions, parseHumanQueue, parseTracker, readIntent, readStateLine } from "./parsers.mjs";

// The model of the epic home (Phase 5 of the visual-review epic): where the epic stands and what
// waits for the human, read from the epic's files on every request. Missing or malformed files
// leave their part empty; nothing here throws for a half-written epic.
const HOLD_ORDER = ["security-hold", "human-action", "costly-decision", "product-decision", "checkpoint"];

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function loopState(runtime) {
  const loop = runtime?.implementation_loop && typeof runtime.implementation_loop === "object" ? runtime.implementation_loop : null;
  const status = loop?.status ?? null;
  const label = !loop
    ? "no loop"
    : status === "running"
      ? "running"
      : status === "awaiting-review"
        ? "waiting for the human"
        : status === "idle" || status === "interrupted"
          ? "stopped"
          : (status ?? "no loop");
  const openTurn = Boolean(loop?.current_role && loop.active_turn_started_at && !loop.active_turn_stopped_at && status === "running");
  return {
    iteration: Number.isFinite(loop?.iteration) ? loop.iteration : null,
    label,
    role: openTurn ? loop.current_role : null,
    status,
    turnStartedAt: openTurn ? loop.active_turn_started_at : null,
  };
}

export function buildOverview(epicDir, { gates = [] } = {}) {
  const runtime = readJson(path.join(epicDir, ".runtime", "runtime-state.json")) ?? {};
  const tracker = parseTracker(readText(path.join(epicDir, "tracker.md")));
  const state = readText(path.join(epicDir, "state-of-epic.md"));
  const queue = parseHumanQueue(readText(path.join(epicDir, "human-queue.md")));
  const decisions = parseAgentDecisions(readText(path.join(epicDir, "decision-log.md"))).filter((decision) => decision.state === "unconfirmed");
  const tasks = [...tracker.phases.flatMap((phase) => phase.tasks), ...tracker.follow_ups];

  const reviewFor = (id) => gates.find((gate) => (gate.covers ?? []).includes(id))?.review ?? null;
  const openItems = queue
    .filter((item) => item.status === "open")
    .map((item) => ({
      ask: item.ask ?? "",
      blocks: item.blocks ?? "",
      id: item.id,
      kind: item.kind ?? "human-action",
      review: reviewFor(item.id),
      tasks: tasks.filter((task) => task.hold?.item === item.id).map((task) => ({ tid: task.tid, title: task.title })),
    }));
  const holdKinds = [...new Set(openItems.map((item) => item.kind).filter((kind) => kind !== "external-wait"))].sort(
    (left, right) => (HOLD_ORDER.indexOf(left) + 1 || 99) - (HOLD_ORDER.indexOf(right) + 1 || 99),
  );

  return {
    activePhase: readStateLine(state, "Active phase"),
    activeTask: readStateLine(state, "Active task"),
    decisions,
    external: openItems.filter((item) => item.kind === "external-wait"),
    followUps: tracker.follow_ups,
    holds: holdKinds.map((kind) => ({ items: openItems.filter((item) => item.kind === kind), kind })),
    intent: readIntent(readText(path.join(epicDir, "docs", "problem-framing.md"))),
    loop: loopState(runtime),
    mode: runtime.mode ?? readStateLine(state, "Mode") ?? null,
    phases: tracker.phases.map((phase) => {
      const done = phase.tasks.filter((task) => task.status === "done").length + phase.archived;
      return { ...phase, done, total: phase.tasks.length + phase.archived };
    }),
    title: readStateLine(state, "Epic") ?? tracker.title,
  };
}
