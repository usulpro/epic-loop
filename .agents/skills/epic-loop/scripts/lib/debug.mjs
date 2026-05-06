import fs from "node:fs";
import path from "node:path";

import { readCurrentCodexSession, readJson, resolveRoot, sessionRoot } from "./common.mjs";
import { readImplementationLoops } from "./loop.mjs";

export function debugState(flags = {}) {
  const root = resolveRoot(flags.root);
  const limit = Number.parseInt(flags.limit ?? "10", 10);
  const stateRoot = sessionRoot(root);
  const bindingsPath = path.join(stateRoot, "session-bindings.json");
  const bindings = readJson(bindingsPath, { active_sessions: {}, sessions: {} });
  const currentSession = readCurrentCodexSession(root);
  const sessionStates = readSessionStates(path.join(stateRoot, "sessions"));
  const recentHookEvents = listRecentFiles(path.join(stateRoot, "hook-events"), Number.isFinite(limit) ? limit : 10);

  const payload = {
    active_sessions: bindings.active_sessions ?? {},
    bindings_path: bindingsPath,
    current_session_candidate: currentSession,
    implementation_loops: readImplementationLoops(root),
    recent_hook_events: recentHookEvents,
    root,
    session_states: sessionStates,
    sessions: bindings.sessions ?? {},
  };

  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Project: ${root}`);
  console.log(`Bindings: ${fs.existsSync(bindingsPath) ? bindingsPath : "none"}`);
  console.log(`Current session candidate: ${currentSession?.session_id ?? "none"}`);
  console.log(`Active sessions: ${Object.keys(payload.active_sessions).length > 0 ? JSON.stringify(payload.active_sessions) : "none"}`);
  console.log(`Implementation loops: ${payload.implementation_loops.length}`);
  console.log(`Recorded session states: ${sessionStates.length}`);
  console.log(`Recent hook events: ${recentHookEvents.length}`);

  for (const event of recentHookEvents) {
    console.log(`- ${event.path} (${event.updated_at})`);
  }
}

function readSessionStates(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => readJson(path.join(dirPath, entry.name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
}

function listRecentFiles(dirPath, limit) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return walkFiles(dirPath)
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return {
        path: path.relative(process.cwd(), filePath),
        updated_at: new Date(stat.mtimeMs).toISOString(),
        updated_at_ms: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.updated_at_ms - a.updated_at_ms)
    .slice(0, limit);
}

function walkFiles(dirPath) {
  const files = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
