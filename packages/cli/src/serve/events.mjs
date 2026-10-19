import fs from "node:fs";
import path from "node:path";

import { driverTranscriptPath } from "../epic/activity.mjs";

// Server-sent events for the epic home: `change` when a file the home shows changes, `activity`
// when the driver session's transcript grows, and a comment heartbeat. One watcher per connected
// client, closed when the client goes away. The transcript watch is re-armed when
// runtime-state.json names a different `driver_transcript_path`.
//   GET /api/<slug>/events  ->  retry, then `event: change` / `data: {"file":"tracker.md"}`
//                                       or `event: activity` / `data: {}`
const DEBOUNCE_MS = 300;
const HEARTBEAT_MS = 20000;
const POLL_MS = 1000;
const WATCHED = [
  /^\.runtime\/runtime-state\.json$/u,
  /^\.runtime\/progress-log\.jsonl$/u,
  /^tracker(\..+\.previous-layer-\d+)?\.md$/u,
  /^human-queue\.md$/u,
  /^decision-log\.md$/u,
  /^state-of-epic\.md$/u,
  /^inbox\.jsonl$/u,
  /^reviews\//u,
  /^docs\//u,
];
const POLLED = [".runtime/runtime-state.json", ".runtime/progress-log.jsonl", "tracker.md", "human-queue.md", "decision-log.md", "state-of-epic.md", "inbox.jsonl"];

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

// Watches one file outside the epic (the transcript); polls when it cannot be watched, e.g. before it exists.
function watchFile(file, onChange) {
  if (!file) return () => {};
  try {
    const watcher = fs.watch(file, () => onChange());
    watcher.on("error", () => {});
    return () => watcher.close();
  } catch {
    const listener = (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) onChange();
    };
    fs.watchFile(file, { interval: POLL_MS }, listener);
    return () => fs.unwatchFile(file, listener);
  }
}

function debounced(fn) {
  let timer = null;
  const call = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), DEBOUNCE_MS);
  };
  call.cancel = () => clearTimeout(timer);
  return call;
}

export function streamEpicEvents(req, res, epicDir) {
  res.writeHead(200, { "cache-control": "no-store", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8", "x-content-type-options": "nosniff" });
  res.write("retry: 2000\n: connected\n\n");
  const sendChange = debounced((file) => res.write(`event: change\ndata: ${JSON.stringify({ file })}\n\n`));
  const sendActivity = debounced(() => res.write("event: activity\ndata: {}\n\n"));
  let transcript = driverTranscriptPath(epicDir);
  let unwatchTranscript = watchFile(transcript, sendActivity);
  const rearm = () => {
    const next = driverTranscriptPath(epicDir);
    if (next === transcript) return;
    unwatchTranscript();
    transcript = next;
    unwatchTranscript = watchFile(transcript, sendActivity);
    sendActivity();
  };
  const unwatch = watch(epicDir, (file) => {
    if (file.split(path.sep).join("/") === ".runtime/runtime-state.json") rearm();
    sendChange(file);
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_MS);
  open += 1;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    open -= 1;
    unwatch();
    unwatchTranscript();
    sendChange.cancel();
    sendActivity.cancel();
    clearInterval(heartbeat);
  };
  req.on("close", close);
  res.on("close", close);
}
