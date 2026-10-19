import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

import { readCliVersion } from "../paths.mjs";
import { findProjectRoot } from "../project-root.mjs";
import { writeAtomic } from "./answers.mjs";
import { createReviewServer } from "./server.mjs";

// One server per project: its pid and port live in .epic-loop/.runtime/server.json.

function runtimeDir(root) {
  return path.join(root, ".epic-loop", ".runtime");
}

function serverFile(root) {
  return path.join(runtimeDir(root), "server.json");
}

function readServerInfo(root) {
  try {
    return JSON.parse(fs.readFileSync(serverFile(root), "utf8"));
  } catch {
    return null;
  }
}

function removeServerInfo(root, pid) {
  const info = readServerInfo(root);
  if (info && (pid === undefined || info.pid === pid)) fs.rmSync(serverFile(root), { force: true });
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function health(port, timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/_health", headers: { host: `127.0.0.1:${port}` }, timeout }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(body) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

// running: recorded, alive, and answering for this root; stale: recorded but not; stopped: nothing recorded.
async function currentServer(root) {
  const info = readServerInfo(root);
  if (!info) return { state: "stopped", info: null };
  if (isAlive(info.pid)) {
    const answer = await health(info.port);
    if (answer?.ok && answer.root === root && answer.pid === info.pid) return { state: "running", info };
  }
  return { state: "stale", info };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function print(flags, value, text) {
  console.log(flags.json ? JSON.stringify(value, null, 2) : text);
}

function resolveRoot(flags) {
  const root = typeof flags.root === "string" ? path.resolve(flags.root) : findProjectRoot(process.cwd());
  if (!root || !fs.existsSync(path.join(root, ".epic-loop"))) throw new Error("No epic-loop project here: run inside a project with .epic-loop/ or pass --root.");
  return fs.realpathSync(root);
}

function parsePort(flags) {
  if (flags.port === undefined) return 0;
  const port = Number(flags.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid --port: ${flags.port}`);
  return port;
}

async function stopServer(root, flags) {
  const { state, info } = await currentServer(root);
  if (!info) {
    print(flags, { stopped: false, running: false }, "No review server is running for this project.");
    return 0;
  }
  if (isAlive(info.pid) && state === "running") {
    process.kill(info.pid, "SIGTERM");
    for (let i = 0; i < 50 && isAlive(info.pid); i += 1) await sleep(100);
    if (isAlive(info.pid)) process.kill(info.pid, "SIGKILL");
  }
  removeServerInfo(root);
  print(
    flags,
    { stopped: state === "running", running: false, pid: info.pid },
    state === "running" ? `Stopped the review server (pid ${info.pid}).` : "The recorded review server was not running; removed its stale record.",
  );
  return 0;
}

async function startDetached(root, flags) {
  fs.mkdirSync(runtimeDir(root), { recursive: true });
  const log = fs.openSync(path.join(runtimeDir(root), "server.log"), "a");
  const args = [process.argv[1], "serve", "--root", root];
  if (flags.port !== undefined) args.push("--port", String(parsePort(flags)));
  const child = spawn(process.execPath, args, {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
  });
  fs.closeSync(log);
  let exited = null;
  child.on("exit", (code) => (exited = code));
  child.unref();
  for (let i = 0; i < 100; i += 1) {
    if (exited !== null) break;
    const info = readServerInfo(root);
    if (info?.pid === child.pid && (await health(info.port))?.ok) {
      print(flags, { running: true, reused: false, ...info }, `Review server running at ${info.url} (pid ${info.pid}).`);
      return 0;
    }
    await sleep(100);
  }
  if (exited === null && isAlive(child.pid)) process.kill(child.pid, "SIGTERM");
  throw new Error(`The review server did not start; see ${path.join(runtimeDir(root), "server.log")}.`);
}

function startForeground(root, flags) {
  return new Promise((resolve, reject) => {
    const server = createReviewServer({
      root,
      onListening(port) {
        const info = { pid: process.pid, port, url: `http://127.0.0.1:${port}/`, root, startedAt: new Date().toISOString(), version: readCliVersion() };
        fs.mkdirSync(runtimeDir(root), { recursive: true });
        writeAtomic(serverFile(root), `${JSON.stringify(info, null, 2)}\n`);
        print(flags, { running: true, reused: false, ...info }, `Review server running at ${info.url} (pid ${info.pid}). Stop it with: epic-loop serve --stop`);
      },
    });
    server.on("error", reject);
    const shutdown = () => {
      removeServerInfo(root, process.pid);
      server.close(() => resolve(0));
      setTimeout(() => resolve(0), 1000).unref();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
    server.listen(parsePort(flags), "127.0.0.1");
  });
}

export async function runServe(flags) {
  const root = resolveRoot(flags);
  if (flags.stop) return stopServer(root, flags);

  const current = await currentServer(root);
  if (flags.status) {
    if (current.state === "running") print(flags, { running: true, ...current.info }, `Review server running at ${current.info.url} (pid ${current.info.pid}).`);
    else
      print(
        flags,
        { running: false, stale: current.state === "stale" },
        current.state === "stale" ? "No review server is running (a stale record will be replaced on the next start)." : "No review server is running.",
      );
    return 0;
  }
  if (current.state === "running") {
    print(flags, { running: true, reused: true, ...current.info }, `Review server already running at ${current.info.url} (pid ${current.info.pid}).`);
    return 0;
  }
  if (current.state === "stale") removeServerInfo(root);
  return flags.detach ? startDetached(root, flags) : startForeground(root, flags);
}
