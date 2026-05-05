import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"];
export const MODES = ["shaping", "implementation", "review", "reset"];
export const CODEX_HOOKS_RELATIVE_PATH = path.join(".codex", "hooks.json");
export const CODEX_CONFIG_RELATIVE_PATH = path.join(".codex", "config.toml");

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "+00:00");
}

export function eventTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

export function slugify(value) {
  const slug = transliterate(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");

  if (slug) {
    return slug;
  }

  const fallback = new Date().toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
  return `epic-${fallback}`;
}

export function epicSlugify(value) {
  return slugify(value)
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .join("-")
    .slice(0, 30)
    .replace(/-+$/u, "");
}

function transliterate(value) {
  const map = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return value
    .split("")
    .map((char) => map[char.toLowerCase()] ?? char)
    .join("");
}

export function titleFromDescription(description) {
  const words = String(description ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 8);

  if (words.length === 0) {
    return "Untitled Epic";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function expandHome(value) {
  const input = String(value ?? ".");
  if (input === "~") {
    return process.env.HOME ?? input;
  }
  if (input.startsWith("~/")) {
    return path.join(process.env.HOME ?? "~", input.slice(2));
  }
  return input;
}

export function resolveRoot(value) {
  return path.resolve(expandHome(value ?? "."));
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeOnce(filePath, content) {
  if (!fs.existsSync(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  }
}

export function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readJsonStrict(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      error: null,
      exists: false,
      value: null,
    };
  }

  try {
    return {
      error: null,
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf8")),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      exists: true,
      value: null,
    };
  }
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

export function appendGitignore(root) {
  const gitignorePath = path.join(root, ".gitignore");
  const requiredLines = [".epic-loop/"];

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${requiredLines.join("\n")}\n`, "utf8");
    return;
  }

  let content = fs.readFileSync(gitignorePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const missingLines = requiredLines.filter((line) => !lines.includes(line));
  if (missingLines.length === 0) {
    return;
  }

  const suffix = lines.length === 0 || lines.at(-1) === "" ? "" : "\n";
  content = `${content}${suffix}${missingLines.join("\n")}\n`;
  fs.writeFileSync(gitignorePath, content, "utf8");
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const rawName = arg.slice(2);
    if (rawName.startsWith("no-")) {
      flags[rawName] = true;
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[rawName] = true;
      continue;
    }

    flags[rawName] = next;
    index += 1;
  }

  return { flags, positionals };
}

export function requireFlag(flags, name) {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required --${name}.`);
  }
  return value;
}

export function canWritePath(targetPath) {
  let existingPath = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
  while (!fs.existsSync(existingPath) && path.dirname(existingPath) !== existingPath) {
    existingPath = path.dirname(existingPath);
  }

  try {
    fs.accessSync(existingPath, fs.constants.W_OK);
    return {
      ok: true,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function canReadPath(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return {
      ok: true,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function sessionRoot(projectRoot) {
  return path.join(projectRoot, ".epic-loop");
}

export function epicsRoot(projectRoot) {
  return path.join(sessionRoot(projectRoot), "epics");
}

export function readCurrentCodexSession(projectRoot) {
  const candidates = [];
  const capturePath = path.join(projectRoot, ".codex", "tmp", "last-hook-capture.json");
  const capture = readJson(capturePath, null);
  const payload = capture && typeof capture === "object" && capture.payload && typeof capture.payload === "object" ? capture.payload : null;

  if (payload && payload.cwd === projectRoot && typeof payload.session_id === "string") {
    candidates.push({
      captured_at: capture.capturedAt ?? null,
      hook_event_name: payload.hook_event_name ?? null,
      prompt: payload.prompt ?? null,
      session_id: payload.session_id,
      source: "hook-capture",
      transcript_path: payload.transcript_path ?? null,
      turn_id: payload.turn_id ?? null,
      updated_at_ms: getMtimeMs(payload.transcript_path) ?? parseDateMs(capture.capturedAt) ?? 0,
    });
  }

  const latestTranscriptSession = findLatestCodexTranscriptSession(projectRoot);
  if (latestTranscriptSession) {
    candidates.push(latestTranscriptSession);
  }

  candidates.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  return candidates[0] ?? null;
}

function findLatestCodexTranscriptSession(projectRoot) {
  const sessionsRoot = path.join(process.env.HOME ?? "", ".codex", "sessions");
  const searchRoots = recentSessionDateRoots(sessionsRoot);
  const candidates = [];

  for (const searchRoot of searchRoots) {
    for (const filePath of walkJsonlFiles(searchRoot)) {
      const session = readSessionMetaCandidate(filePath, projectRoot);
      if (session) {
        candidates.push(session);
      }
    }
  }

  candidates.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  return candidates[0] ?? null;
}

function recentSessionDateRoots(sessionsRoot) {
  const roots = [];
  const now = new Date();

  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    roots.push(path.join(sessionsRoot, year, month, day));
  }

  return roots.filter((root) => fs.existsSync(root));
}

function walkJsonlFiles(dirPath) {
  const files = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonlFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(entryPath);
    }
  }

  return files;
}

function readSessionMetaCandidate(filePath, projectRoot) {
  const firstLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).slice(0, 20);

  for (const line of firstLines) {
    if (!line.trim()) {
      continue;
    }

    const item = readJsonLine(line);
    if (!item || item.type !== "session_meta" || !item.payload || item.payload.cwd !== projectRoot || typeof item.payload.id !== "string") {
      continue;
    }

    return {
      captured_at: item.timestamp ?? null,
      hook_event_name: null,
      prompt: null,
      session_id: item.payload.id,
      source: "transcript-session-meta",
      transcript_path: filePath,
      turn_id: null,
      updated_at_ms: getMtimeMs(filePath) ?? parseDateMs(item.timestamp) ?? 0,
    };
  }

  return null;
}

function readJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getMtimeMs(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function parseDateMs(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}

export function runCli(fn) {
  try {
    fn();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
