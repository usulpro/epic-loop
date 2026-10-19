// Run by the session under test after it was woken: reads answers.json, writes the pickup marker,
// logs what the model saw, and prints the answers.
// Usage: node pickup.mjs [--dir D] --via <mechanism> --saw "<the doorbell text the model received>"
import { logEvent, parseArgs, paths, probeDir, readJson, writeJsonAtomic } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const p = paths(dir);
const answers = readJson(p.answers);
if (!answers) {
  logEvent(dir, "pickup-empty", { via: flags.via ?? null, saw: flags.saw ?? null });
  console.log("No answers.json yet.");
  process.exit(0);
}
const pickedAt = new Date().toISOString();
writeJsonAtomic(p.pickup, { pickedAt, answersId: answers.id, answersSubmittedAt: answers.submittedAt, via: flags.via ?? null });
logEvent(dir, "pickup", {
  via: flags.via ?? null,
  saw: typeof flags.saw === "string" ? flags.saw.slice(0, 500) : null,
  answersId: answers.id,
  submittedAt: answers.submittedAt,
  latencyMs: Date.parse(pickedAt) - Date.parse(answers.submittedAt),
});
console.log(JSON.stringify(answers, null, 2));
