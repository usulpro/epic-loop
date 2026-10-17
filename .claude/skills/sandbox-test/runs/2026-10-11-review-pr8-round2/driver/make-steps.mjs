// Emits the ptydrive steps for one scenario. PROMPT and PLOG come from the environment.
const x = process.argv[2];
const { PROMPT, PLOG } = process.env;
const onFile = (pattern, timeout) => ({ expect_file: PLOG, pattern, timeout });
const type = (text) => [{ send: text }, { wait: 1 }, { key: "enter" }];
const start = [
  { expect: "trust", timeout: 30 },
  { wait: 1 },
  { key: "down" },
  { wait: 1 },
  { key: "enter" },
  { forbid: "(?i)(?<!no )update available|auto-update" },
  { expect: "shift\\+tab\\s*to\\s*cycle", timeout: 40 },
  { wait: 2 },
  ...type(PROMPT),
];
const idle = [onFile('"status":"idle"', 1500), { wait: 15 }];
const scenario = {
  A: [...idle],
  B: [onFile('"action":"turn-waiting-background"', 1200), { wait: 5 }, ...type("how is it going? one sentence."), ...idle],
  "C-fix": [onFile('"status":"idle"', 900), { wait: 15 }],
  C: [onFile('"action":"turn-waiting-background"', 1200), { wait: 180 }, ...type("status? one sentence."), onFile('"action":"turn-(aborted|start)"', 120), { wait: 240 }],
}[x];
if (!scenario) throw new Error(`unknown scenario ${x}`);
console.log(JSON.stringify([...start, ...scenario], null, 1));
