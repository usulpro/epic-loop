import fs from "node:fs";
import path from "node:path";

// Server-sent events for the epic home: `change` when a file the home shows changes, and a
// comment heartbeat. One watcher per connected client, closed when the client goes away.
//   GET /api/<slug>/events  ->  retry, then `event: change` / `data: {"file":"tracker.md"}`
const DEBOUNCE_MS = 300;
const HEARTBEAT_MS = 20000;
const POLL_MS = 1000;
const WATCHED = [
  /^\.runtime\/runtime-state\.json$/u,
  /^tracker(\..+\.previous-layer-\d+)?\.md$/u,
  /^human-queue\.md$/u,
  /^decision-log\.md$/u,
  /^state-of-epic\.md$/u,
  /^inbox\.jsonl$/u,
  /^reviews\//u,
  /^docs\//u,
];
const POLLED = [".runtime/runtime-state.json", "tracker.md", "human-queue.md", "decision-log.md", "state-of-epic.md", "inbox.jsonl"];

let open = 0;

// Live watchers, for /_health and tests.
export function watcherCount() {
  return open;
}

export function isWatchedFile(relative) {
  const file = String(relative ?? "")
    .split(path.sep)
    .join("/");
  return WATCHED.some((pattern) => pattern.test(file));
}

function watch(epicDir, onFile) {
  try {
    const watcher = fs.watch(epicDir, { recursive: true }, (_event, filename) => {
      if (filename && isWatchedFile(filename)) onFile(String(filename));
    });
    return () => watcher.close();
  } catch {
    // No recursive fs.watch here: poll the files the home reads.
    const stamp = () =>
      POLLED.map((file) => {
        try {
          return `${file}:${fs.statSync(path.join(epicDir, file)).mtimeMs}`;
        } catch {
          return `${file}:-`;
        }
      });
    let last = stamp();
    const timer = setInterval(() => {
      const now = stamp();
      const changed = now.find((value, index) => value !== last[index]);
      last = now;
      if (changed) onFile(changed.split(":")[0]);
    }, POLL_MS);
    return () => clearInterval(timer);
  }
}

export function streamEpicEvents(req, res, epicDir) {
  res.writeHead(200, { "cache-control": "no-store", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8", "x-content-type-options": "nosniff" });
  res.write("retry: 2000\n: connected\n\n");
  let pending = null;
  let timer = null;
  const unwatch = watch(epicDir, (file) => {
    pending = file;
    clearTimeout(timer);
    timer = setTimeout(() => res.write(`event: change\ndata: ${JSON.stringify({ file: pending })}\n\n`), DEBOUNCE_MS);
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_MS);
  open += 1;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    open -= 1;
    unwatch();
    clearTimeout(timer);
    clearInterval(heartbeat);
  };
  req.on("close", close);
  res.on("close", close);
}
