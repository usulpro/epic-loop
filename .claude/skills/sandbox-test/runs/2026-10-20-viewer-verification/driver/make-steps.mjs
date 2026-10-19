// Emits the ptydrive steps of the Claude Code cell: accept the trust dialog, send the prompt, let the
// loop run until viewer-check.mjs writes its marker, then stop the loop and leave.
// (env: OUT, PROMPT)
const { OUT, PROMPT } = process.env;
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const steps = [
  { expect: "trust", timeout: 30 },
  { wait: 1 },
  { key: "down" },
  { wait: 1 },
  { key: "enter" },
  { forbid: "(?i)(?<!no )update available|auto-update" },
  { expect: "shift\\+tab\\s*to\\s*cycle", timeout: 60 },
  { wait: 2 },
  ...type(PROMPT),
  { expect_file: `${OUT}/viewer-done.txt`, pattern: ".", timeout: 2700 },
  { wait: 5 },
  ...type("stop loop mode"),
  { wait: 30 },
];
console.log(JSON.stringify(steps, null, 1));
