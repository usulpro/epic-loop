import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  ".agents/plugins/marketplace.json",
  "plugins/epic-loop/.codex-plugin/plugin.json",
  "plugins/epic-loop/skills/epic-loop/SKILL.md",
  "plugins/epic-loop/skills/epic-loop/agents/openai.yaml",
  "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-manager-prompt.md",
  "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-techlead-prompt.md",
];

const skillEntrypointLineBudget = 500;
const referenceTocLineThreshold = 100;
const referenceTocSearchLimit = 40;

export function validateEpicLoopPackage(options = {}) {
  const root = options.root ?? process.cwd();
  const pluginRoot = path.join(root, "plugins", "epic-loop");
  const skillRoot = path.join(pluginRoot, "skills", "epic-loop");
  const skillEntrypoint = path.join(skillRoot, "SKILL.md");
  const skillName = path.basename(skillRoot);
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  const errors = [];
  const context = {
    errors,
    nodeExecutable,
    pluginRoot,
    root,
    skillEntrypoint,
    skillName,
    skillRoot,
  };

  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      errors.push(`Missing required file: ${relativePath}`);
    }
  }

  const marketplace = readJson(context, ".agents/plugins/marketplace.json");
  const plugin = readJson(context, "plugins/epic-loop/.codex-plugin/plugin.json");

  if (marketplace) {
    validateMarketplace(context, marketplace);
  }

  if (plugin) {
    validatePlugin(context, plugin);
  }

  const skill = readText(context, "plugins/epic-loop/skills/epic-loop/SKILL.md");
  if (skill) {
    validateSkill(context, skill);
  }

  validateReferenceTablesOfContents(context);
  validateSkillScripts(context);
  validateNoRuntimeArtifacts(context);
  validatePackagedText(context);
  validatePluginText(context);

  return errors;
}

function validateMarketplace(context, marketplace) {
  expectEqual(context, marketplace.name, "epic-loop", "marketplace name");

  const marketplaceDescription = marketplace.interface?.description;
  if (typeof marketplaceDescription === "string") {
    expectIncludes(context, marketplaceDescription, "Codex or Claude Code hooks", "marketplace interface.description");
    rejectIncludes(context, marketplaceDescription, "driven by Codex hooks", "marketplace interface.description");
  } else {
    context.errors.push("marketplace interface.description must be a non-empty string.");
  }

  const entry = Array.isArray(marketplace.plugins) ? marketplace.plugins.find((item) => item?.name === "epic-loop") : null;
  if (!entry) {
    context.errors.push("marketplace.json must include an epic-loop plugin entry.");
    return;
  }

  expectEqual(context, entry.source?.source, "local", "marketplace epic-loop source.source");
  expectEqual(context, entry.source?.path, "./plugins/epic-loop", "marketplace epic-loop source.path");
  expectEqual(context, entry.policy?.installation, "AVAILABLE", "marketplace epic-loop policy.installation");
  expectEqual(context, entry.policy?.authentication, "ON_INSTALL", "marketplace epic-loop policy.authentication");
}

function validatePlugin(context, plugin) {
  expectEqual(context, plugin.name, "epic-loop", "plugin name");
  expectEqual(context, plugin.skills, "./skills/", "plugin skills path");
  if (!plugin.version || typeof plugin.version !== "string") {
    context.errors.push("plugin version must be a non-empty string.");
  }
  expectIncludes(context, plugin.description, "Codex or Claude Code hooks", "plugin description");
  rejectIncludes(context, plugin.description, "driven by Codex hooks", "plugin description");
  expectIncludes(context, plugin.interface?.longDescription, "Codex or Claude Code hooks", "plugin interface.longDescription");
  rejectIncludes(context, plugin.interface?.longDescription, "driven by Codex hooks", "plugin interface.longDescription");
}

function validateSkill(context, skill) {
  validateSkillEntrypoint(context, skill);
  validateSkillLinks(context, skill);
  if (skill.includes(".agents/skills/epic-loop")) {
    context.errors.push("Packaged SKILL.md must not reference the legacy .agents/skills/epic-loop path.");
  }
  if (!skill.includes("<skill-dir>")) {
    context.errors.push("Packaged SKILL.md should use <skill-dir> for install-independent commands.");
  }
  if (!skill.includes("project-local `.claude/settings.json`")) {
    context.errors.push("Packaged SKILL.md must document project-local `.claude/settings.json` as the supported Claude Code install target.");
  }
}

