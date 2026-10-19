// Emits ptydrive steps for one matrix cell. Usage: node make-steps.mjs <state> <phase> (env: PLOG, ELOG, ROW, NODE, KIT, DIR, PROMPT)
// States: A idle, B mid-turn, C epic-loop loop, D after Esc, E 15 min idle, F closed + resume (phase 1|2), S stderr size (as A).
const [state, phase = "1"] = process.argv.slice(2);
const { PLOG, ELOG, ROW, NODE, KIT, DIR, PROMPT, IDLE_SECONDS = "900" } = process.env;
const onLog = (pattern, timeout) => ({ expect_file: PLOG, pattern, timeout });
const nth = (pattern, n) => `(?s)${Array(n).fill(pattern).join(".*")}`;
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const submit = (tag) => ({ run: [NODE, `${KIT}/submit.mjs`, "--dir", DIR, "--answer", `answer for cell ${tag}`], timeout: 30 });
const LONG = 'Run this exact command in the foreground (not as a background task) and wait for it to finish: node -e "setTimeout(()=>{},45000)". Then reply "done".';
const human = ROW === "4";
const start = [
  { expect: "trust", timeout: 30 },
  { wait: 1 },
  { key: "down" },
  { wait: 1 },
  { key: "enter" },
  { forbid: "(?i)(?<!no )update available|auto-update" },
  { expect: "shift\\+tab\\s*to\\s*cycle", timeout: 60 },
  { wait: 2 },
  ...type(PROMPT),
];
// Setup turn done: its Stop, and for rows 1-3 an armed waiter.
const setupDone = [onLog('"hookEvent":"Stop"', 240), ...(human ? [] : [onLog('"event":"waiter-armed"', 120)]), { wait: 3 }];
const pickup = (n, timeout) => onLog(nth('"event":"pickup"', n), timeout);
const longCommandRunning = onLog('"hookEvent":"PreToolUse"[^\\n]*setTimeout', 180);

let steps;
if (state === "A" || state === "S") {
  steps = [...start, ...setupDone, { wait: 20 }, submit(`${ROW}${state}`), ...(human ? [{ wait: 5 }, ...type("ok")] : []), pickup(1, 180), { wait: 20 }];
} else if (state === "B") {
  steps = [
    ...start,
    ...setupDone,
    ...type(LONG),
    longCommandRunning,
    { wait: 12 },
    submit(`${ROW}B`),
    // Wait for the long turn to end, then (row 4) the human sends a message.
    onLog(nth('"hookEvent":"Stop"', 2), 180),
    { wait: 5 },
    ...(human ? type("ok") : []),
    pickup(1, 180),
    { wait: 25 },
  ];
} else if (state === "D") {
  steps = [
    ...start,
    ...setupDone,
    ...type(LONG),
    longCommandRunning,
    { wait: 5 },
    { key: "esc" },
    { wait: 15 },
    submit(`${ROW}D`),
    ...(human ? [{ wait: 5 }, ...type("ok")] : []),
    pickup(1, 120),
    { wait: 20 },
  ];
} else if (state === "E") {
  steps = [...start, ...setupDone, { wait: Number(IDLE_SECONDS) }, submit(`${ROW}E`), ...(human ? [{ wait: 5 }, ...type("ok")] : []), pickup(1, 120), { wait: 20 }];
} else if (state === "F" && phase === "1") {
  steps = [...start, ...setupDone, { wait: 5 }];
} else if (state === "F" && phase === "2") {
  steps = [
    { forbid: "(?i)(?<!no )update available|auto-update" },
    { expect: "shift\\+tab\\s*to\\s*cycle", timeout: 60 },
    // Give a re-armed waiter the chance to wake the model on its own, then send the first human message.
    pickup(1, 90),
    { wait: 5 },
    ...type("ok"),
    pickup(1, 120),
    { wait: 20 },
  ];
} else if (state === "C") {
  steps = [
    ...start,
    { expect_file: ELOG, pattern: '"action":"turn-start"[^\\n]*"role":"engineer"|"role":"engineer"[^\\n]*"action":"turn-start"', timeout: 900 },
    longCommandRunning,
    { wait: 12 },
    submit(`${ROW}C`),
    pickup(1, 600),
    { expect_file: ELOG, pattern: '"status":"idle"', timeout: 1800 },
    { wait: 20 },
  ];
} else throw new Error(`unknown state ${state}/${phase}`);
console.log(JSON.stringify(steps, null, 1));
