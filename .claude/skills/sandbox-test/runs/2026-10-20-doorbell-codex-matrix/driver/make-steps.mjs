// Emits ptydrive steps for one Codex matrix cell. Usage: node make-steps.mjs <cell> [phase] (env: PLOG, NODE, KIT, DIR)
// Cells: QB mid-turn, QD after Esc, QE 15 min idle, QF closed + resume (phase 1|2), QR idle via a remote app server, FA fallback only.
// The prompt is passed on the codex command line, so there is no initial typing step.
const [cell, phase = "1"] = process.argv.slice(2);
const { PLOG, NODE, KIT, DIR, IDLE_SECONDS = "900" } = process.env;
const onLog = (pattern, timeout) => ({ expect_file: PLOG, pattern, timeout });
const nth = (pattern, n) => `(?s)${Array(n).fill(pattern).join(".*")}`;
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const submit = { run: [NODE, `${KIT}/submit.mjs`, "--dir", DIR, "--answer", `answer for codex cell ${cell}`], timeout: 60 };
const LONG = 'Run this exact command in the foreground and wait for it to finish: node -e "setTimeout(()=>{},45000)". Then reply "done".';
const forbid = { forbid: "(?i)update now|(?<!no )update available|skip until next version" };
const setupDone = [onLog('"event":"register-thread"', 240), onLog('"hookEvent":"Stop"', 240), { wait: 3 }];
const pickup = (timeout) => onLog('"event":"pickup"', timeout);
const longRunning = [onLog(nth('"hookEvent":"UserPromptSubmit"', 2), 120), { wait: 12 }];
let steps;
if (cell === "QB") steps = [forbid, ...setupDone, ...type(LONG), ...longRunning, submit, pickup(240), { wait: 25 }];
else if (cell === "QD")
  steps = [forbid, ...setupDone, ...type(LONG), onLog(nth('"hookEvent":"UserPromptSubmit"', 2), 120), { wait: 8 }, { key: "esc" }, { wait: 10 }, submit, pickup(75), { wait: 3 }, ...type("ok"), pickup(150), { wait: 25 }];
else if (cell === "QE") steps = [forbid, ...setupDone, { wait: Number(IDLE_SECONDS) }, submit, pickup(120), { wait: 20 }];
else if (cell === "QF" && phase === "1") steps = [forbid, ...setupDone, { wait: 3 }];
else if (cell === "QF" && phase === "2") steps = [forbid, { wait: 5 }, pickup(90), { wait: 3 }, ...type("ok"), pickup(120), { wait: 25 }];
else if (cell === "QR") steps = [forbid, ...setupDone, { wait: 20 }, submit, pickup(120), { wait: 20 }];
else if (cell === "FA") steps = [forbid, onLog('"hookEvent":"Stop"', 240), { wait: 20 }, submit, { wait: 5 }, ...type("ok"), pickup(120), { wait: 20 }];
else throw new Error(`unknown cell ${cell}/${phase}`);
console.log(JSON.stringify(steps, null, 1));