function validatePackagedText(context) {
  for (const relativePath of listFiles(context.skillRoot)) {
    const content = fs.readFileSync(relativePath, "utf8");
    const displayPath = path.relative(context.root, relativePath);
    if (content.includes(".agents/skills/epic-loop")) {
      context.errors.push(`${displayPath} references the legacy .agents/skills/epic-loop path.`);
    }
    if (content.includes("templates/implementation-") && !content.includes("assets/templates/implementation-")) {
      context.errors.push(`${displayPath} references implementation templates outside assets/templates.`);
    }
    if (content.includes("${CLAUDE_PLUGIN_ROOT}")) {
      context.errors.push(`${displayPath} references ${"${CLAUDE_PLUGIN_ROOT}"} before bundled Claude Code hooks are supported.`);
    }
  }
}

function validatePluginText(context) {
  for (const absolutePath of listFiles(context.pluginRoot)) {
    const displayPath = path.relative(context.root, absolutePath);
    if (displayPath.endsWith("hooks/hooks.json")) {
      context.errors.push(`${displayPath} is a bundled Claude Code hook asset; the supported Claude Code install target is project-local .claude/settings.json.`);
    }
    const content = fs.readFileSync(absolutePath, "utf8");
    if (content.includes("${CLAUDE_PLUGIN_ROOT}")) {
      context.errors.push(`${displayPath} references ${"${CLAUDE_PLUGIN_ROOT}"} before bundled Claude Code hooks are supported.`);
    }
  }
}

