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
  const requiredLines = ["epics/", ".epic-loop/"];

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
