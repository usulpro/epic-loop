// Passive hook logger: records every hook event around a ring (SessionStart, UserPromptSubmit, Stop,
// PreToolUse) with its session id and turn id. Prints nothing and exits 0, so it never changes the session.
// Usage (hook command): node log-hook.mjs [--dir D]
import { hookFields, logEvent, parseArgs, probeDir, readStdinJson } from "./lib.mjs";

const dir = probeDir(parseArgs(process.argv.slice(2)));
const payload = await readStdinJson();
logEvent(dir, "hook-event", hookFields(payload));
