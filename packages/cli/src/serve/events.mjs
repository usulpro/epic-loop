import fs from "node:fs";
import path from "node:path";

import { driverTranscriptPath } from "../epic/activity.mjs";

// Server-sent events for the epic home: `change` when a file the home shows changes, `activity`
// when the driver session's transcript grows, and a comment heartbeat. One watcher per connected
// client, closed when the client goes away. The transcript watch is re-armed when
// runtime-state.json names a different `driver_transcript_path`.
//   GET /api/<slug>/events  ->  retry, then `event: change` / `data: {"file":"tracker.md"}`
//                                       or `event: activity` / `data: {}`
//                                       or `event: translated` / `data: {}`
const DEBOUNCE_MS = 300;
// A finished translation job (Task 5): the page swaps in its translated fragment.
const TRANSLATED = /^\.runtime\/translations\/[^/]+\/jobs\.jsonl$/u;
const HEARTBEAT_MS = 20000;
const POLL_MS = 1000;
const WATCHED = [
  /^\.runtime\/runtime-state\.json$/u,
  /^\.runtime\/progress-log\.jsonl$/u,
  TRANSLATED,
  // Every top-level artifact: tracker and archive layers, queue, logs, registers, state.
  /^[^/]+\.md$/u,
  /^inbox\.jsonl$/u,
  /^stop-reports\//u,
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

// Machine directories with a stream of files the app never shows.
const SKIP_DIRS = new Set([".runtime/hook-events", ".runtime/sessions", ".runtime/engineer-briefs"]);
const REARM_MS = 2000;

function listDirs(epicDir, relative = "", depth = 0) {
  if (depth > 6 || SKIP_DIRS.has(relative)) return [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(epicDir, relative), { withFileTypes: true });
  } catch {
    return [];
  }
  return [relative, ...entries.filter((entry) => entry.isDirectory()).flatMap((entry) => listDirs(epicDir, relative ? `${relative}/${entry.name}` : entry.name, depth + 1))];
}

// One non-recursive watcher per directory. Node's recursive fs.watch on Linux follows files by
// inode, so a file replaced atomically (written to .tmp, then renamed, as the skill writes
// runtime-state.json) goes silent after its first replacement; a directory watch keeps reporting
// it by name. New directories (`.runtime/` after the first bind, a new review) are picked up.
function watch(epicDir, onFile) {
  const watchers = new Map();
  let syncTimer = null;
  let initial = true;
  const sync = () => {
    const dirs = new Set(listDirs(epicDir));
    for (const [dir, watcher] of watchers)
      if (!dirs.has(dir)) {
        watcher.close();
        watchers.delete(dir);
      }
    for (const dir of dirs) {
      if (watchers.has(dir)) continue;
      try {
        const watcher = fs.watch(path.join(epicDir, dir), (event, name) => {
          if (!name) return;
          const relative = dir ? `${dir}/${String(name)}` : String(name);
          if (event === "rename") {
            clearTimeout(syncTimer);
            syncTimer = setTimeout(sync, 100);
          }
          if (isWatchedFile(relative)) onFile(relative);
        });
        watcher.on("error", () => {
          watcher.close();
          watchers.delete(dir);
        });
        watchers.set(dir, watcher);
      } catch {
        continue;
      }
      // A directory that appeared after the stream connected may already hold a file written
      // before its watcher existed (a translation job's first jobs.jsonl line): report it.
      if (initial) continue;
      try {
        for (const entry of fs.readdirSync(path.join(epicDir, dir), { withFileTypes: true })) {
          const relative = dir ? `${dir}/${entry.name}` : entry.name;
          if (entry.isFile() && isWatchedFile(relative)) onFile(relative);
        }
      } catch {}
    }
    initial = false;
  };
  sync();
  if (watchers.has("")) {
    return () => {
      clearTimeout(syncTimer);
      for (const watcher of watchers.values()) watcher.close();
    };
  }
  // No fs.watch here: poll the files the home reads.
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

// Watches one file outside the epic (the transcript) through its directory, so an atomic rewrite
// does not silence it; polls when the directory cannot be watched.
function watchFile(file, onChange) {
  if (!file) return () => {};
  const base = path.basename(file);
  try {
    const watcher = fs.watch(path.dirname(file), (_event, name) => {
      if (String(name) === base) onChange();
    });
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
  const sendTranslated = debounced(() => res.write("event: translated\ndata: {}\n\n"));
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
  // A safety net for a missed runtime-state event: the path is cheap to re-read.
  const rearmTimer = setInterval(rearm, REARM_MS);
  const unwatch = watch(epicDir, (file) => {
    const relative = file.split(path.sep).join("/");
    if (TRANSLATED.test(relative)) return sendTranslated();
    if (relative === ".runtime/runtime-state.json") rearm();
    return sendChange(file);
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
    clearInterval(rearmTimer);
    sendChange.cancel();
    sendActivity.cancel();
    sendTranslated.cancel();
    clearInterval(heartbeat);
  };
  req.on("close", close);
  res.on("close", close);
}
