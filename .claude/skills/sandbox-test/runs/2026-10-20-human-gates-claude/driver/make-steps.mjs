// Emits ptydrive steps for one cell. Usage: node make-steps.mjs <G|SON|SOFF>
// (env: ELOG = the epic progress log, NODE, HUMAN = human.mjs, S = sandbox, OUT, PROMPT)
const [cell] = process.argv.slice(2);
const { ELOG, NODE, HUMAN, S, OUT, PROMPT } = process.env;
const onLoop = (pattern, timeout) => ({ expect_file: ELOG, pattern, timeout });
const event = (action, extra = "") => (extra ? `"action":"${action}"[^\\n]*${extra}` : `"action":"${action}"`);
const times = (pattern, n) => Array.from({ length: n }, () => pattern).join("[\\s\\S]*");
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const human = (...args) => ({ run: [NODE, HUMAN, args[0], "--sandbox", S, "--out", OUT, ...args.slice(1)], timeout: 90 });
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
let steps;
if (cell === "G")
  steps = [
    ...start,
    // 1 and 6: a non-blocking gate answered while the loop works, plus an inbox request.
    onLoop(event("gate-opened", '"blocking":false'), 1500),
    { wait: 5 },
    human("answer"),
    human("inbox", "--text", "Please also export farewell(name) returning 'Goodbye, <name>'."),
    onLoop(event("inbox-ingested"), 1200),
    // 7: a problem report on the blocking page, while the loop awaits it.
    onLoop(event("awaiting-review"), 1800),
    { wait: 15 },
    human("problem", "--text", "The H2 card does not say which release name I confirm."),
    onLoop(event("problems-ingested"), 1200),
    // 2 and 5: the fixed page awaits again; the submit leaves the security-hold unconfirmed.
    onLoop(times(event("awaiting-review"), 2), 900),
    { wait: 15 },
    human("answer", "--leave", "^h3$|npm publish"),
    // The problem ingest logs problems-ingested, not gate-ingested: the answers make the second one.
    onLoop(times(event("gate-ingested"), 2), 900),
    onLoop(event("stop-gate"), 1800),
    { wait: 30 },
  ];
else if (cell === "SON" || cell === "SOFF")
  steps = [
    ...start,
    // 3 and 4: the accepted stop's report page; D1 reversed; the switch on or off.
    onLoop(event("stop-gate", '"review"'), 1500),
    { wait: 15 },
    cell === "SON" ? human("answer", "--stop-report", "--set", "d1=reverse") : human("answer", "--stop-report", "--set", "d1=reverse", "--set", "continue-after-submit=false"),
    ...(cell === "SON"
      ? [onLoop(event("stop-report-continue"), 900), onLoop(times(event("stop-gate"), 2), 1500), { wait: 30 }]
      : [onLoop(event("stop-report-paused"), 900), { wait: 90 }]),
  ];
else throw new Error(`unknown cell ${cell}`);
console.log(JSON.stringify(steps, null, 1));
