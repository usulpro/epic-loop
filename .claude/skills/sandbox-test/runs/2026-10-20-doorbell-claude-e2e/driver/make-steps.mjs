// Emits ptydrive steps for one end-to-end scenario. Usage: node make-steps.mjs <E1|E2|E3> (env: PLOG, ELOG, NODE, KIT, DIR, PROMPT)
const [scenario] = process.argv.slice(2);
const { PLOG, ELOG, NODE, KIT, DIR, PROMPT } = process.env;
const onProbe = (pattern, timeout) => ({ expect_file: PLOG, pattern, timeout });
const onLoop = (pattern, timeout) => ({ expect_file: ELOG, pattern, timeout });
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const submit = { run: [NODE, `${KIT}/submit.mjs`, "--dir", DIR, "--answer", `codename-${scenario}-amber`], timeout: 30 };
const both = (a, b) => `${a}[^\\n]*${b}|${b}[^\\n]*${a}`;
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
const idle = onLoop('"status":"idle"', 1500);
let steps;
if (scenario === "E1")
  steps = [...start, onProbe('"event":"waiter-armed"', 900), onLoop('"action":"turn-waiting-background"', 300), { wait: 20 }, submit, onProbe('"event":"pickup"', 300), idle, { wait: 20 }];
else if (scenario === "E2")
  steps = [
    ...start,
    onLoop(both('"action":"turn-start"', '"role":"engineer"'), 900),
    onLoop(both('"action":"turn-stop"', '"role":"engineer"'), 600),
    { wait: 3 },
    submit,
    { wait: 3 },
    ...type("ok"),
    onProbe('"event":"pickup"', 300),
    idle,
    { wait: 20 },
  ];
else if (scenario === "E3") steps = [...start, idle, { wait: 20 }, submit, onProbe('"event":"pickup"', 180), { wait: 90 }];
else throw new Error(`unknown scenario ${scenario}`);
console.log(JSON.stringify(steps, null, 1));
