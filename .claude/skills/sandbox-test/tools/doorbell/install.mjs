// Installs the probe kit into a sandbox project: copies the kit to <sandbox>/.doorbell/kit, writes the
// project-local hook config for one variant, and gitignores .doorbell/. Never touches global config.
// Usage: node install.mjs --sandbox <abs dir> --host claude-code|codex --variant <variant> [--fallback] [--no-log-hooks]
//   claude-code variants: rewake-session (asyncRewake on SessionStart), rewake-event (asyncRewake on Stop),
//                         background (run_in_background waiter, no waiter hook), fallback-only
//   codex variants:       codex-queue, fallback-only
//   --fallback        also install the UserPromptSubmit fallback hook
//   --no-log-hooks    skip the passive hook logger (SessionStart, UserPromptSubmit, Stop, PreToolUse)
//   --rewake-timeout <seconds|default>  asyncRewake hook timeout (default 86400; "default" omits it, host default 600 s)
//   --rewake-pad <bytes>  pad the rewake pointer to measure the stderr size limit
// Hook commands use the absolute node binary (process.execPath), not a version-manager shim.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const sandbox = path.resolve(flags.sandbox || process.cwd());
const host = flags.host;
const variant = flags.variant;
const variants = {
  "claude-code": ["rewake-session", "rewake-event", "background", "fallback-only"],
  codex: ["codex-queue", "fallback-only"],
};
if (!variants[host]?.includes(variant)) {
  console.error(`--host claude-code|codex and --variant one of: ${JSON.stringify(variants)}`);
  process.exit(1);
}

const kitSrc = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(sandbox, ".doorbell");
const kit = path.join(dir, "kit");
fs.mkdirSync(kit, { recursive: true });
for (const file of fs.readdirSync(kitSrc)) {
  if (file.endsWith(".mjs") || file.endsWith(".md")) fs.copyFileSync(path.join(kitSrc, file), path.join(kit, file));
}

const q = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const cmd = (script, extra = "") => `${q(process.execPath)} ${q(path.join(kit, script))} --dir ${q(dir)}${extra}`;
const hook = (command, extra = {}) => ({ type: "command", command, timeout: 30, ...extra });
const hooks = {};
const add = (event, entry, matcher) => {
  hooks[event] ??= [];
  hooks[event].push(matcher === undefined ? { hooks: [entry] } : { matcher, hooks: [entry] });
};

const logEvents = host === "codex" ? ["SessionStart", "UserPromptSubmit", "Stop"] : ["SessionStart", "UserPromptSubmit", "Stop", "PreToolUse"];
if (!flags["no-log-hooks"]) for (const event of logEvents) add(event, hook(cmd("log-hook.mjs")), host === "codex" ? undefined : "");
const rewakeTimeout = flags["rewake-timeout"] === "default" ? undefined : Number(flags["rewake-timeout"] || 86400);
const pad = flags["rewake-pad"] ? ` --pad ${Number(flags["rewake-pad"])}` : "";
const rewakeHook = (form) => {
  const entry = hook(cmd("waiter.mjs", ` --mode rewake --form ${form}${pad}`), { asyncRewake: true, timeout: rewakeTimeout });
  if (rewakeTimeout === undefined) delete entry.timeout;
  return entry;
};
if (variant === "rewake-session") add("SessionStart", rewakeHook("session"), "");
if (variant === "rewake-event") add("Stop", rewakeHook("event"), "");
if (flags.fallback || variant === "fallback-only") add("UserPromptSubmit", hook(cmd("fallback-hook.mjs")), host === "codex" ? undefined : "");

let configPath;
if (host === "claude-code") {
  configPath = path.join(sandbox, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const settings = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
  settings.hooks = { ...settings.hooks };
  for (const [event, groups] of Object.entries(hooks)) settings.hooks[event] = [...(settings.hooks[event] ?? []), ...groups];
  fs.writeFileSync(configPath, `${JSON.stringify(settings, null, 2)}\n`);
} else {
  configPath = path.join(sandbox, ".codex", "hooks.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const existing = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : { hooks: {} };
  for (const [event, groups] of Object.entries(hooks)) existing.hooks[event] = [...(existing.hooks[event] ?? []), ...groups];
  fs.writeFileSync(configPath, `${JSON.stringify(existing, null, 2)}\n`);
  const toml = path.join(sandbox, ".codex", "config.toml");
  const current = fs.existsSync(toml) ? fs.readFileSync(toml, "utf8") : "";
  if (!/\bhooks\s*=\s*true/u.test(current)) fs.writeFileSync(toml, `${current}${current && !current.endsWith("\n") ? "\n" : ""}[features]\nhooks = true\n`);
}

const arm = {
  background: "Start the waiter as a background task (Bash with run_in_background): `node .doorbell/kit/waiter.mjs --mode background`. Do not wait for it or read its output now.",
  "rewake-session": "Nothing to arm: a hook already waits for the doorbell.",
  "rewake-event": "Nothing to arm: a hook arms the doorbell when your turn ends.",
  "fallback-only": "Nothing to arm: the doorbell arrives with the next human message.",
}[variant];
const probeTemplate = path.join(kitSrc, host === "codex" ? "probe-codex.md" : "probe-claude.md");
const probePath = path.join(dir, "probe.md");
fs.writeFileSync(probePath, fs.readFileSync(probeTemplate, "utf8").replace("{{ARM}}", arm ?? ""));

const gitignore = path.join(sandbox, ".gitignore");
const ignored = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, "utf8") : "";
if (!ignored.split("\n").includes(".doorbell/")) fs.appendFileSync(gitignore, `${ignored && !ignored.endsWith("\n") ? "\n" : ""}.doorbell/\n`);

console.log(JSON.stringify({ sandbox, host, variant, kit, probeDir: dir, probe: probePath, configPath, events: Object.keys(hooks) }, null, 2));
