// UserPromptSubmit fallback hook (Claude Code and Codex): on any user prompt, when answers are pending,
// inject the pointer as additional context. Always exits 0 and never blocks the prompt.
// Usage (hook command): node fallback-hook.mjs [--dir D]
import { hookFields, logEvent, parseArgs, pendingAnswers, pointer, probeDir, readStdinJson } from "./lib.mjs";

const dir = probeDir(parseArgs(process.argv.slice(2)));
const payload = await readStdinJson();
const answers = pendingAnswers(dir);
logEvent(dir, "hook-fire", { mechanism: "userpromptsubmit-fallback", injected: Boolean(answers), ...hookFields(payload) });
if (answers) {
  const additionalContext = pointer(dir, answers);
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } })}\n`);
}
