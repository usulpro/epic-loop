import fs from "node:fs";
import path from "node:path";

// The driver session's recent activity for the epic home (Phase 5 Task 3), read from the tail of
// its transcript with no model involved: a Claude Code session JSONL or a Codex rollout.
// Item: { at, kind: "tool" | "message" | "result" | "turn", role?, name?, summary }.
// Thinking and reasoning are never shown; tool output is cut to one line.
export const TAIL_BYTES = 256 * 1024;
export const MAX_ITEMS = 30;
const MESSAGE_CHARS = 200;
const LINE_CHARS = 140;

function oneLine(text, limit = LINE_CHARS) {
  const line =
    String(text ?? "")
      .split("\n")
      .map((part) => part.trim())
      .find(Boolean) ?? "";
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

function cut(text, limit = MESSAGE_CHARS) {
  // A message is shown as plain text: bold markers would only add noise.
  const flat = String(text ?? "")
    .replace(/\*\*|__/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

// The last `bytes` of the file as complete JSON lines (the first, partial line is dropped).
export function readTailLines(file, bytes = TAIL_BYTES) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.toString("utf8").split("\n");
    if (start > 0) lines.shift();
    return lines.filter((line) => line.trim());
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function parse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// The main argument of a tool call: the command, the file path, the pattern, or a description.
function mainArgument(input) {
  if (typeof input === "string") return oneLine(input);
  if (!input || typeof input !== "object") return "";
  for (const key of ["command", "cmd", "file_path", "path", "pattern", "url", "description", "task_name", "skill", "query"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return oneLine(value);
    if (Array.isArray(value) && value.length) return oneLine(value.join(" "));
  }
  return "";
}

function toolSummary(name, input) {
  const argument = mainArgument(input);
  return argument ? `${name}: ${argument}` : name;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && (part.type === "text" || part.type === "output_text" || part.type === "input_text"))
    .map((part) => part.text ?? "")
    .join("\n");
}

// A user-side string that the host injected, as a turn marker: the Stop hook's next role prompt,
// or a background task notification. Null for a message the human typed.
function claudeInjected(text, isMeta) {
  if (text.startsWith("Stop hook feedback:")) return `role prompt: ${oneLine(text.slice("Stop hook feedback:".length))}`;
  if (text.startsWith("<task-notification>")) {
    const summary = text.match(/<summary>([^<]*)<\/summary>/u)?.[1] ?? text.match(/<status>([^<]*)<\/status>/u)?.[1];
    return `background task${summary ? `: ${oneLine(summary)}` : " notification"}`;
  }
  return isMeta ? "" : null;
}

function claudeItems(entry) {
  const at = entry.timestamp ?? null;
  const content = entry.message?.content;
  if (entry.type === "assistant" && Array.isArray(content)) {
    return content.flatMap((part) => {
      if (part.type === "tool_use") return [{ at, kind: "tool", name: part.name, role: "assistant", summary: toolSummary(part.name, part.input) }];
      if (part.type === "text" && part.text?.trim()) return [{ at, kind: "message", role: "assistant", summary: cut(part.text) }];
      return [];
    });
  }
  if (entry.type === "user" && typeof content === "string") {
    const injected = claudeInjected(content, entry.isMeta);
    if (injected === null) return [{ at, kind: "message", role: "user", summary: cut(content) }];
    return injected ? [{ at, kind: "turn", summary: injected }] : [];
  }
  if (entry.type === "user" && Array.isArray(content)) {
    return content
      .filter((part) => part.type === "tool_result")
      .map((part) => ({ at, kind: "result", summary: `${part.is_error ? "error: " : ""}${oneLine(contentText(part.content))}` }));
  }
  return [];
}

// Context Codex injects as user messages; not something the human said.
const CODEX_CONTEXT = /^\s*(# AGENTS\.md instructions|<environment_context>|<user_instructions>|<permissions|<collaboration_mode>)/u;

// Codex code-mode `exec` input is a script; show the command or the patched file it runs.
function codexExecSummary(name, input) {
  const text = String(input ?? "");
  const command = text.match(/\bcmd:\s*"((?:\\.|[^"\\])*)"/u)?.[1];
  if (command) return `${name}: ${oneLine(command.replace(/\\"/gu, '"'))}`;
  const patched = text.match(/\*\*\* (Add|Update|Delete) File: ([^\\\n]+)/u);
  if (patched) return `${name}: apply_patch ${patched[1].toLowerCase()} ${patched[2].trim()}`;
  return toolSummary(name, text);
}

function codexItems(entry) {
  const at = entry.timestamp ?? null;
  const payload = entry.payload ?? {};
  if (entry.type === "event_msg" && payload.type === "task_started") return [{ at, kind: "turn", summary: "turn started" }];
  if (entry.type === "event_msg" && payload.type === "task_complete") return [{ at, kind: "turn", summary: "turn complete" }];
  if (entry.type !== "response_item") return [];
  if (payload.type === "message" && (payload.role === "assistant" || payload.role === "user")) {
    const text = contentText(payload.content);
    if (!text.trim() || (payload.role === "user" && CODEX_CONTEXT.test(text))) return [];
    // A Stop-hook continuation arrives as a user message wrapped in <hook_prompt>: a turn marker.
    const hook = payload.role === "user" ? text.match(/^\s*<hook_prompt\b[^>]*>([\s\S]*?)(<\/hook_prompt>|$)/u) : null;
    if (hook) return [{ at, kind: "turn", summary: `role prompt: ${oneLine(hook[1])}` }];
    return [{ at, kind: "message", role: payload.role, summary: cut(text) }];
  }
  if (payload.type === "function_call") {
    let input = payload.arguments;
    try {
      input = JSON.parse(payload.arguments);
    } catch {}
    return [{ at, kind: "tool", name: payload.name, role: "assistant", summary: toolSummary(payload.name, input) }];
  }
  if (payload.type === "custom_tool_call" || payload.type === "local_shell_call") {
    const name = payload.name ?? "shell";
    return [
      {
        at,
        kind: "tool",
        name,
        role: "assistant",
        summary: typeof payload.input === "string" ? codexExecSummary(name, payload.input) : toolSummary(name, payload.action?.command),
      },
    ];
  }
  if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
    const output = typeof payload.output === "string" ? payload.output : contentText(payload.output);
    return [{ at, kind: "result", summary: oneLine(output) }];
  }
  return [];
}

// Newest first, at most MAX_ITEMS. Returns null when the transcript cannot be read.
export function readActivity(file, platform, { bytes = TAIL_BYTES } = {}) {
  if (!file) return null;
  const lines = readTailLines(file, bytes);
  if (!lines) return null;
  const toItems = platform === "codex" ? codexItems : claudeItems;
  return lines.map(parse).filter(Boolean).flatMap(toItems).slice(-MAX_ITEMS).toReversed();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// The driver's transcript as the skill recorded it (`implementation_loop.driver_transcript_path`).
export function driverTranscriptPath(epicDir) {
  const loop = readJson(path.join(epicDir, ".runtime", "runtime-state.json"))?.implementation_loop;
  return typeof loop?.driver_transcript_path === "string" && loop.driver_transcript_path ? loop.driver_transcript_path : null;
}

// The activity section's model: the current role, the platform from `.epic-loop/.runtime/platform.json`
// (never guessed from the transcript), and the feed items (empty when there is nothing to read).
export function readEpicActivity(root, epicDir) {
  const loop = readJson(path.join(epicDir, ".runtime", "runtime-state.json"))?.implementation_loop ?? null;
  const platform = readJson(path.join(root, ".epic-loop", ".runtime", "platform.json"))?.platform ?? null;
  const transcript = driverTranscriptPath(epicDir);
  // Paths inside the project read shorter without the project root.
  const prefix = `${root.replace(/\/+$/u, "")}/`;
  const items = (readActivity(transcript, platform) ?? []).map((item) => ({ ...item, summary: item.summary.split(prefix).join("") }));
  return { items, platform, role: loop?.current_role ?? null, transcript };
}