function readJson(context, relativePath) {
  const absolutePath = path.join(context.root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    context.errors.push(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readText(context, relativePath) {
  const absolutePath = path.join(context.root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    context.errors.push(`Cannot read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function expectEqual(context, actual, expected, label) {
  if (actual !== expected) {
    context.errors.push(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function expectIncludes(context, actual, expected, label) {
  if (typeof actual !== "string" || !actual.includes(expected)) {
    context.errors.push(`${label} must include ${JSON.stringify(expected)}.`);
  }
}

function rejectIncludes(context, actual, rejected, label) {
  if (typeof actual === "string" && actual.includes(rejected)) {
    context.errors.push(`${label} must not include ${JSON.stringify(rejected)}.`);
  }
}

function validateSkillEntrypoint(context, content) {
  const parsed = parseSkillFrontmatter(context, content);
  const displayPath = path.relative(context.root, context.skillEntrypoint);

  if (!parsed) {
    context.errors.push(`${displayPath} must start with YAML frontmatter delimited by --- lines.`);
    return;
  }

  const { frontmatter, body } = parsed;
  const name = frontmatter.name;
  const description = frontmatter.description;

  if (typeof name !== "string" || name.length === 0) {
    context.errors.push(`${displayPath} frontmatter must include a non-empty name.`);
  } else {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(name)) {
      context.errors.push(`${displayPath} frontmatter name must be 1-64 characters of lowercase kebab-case.`);
    }
    if (name.includes("--")) {
      context.errors.push(`${displayPath} frontmatter name must not contain consecutive hyphens.`);
    }
    if (name !== context.skillName) {
      context.errors.push(`${displayPath} frontmatter name must match skill directory ${JSON.stringify(context.skillName)}.`);
    }
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    context.errors.push(`${displayPath} frontmatter must include a non-empty description.`);
  } else {
    validateSkillDescription(context, description, displayPath);
  }

  const bodyLineCount = countLines(body);
  if (bodyLineCount > skillEntrypointLineBudget) {
    context.errors.push(`${displayPath} body must stay at or below ${skillEntrypointLineBudget} lines, got ${bodyLineCount}.`);
  }
}

function parseSkillFrontmatter(context, content) {
  const match = content.match(/^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---\r?\n?(?<body>[\s\S]*)$/u);
  if (!match?.groups) {
    return null;
  }

  const frontmatter = {};
  for (const [index, line] of match.groups.frontmatter.split(/\r?\n/u).entries()) {
    if (line.trim().length === 0) {
      continue;
    }
    const fieldMatch = line.match(/^(?<key>[A-Za-z0-9_-]+):\s*(?<value>.*)$/u);
    if (!fieldMatch?.groups) {
      context.errors.push(`${path.relative(context.root, context.skillEntrypoint)} frontmatter line ${index + 2} is not a simple key/value field.`);
      continue;
    }
    frontmatter[fieldMatch.groups.key] = unquoteYamlScalar(fieldMatch.groups.value.trim());
  }

  return {
    body: match.groups.body,
    frontmatter,
  };
}

function unquoteYamlScalar(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function validateSkillDescription(context, description, displayPath) {
  if (description.length > 1024) {
    context.errors.push(`${displayPath} frontmatter description must be at most 1024 characters, got ${description.length}.`);
  }
  if (/<\/?[A-Za-z][^>]*>/u.test(description)) {
    context.errors.push(`${displayPath} frontmatter description must not contain XML-like tags.`);
  }
  if (!/\b(use|when|asks?|requested?|trigger|work|reading|editing|creating|adding|switching|resuming)\b/iu.test(description)) {
    context.errors.push(`${displayPath} frontmatter description must include concrete trigger wording, not only a generic label.`);
  }
}

function validateSkillLinks(context, content) {
  const displayPath = path.relative(context.root, context.skillEntrypoint);
  const linkPattern = /(?<!!)\[[^\]]+\]\((?<target>[^)\s]+)(?:\s+"[^"]*")?\)/gu;

  for (const match of content.matchAll(linkPattern)) {
    const target = match.groups?.target;
    if (!target || isExternalMarkdownTarget(target) || target.startsWith("#")) {
      continue;
    }
    if (target.includes("\\")) {
      context.errors.push(`${displayPath} markdown link target must use forward slashes: ${target}`);
      continue;
    }

    const targetWithoutAnchor = target.split("#")[0];
    const absoluteTarget = path.resolve(context.skillRoot, targetWithoutAnchor);
    if (!isInsidePath(context.skillRoot, absoluteTarget)) {
      context.errors.push(`${displayPath} markdown link target must stay inside the skill package: ${target}`);
      continue;
    }
    if (!fs.existsSync(absoluteTarget)) {
      context.errors.push(`${displayPath} markdown link target does not exist: ${target}`);
    }
  }
}

function isExternalMarkdownTarget(target) {
  return /^[a-z][a-z0-9+.-]*:/iu.test(target);
}

function validateReferenceTablesOfContents(context) {
  for (const absolutePath of listFiles(path.join(context.skillRoot, "references"))) {
    if (!absolutePath.endsWith(".md")) {
      continue;
    }
    const content = fs.readFileSync(absolutePath, "utf8");
    const lineCount = countLines(content);
    if (lineCount <= referenceTocLineThreshold) {
      continue;
    }

    const topLines = content.split(/\r?\n/u).slice(0, referenceTocSearchLimit).join("\n");
    if (!/^## (?:Contents|Table of Contents|TOC)\s*$/mu.test(topLines) || !/^\s*- \[[^\]]+\]\(#[^)]+\)\s*$/mu.test(topLines)) {
      context.errors.push(`${path.relative(context.root, absolutePath)} is ${lineCount} lines and must include a table of contents near the top.`);
    }
  }
}

function validateSkillScripts(context) {
  const scriptsRoot = path.join(context.skillRoot, "scripts");
  for (const absolutePath of listAllFiles(scriptsRoot)) {
    const displayPath = path.relative(context.root, absolutePath);
    if (!absolutePath.endsWith(".mjs")) {
      context.errors.push(`${displayPath} must use the .mjs extension for bundled skill scripts.`);
      continue;
    }

    const result = spawnSync(context.nodeExecutable, ["--check", absolutePath], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      const output = `${result.stderr}${result.stdout}`.trim();
      context.errors.push(`${displayPath} failed node --check${output ? `: ${output.split(/\r?\n/u)[0]}` : "."}`);
    }
  }
}

function validateNoRuntimeArtifacts(context) {
  const runtimeArtifactNames = new Set([
    ".runtime",
    ".validation-output",
    "hook-events",
    "latest-engineer-report.md",
    "latest-manager-report.md",
    "prompt-log.jsonl",
    "prompt-log.md",
    "progress-log.jsonl",
    "progress-log.md",
    "progress-report.md",
    "session-bindings.json",
    "sessions",
  ]);

  for (const absolutePath of listEntries(context.skillRoot)) {
    const name = path.basename(absolutePath);
    const displayPath = path.relative(context.root, absolutePath);
    if (runtimeArtifactNames.has(name) || /\.(log|tmp)$/u.test(name)) {
      context.errors.push(`${displayPath} looks like a runtime/debug artifact and must not be committed in the skill package.`);
    }
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }
    if (entry.isFile() && /\.(md|mjs|yaml|json)$/u.test(entry.name)) {
      return [entryPath];
    }
    return [];
  });
}

function listAllFiles(dir) {
  return listEntries(dir).filter((entry) => fs.statSync(entry).isFile());
}

function listEntries(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return [entryPath, ...listEntries(entryPath)];
    }
    if (entry.isFile()) {
      return [entryPath];
    }
    return [];
  });
}

function isInsidePath(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function countLines(content) {
  return content.length === 0 ? 0 : content.split(/\r?\n/u).length;
}

function runCli() {
  const errors = validateEpicLoopPackage();

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("epic-loop package validation passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
