// Answers server: a tiny local page plus POST /answers. On submit it writes answers.json (with submittedAt)
// and rings the configured mechanism.
// Usage: node server.mjs [--dir D] [--port 0] --ring file|codex-queue [--codex-bin codex]
//   file         the answers file itself is the ring; a waiter (asyncRewake hook, background task) watches it
//   codex-queue  also runs `codex queue --thread <thread-id> --message <pointer>`; the session registers
//                its thread id first (register-thread.mjs)
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { logEvent, parseArgs, paths, pointer, probeDir, readJson, writeJsonAtomic } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const p = paths(dir);
const ring = flags.ring || "file";
const codexBin = flags["codex-bin"] || "codex";
fs.mkdirSync(dir, { recursive: true });

const page = `<!doctype html><meta charset="utf-8"><title>Doorbell probe</title>
<form method="post" action="/answers"><textarea name="answer" rows="4" cols="60">probe answer</textarea><br><button>Submit</button></form>`;

function ringCodex(answers) {
  const threadId = fs.existsSync(p.threadId) ? fs.readFileSync(p.threadId, "utf8").trim() : "";
  if (!threadId) {
    logEvent(dir, "ring-failed", { mechanism: "codex-queue", reason: "no thread-id registered" });
    return;
  }
  const message = pointer(dir, answers);
  const started = Date.now();
  logEvent(dir, "ring", { mechanism: "codex-queue", threadId, pointer: message });
  execFile(codexBin, ["queue", "--thread", threadId, "--message", message], { timeout: 60000 }, (error, stdout, stderr) => {
    logEvent(dir, "ring-done", {
      mechanism: "codex-queue",
      exitCode: error ? (error.code ?? 1) : 0,
      ms: Date.now() - started,
      stdout: stdout.slice(0, 500),
      stderr: stderr.slice(0, 500),
    });
  });
}

function submit(payload) {
  const answers = { id: `a${Date.now()}`, submittedAt: new Date().toISOString(), payload };
  writeJsonAtomic(p.answers, answers);
  logEvent(dir, "submit", { answersId: answers.id, submittedAt: answers.submittedAt, payload });
  if (ring === "codex-queue") ringCodex(answers);
  else logEvent(dir, "ring", { mechanism: "file", pointer: pointer(dir, answers) });
  return answers;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }
  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ring, answers: readJson(p.answers), pickup: readJson(p.pickup) }));
    return;
  }
  if (req.method === "POST" && req.url === "/answers") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = Object.fromEntries(new URLSearchParams(body));
      }
      const answers = submit(payload);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(answers));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(Number(flags.port || 0), "127.0.0.1", () => {
  const { port } = server.address();
  writeJsonAtomic(p.server, { port, pid: process.pid, ring, startedAt: new Date().toISOString() });
  logEvent(dir, "server-start", { port, ring });
  console.log(`doorbell server on http://127.0.0.1:${port} (ring: ${ring}, dir: ${dir})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    logEvent(dir, "server-stop", { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
