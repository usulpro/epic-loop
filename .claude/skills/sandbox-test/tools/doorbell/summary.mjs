// Prints ring -> wake -> pickup latencies from a probe log, one block per submitted answer.
// "wake" is the waiter signal (waiter-fired) when there is one; "first hook" is the first hook event of the
// session after the ring (the earliest sign that a new turn started).
// Usage: node summary.mjs [--dir D] [--json]
import fs from "node:fs";
import { parseArgs, paths, probeDir } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const lines = fs
  .readFileSync(paths(dir).log, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const t = (e) => (e ? Date.parse(e.at) : null);
const ms = (a, b) => (a != null && b != null ? `${b - a} ms` : "-");

const rows = [];
for (const submit of lines.filter((e) => e.event === "submit")) {
  const after = lines.filter((e) => t(e) >= t(submit));
  const ring = after.find((e) => e.event === "ring");
  const ringDone = after.find((e) => e.event === "ring-done");
  const fired = after.find((e) => e.event === "waiter-fired" && e.answersId === submit.answersId);
  const firstHook = after.find((e) => e.event === "hook-event" || (e.event === "hook-fire" && e.mechanism === "userpromptsubmit-fallback"));
  const pickup = after.find((e) => e.event === "pickup" && e.answersId === submit.answersId);
  rows.push({
    answersId: submit.answersId,
    submittedAt: submit.at,
    mechanism: fired?.mechanism ?? ring?.mechanism ?? null,
    ringMs: ms(t(submit), t(ring)),
    ringCommandMs: ringDone ? `${ringDone.ms} ms (exit ${ringDone.exitCode})` : "-",
    waiterFiredMs: ms(t(submit), t(fired)),
    firstHookMs: firstHook ? `${ms(t(submit), t(firstHook))} (${firstHook.hookEvent ?? firstHook.event})` : "-",
    pickupMs: ms(t(submit), t(pickup)),
    pickupVia: pickup?.via ?? null,
    saw: pickup?.saw ?? null,
  });
}

if (flags.json) console.log(JSON.stringify(rows, null, 2));
else
  for (const row of rows) {
    console.log(`answers ${row.answersId} submitted ${row.submittedAt} (mechanism: ${row.mechanism})`);
    console.log(`  submit -> ring:          ${row.ringMs}; ring command: ${row.ringCommandMs}`);
    console.log(`  submit -> waiter fired:  ${row.waiterFiredMs}`);
    console.log(`  submit -> first hook:    ${row.firstHookMs}`);
    console.log(`  submit -> pickup:        ${row.pickupMs} (via ${row.pickupVia})`);
    console.log(`  model saw: ${row.saw ?? "-"}`);
  }
if (rows.length === 0) console.log("no submits in the probe log");
