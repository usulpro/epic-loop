import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Presentation-layer translation of the epic app (Phase 5 Task 5, D9, D28). Files on disk stay
// English; a background headless CLI on a cheap model translates docs (whole markdown sources) and
// home segments (short texts, batched as JSON). One process at a time per server, behind a queue
// with identical pending jobs deduplicated. Nothing runs in an agent session.
//
// Cache, per epic and language, under .epic-loop/epics/<slug>/.runtime/translations/<lang>/:
//   docs/<key>.md           a translated doc; key = sha256(prompt version, lang, source text)
//   docs/<key>.rejected     a translation that failed validation: English is served, no retry
//   segments.json           { <segment key>: { source, text } | { source, rejected } }
//   jobs.jsonl              one line per job: at, kind, key, platform, model, ms, ok | reason
// The event stream watches jobs.jsonl and tells open pages `event: translated`.

export const PROMPT_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_BATCH = 150;

export const hashKey = (...parts) => createHash("sha256").update(parts.join("\n")).digest("hex");

function languageName(lang) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function translationsDir(epicDir, lang) {
  return path.join(epicDir, ".runtime", "translations", lang);
}

function readPlatform(root) {
  return readJson(path.join(root, ".epic-loop", ".runtime", "platform.json"), null)?.platform ?? null;
}

// The headless command per platform. The prompt goes to stdin; Codex writes its last message to a file.
export function translatorCommand(platform, scratch, env = process.env) {
  if (platform === "codex") {
    const model = env.EPIC_LOOP_TRANSLATE_CODEX_MODEL || "gpt-6-luna";
    const output = path.join(scratch, "last-message.txt");
    return {
      args: [
        "exec",
        "-m",
        model,
        "-c",
        'model_reasoning_effort="low"',
        "-s",
        "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color",
        "never",
        "-C",
        scratch,
        "-o",
        output,
        "-",
      ],
      bin: env.EPIC_LOOP_CODEX_BIN || "codex",
      model,
      output,
    };
  }
  const model = env.EPIC_LOOP_TRANSLATE_CLAUDE_MODEL || "haiku";
  return {
    args: ["-p", "--model", model, "--tools", "", "--output-format", "text", "--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands"],
    bin: env.EPIC_LOOP_CLAUDE_BIN || "claude",
    model,
    output: null,
  };
}

export function docPrompt(lang, text) {
  return [
    `Translate the Markdown document below from English into ${languageName(lang)} (${lang}).`,
    "Rules:",
    "- Output only the translated Markdown: no preface, no notes, no code fence around it.",
    "- Keep the Markdown structure exactly: headings, lists, tables, blank lines, emphasis.",
    "- Never change inline code, fenced code blocks, link targets (the URL or path in parentheses), file paths, numbers and dates.",
    "- Never change ids such as D16, T3, H2, R5, Q7 or D-16; keep each one where it is.",
    "- Translate prose, headings, list items, table cells and link texts.",
    "",
    "<document>",
    text,
    "</document>",
  ].join("\n");
}

export function segmentsPrompt(lang, object) {
  return [
    `Translate every value of the JSON object below from English into ${languageName(lang)} (${lang}).`,
    "Rules:",
    "- Output only the JSON object with the same keys, nothing else.",
    "- These are short labels and titles from a software project dashboard; keep them short.",
    "- Never change ids such as D16, T3, H2, R5, Q7 or D-16, code, file paths and numbers.",
    "",
    JSON.stringify(object, null, 2),
  ].join("\n");
}

// Strips a code fence or <document> wrapper a model may add around its answer.
export function cleanDocOutput(output) {
  let text = String(output ?? "").trim();
  const fenced = text.match(/^```[\w-]*\n([\s\S]*)\n```$/u);
  if (fenced) text = fenced[1];
  const wrapped = text.match(/^<document>\n?([\s\S]*?)\n?<\/document>$/u);
  if (wrapped) text = wrapped[1];
  return `${text.trim()}\n`;
}

