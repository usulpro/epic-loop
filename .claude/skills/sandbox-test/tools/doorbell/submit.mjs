// Submits answers to a running answers server, as the human's page would.
// Usage: node submit.mjs [--dir D] [--answer "text"]
import { parseArgs, paths, probeDir, readJson } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const server = readJson(paths(dir).server);
if (!server?.port) {
  console.error(`no server.json in ${dir}; start server.mjs first`);
  process.exit(1);
}
const res = await fetch(`http://127.0.0.1:${server.port}/answers`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ answer: flags.answer || "probe answer" }),
});
console.log(await res.text());
