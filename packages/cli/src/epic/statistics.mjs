import fs from "node:fs";
import path from "node:path";

// Turn statistics for the epic home, from `.runtime/progress-log.jsonl`.
// Deliberate duplicate of the aggregation in the skill's
//   plugins/epic-loop/skills/epic-loop/scripts/lib/loop-artifacts.mjs (rebuildProgressReport,
//   groupDurations, groupNestedDurations, collectOpenTurns, formatDuration)
// so the home shows the same numbers as `.runtime/progress-report.md` for the same log. The CLI
// cannot import the skill at runtime. Keep both in step; remove once the skill scripts migrate here.
// The waits (background, awaiting a review) are extra to the report.
const ENDED_TURN_ACTIONS = ["turn-stop", "turn-interrupted", "turn-aborted"];
// Events that end a wait for the human: the loop runs a turn again, or it stops.
const REVIEW_WAIT_ENDS = ["turn-start", "loop-start", "loop-stopped"];

function readJsonLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return text
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const sum = (values) => values.reduce((acc, value) => acc + value, 0);
const turnKey = (event) => `${event.iteration ?? "?"}:${event.role ?? "unknown"}`;
const byTime = (a, b) => String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""));

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (restSeconds > 0 || parts.length === 0) parts.push(`${restSeconds}s`);
  return parts.join(" ");
}

function groupDurations(events, keyFn) {
  const groups = {};
  for (const event of events) {
    const key = keyFn(event);
    const current = groups[key] ?? { durationMs: 0, turns: 0 };
    current.durationMs += Number(event.duration_ms) || 0;
    current.turns += 1;
    groups[key] = current;
  }
  return groups;
}

function groupNestedDurations(events) {
  const groups = {};
  for (const event of events) {
    const phase = event.phase || "Unassigned phase";
    const task = event.task || "Unassigned task";
    const durationMs = Number(event.duration_ms) || 0;
    const phaseData = groups[phase] ?? { durationMs: 0, tasks: {}, turns: 0 };
    const taskData = phaseData.tasks[task] ?? { durationMs: 0, turns: 0 };
    phaseData.durationMs += durationMs;
    phaseData.turns += 1;
    taskData.durationMs += durationMs;
    taskData.turns += 1;
    phaseData.tasks[task] = taskData;
    groups[phase] = phaseData;
  }
  return groups;
}

function collectOpenTurns(events) {
  const starts = events.filter((event) => event.action === "turn-start");
  const endedKeys = new Set(events.filter((event) => ENDED_TURN_ACTIONS.includes(event.action)).map(turnKey));
  return starts.filter((event) => !endedKeys.has(turnKey(event)));
}

// Each wait runs from its event to the first later event that ends it; an open wait runs until `now`.
function measureWaits(events, startAction, isEnd, now) {
  const waits = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.action === startAction)
    .map(({ event, index }) => {
      const end = events.slice(index + 1).find((next) => isEnd(next, event));
      const endMs = end ? Date.parse(end.timestamp ?? "") : now;
      const startMs = Date.parse(event.timestamp ?? "");
      return { durationMs: Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0, open: !end };
    });
  return { count: waits.length, durationMs: sum(waits.map((wait) => wait.durationMs)), open: waits.some((wait) => wait.open) };
}

export function buildStatistics(epicDir, { now = Date.now() } = {}) {
  const runtimeDir = path.join(epicDir, ".runtime");
  const events = readJsonLines(path.join(runtimeDir, "progress-log.jsonl"));
  const timestamps = events
    .map((event) => event.timestamp)
    .filter(Boolean)
    .sort();
  const completedTurns = events.filter((event) => event.action === "turn-stop");
  const interruptedTurns = events.filter((event) => event.action === "turn-interrupted");
  const abortedTurns = events.filter((event) => event.action === "turn-aborted");
  const endedTurns = [...completedTurns, ...interruptedTurns, ...abortedTurns].sort(byTime);
  const activeMs = sum(endedTurns.map((event) => Number(event.duration_ms) || 0));
  const first = timestamps[0] ?? null;
  const last = timestamps.at(-1) ?? null;
  const elapsedMs = first && last ? Math.max(0, Date.parse(last) - Date.parse(first)) : 0;
  const byRole = Object.entries(groupDurations(endedTurns, (event) => event.role ?? "unknown")).map(([role, item]) => ({
    averageMs: item.turns ? item.durationMs / item.turns : 0,
    durationMs: item.durationMs,
    role,
    turns: item.turns,
  }));
  const phases = Object.entries(groupNestedDurations(endedTurns)).map(([phase, data]) => ({
    durationMs: data.durationMs,
    phase,
    tasks: Object.entries(data.tasks).map(([task, item]) => ({ durationMs: item.durationMs, task, turns: item.turns })),
    turns: data.turns,
  }));
  const ordered = events.toSorted(byTime);
  return {
    abortedTurns: abortedTurns.length,
    activeMs,
    byRole,
    completedTurns: completedTurns.length,
    elapsedMs,
    firstEvent: first,
    idleMs: Math.max(0, elapsedMs - activeMs),
    interruptedTurns: interruptedTurns.length,
    lastEvent: last,
    openTurns: collectOpenTurns(events).length,
    phases,
    promptEntries: readJsonLines(path.join(runtimeDir, "prompt-log.jsonl")).length,
    turns: endedTurns.length,
    waits: {
      background: measureWaits(ordered, "turn-waiting-background", (next, start) => ENDED_TURN_ACTIONS.includes(next.action) && turnKey(next) === turnKey(start), now),
      review: measureWaits(ordered, "awaiting-review", (next) => REVIEW_WAIT_ENDS.includes(next.action), now),
    },
  };
}