export function parseSegmentsOutput(output) {
  const text = String(output ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Runs one headless process: stdin prompt, a timeout that kills the whole process group, a scratch cwd.
function runProcess(platform, prompt, timeoutMs) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-translate-"));
  const command = translatorCommand(platform, scratch);
  const env = { ...process.env };
  // A server started from inside an agent session must not make the translator a nested session.
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let output = stdout;
      if (result.ok && command.output) output = fs.existsSync(command.output) ? fs.readFileSync(command.output, "utf8") : "";
      fs.rmSync(scratch, { force: true, recursive: true });
      resolve({ ...result, model: command.model, output });
    };
    let child;
    try {
      child = spawn(command.bin, command.args, { cwd: scratch, detached: true, env, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      finish({ ok: false, reason: `spawn failed: ${error.message}` });
      return;
    }
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      finish({ ok: false, reason: `timeout after ${timeoutMs} ms` });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => finish({ ok: false, reason: `spawn failed: ${error.message}` }));
    child.on("close", (code) => finish(code === 0 ? { ok: true } : { ok: false, reason: `exit ${code}: ${stderr.trim().split("\n").at(-1) ?? ""}`.trim() }));
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

// `validateDoc(source, translated)` returns null when the translation keeps code, links and ids,
// or a reason. `segmentIds(text)` lists the id mentions a segment must keep.
export function createTranslator({ root, validateDoc, segmentIds, timeoutMs }) {
  const limit = Number(timeoutMs ?? process.env.EPIC_LOOP_TRANSLATE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const queue = [];
  const pending = new Set();
  let running = false;

  function logJob(dir, entry) {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "jobs.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  }

  async function runDoc(job) {
    const started = Date.now();
    const result = await runProcess(job.platform, docPrompt(job.lang, job.text), limit);
    const docsDir = path.join(job.dir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const translated = result.ok ? cleanDocOutput(result.output) : null;
    const reason = result.ok ? validateDoc(job.text, translated) : result.reason;
    if (reason) fs.writeFileSync(path.join(docsDir, `${job.key}.rejected`), `${reason}\n`);
    else fs.writeFileSync(path.join(docsDir, `${job.key}.md`), translated);
    logJob(job.dir, {
      doc: job.doc,
      key: job.key,
      kind: "doc",
      ms: Date.now() - started,
      model: result.model,
      platform: job.platform,
      ...(reason ? { ok: false, reason } : { ok: true }),
    });
  }

  async function runSegments(job) {
    const started = Date.now();
    const input = Object.fromEntries(job.items.map((item, index) => [`s${index + 1}`, item.source]));
    const result = await runProcess(job.platform, segmentsPrompt(job.lang, input), limit);
    const parsed = result.ok ? parseSegmentsOutput(result.output) : null;
    const file = path.join(job.dir, "segments.json");
    const cache = readJson(file, {});
    let rejected = 0;
    job.items.forEach((item, index) => {
      const text = parsed?.[`s${index + 1}`];
      const same = typeof text === "string" && text.trim() && segmentIds(text).join(" ") === segmentIds(item.source).join(" ");
      if (same) cache[item.key] = { source: item.source, text: text.trim() };
      else if (parsed) {
        cache[item.key] = { rejected: true, source: item.source };
        rejected += 1;
      }
    });
    fs.mkdirSync(job.dir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(cache, null, 1)}\n`);
    const reason = !result.ok ? result.reason : !parsed ? "output is not a JSON object" : rejected ? `${rejected} segment(s) rejected` : null;
    logJob(job.dir, {
      count: job.items.length,
      key: job.key,
      kind: "segments",
      ms: Date.now() - started,
      model: result.model,
      ok: !reason,
      platform: job.platform,
      ...(reason ? { reason } : {}),
    });
  }

  async function pump() {
    if (running) return;
    const job = queue.shift();
    if (!job) return;
    running = true;
    try {
      await (job.kind === "doc" ? runDoc(job) : runSegments(job));
    } catch (error) {
      try {
        logJob(job.dir, { key: job.key, kind: job.kind, ok: false, reason: `internal: ${error.message}` });
      } catch {}
    } finally {
      pending.delete(`${job.kind}:${job.dir}:${job.key}`);
      running = false;
      pump();
    }
  }

  function enqueue(job) {
    const id = `${job.kind}:${job.dir}:${job.key}`;
    if (pending.has(id)) return;
    pending.add(id);
    queue.push(job);
    pump();
  }

  return {
    // A translated doc text, `{ rejected }`, or null after queueing the job (a cache miss).
    doc(epicDir, lang, doc, text) {
      const dir = translationsDir(epicDir, lang);
      const key = hashKey(PROMPT_VERSION, lang, text);
      const file = path.join(dir, "docs", `${key}.md`);
      if (fs.existsSync(file)) return { text: fs.readFileSync(file, "utf8") };
      const rejected = path.join(dir, "docs", `${key}.rejected`);
      if (fs.existsSync(rejected)) return { rejected: fs.readFileSync(rejected, "utf8").trim() };
      const platform = readPlatform(root);
      if (!platform) return { rejected: "no platform configured" };
      enqueue({ dir, doc, key, kind: "doc", lang, platform, text });
      return null;
    },
    // The cached translations of `sources` as a Map, queueing one batch job for the missing ones.
    segments(epicDir, lang, sources) {
      const dir = translationsDir(epicDir, lang);
      const cache = readJson(path.join(dir, "segments.json"), {});
      const found = new Map();
      const missing = [];
      for (const source of new Set(sources)) {
        const key = hashKey(PROMPT_VERSION, lang, source);
        const entry = cache[key];
        if (entry?.text) found.set(source, entry.text);
        else if (!entry?.rejected) missing.push({ key, source });
      }
      const platform = readPlatform(root);
      if (missing.length && platform) {
        const items = missing.slice(0, MAX_BATCH);
        enqueue({ dir, items, key: hashKey(...items.map((item) => item.key)), kind: "segments", lang, platform });
      }
      return { found, missing: missing.length };
    },
    idle: () => !running && queue.length === 0,
  };
}
