#!/usr/bin/env node
// A fake headless translator for tests: never a model. It reads the prompt on stdin and answers
// like `claude -p` (stdout) or `codex exec -o <file>` (last-message file). Text lines get a
// `[ru] ` prefix; code fences, tables and link targets stay as they are. Each call appends its
// argv as one JSON line to $FAKE_TRANSLATOR_LOG. $FAKE_TRANSLATOR_MODE: "drop-id" removes the
// first id, "hang" never answers, "fail" exits 3.
import fs from "node:fs";

const args = process.argv.slice(2);
if (process.env.FAKE_TRANSLATOR_LOG) fs.appendFileSync(process.env.FAKE_TRANSLATOR_LOG, `${JSON.stringify({ args, cwd: process.cwd(), pid: process.pid })}\n`);
const mode = process.env.FAKE_TRANSLATOR_MODE ?? "";
let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (prompt += chunk));
process.stdin.on("end", () => {
  if (mode === "hang") {
    setInterval(() => {}, 1000);
    return;
  }
  if (mode === "fail") process.exit(3);
  let answer;
  const doc = prompt.match(/<document>\n([\s\S]*)\n<\/document>/u);
  if (doc) {
    let fence = false;
    answer = doc[1]
      .split("\n")
      .map((line) => {
        if (line.startsWith("```")) fence = !fence;
        if (fence || line.startsWith("```") || !line.trim() || line.startsWith("|")) return line;
        const head = line.match(/^(\s*(?:#+|[-*]|\d+\.)\s+)?(.*)$/u);
        return `${head[1] ?? ""}[ru] ${head[2]}`;
      })
      .join("\n");
    if (mode === "drop-id") answer = answer.replace(/(?<![A-Za-z0-9_-])[DHQRT]-?\d+(?![A-Za-z0-9_])/u, "");
  } else {
    const json = JSON.parse(prompt.slice(prompt.indexOf("{"), prompt.lastIndexOf("}") + 1));
    answer = JSON.stringify(Object.fromEntries(Object.entries(json).map(([key, value]) => [key, `[ru] ${value}`])));
  }
  const output = args.indexOf("-o");
  if (output !== -1) fs.writeFileSync(args[output + 1], answer);
  else process.stdout.write(answer);
});
