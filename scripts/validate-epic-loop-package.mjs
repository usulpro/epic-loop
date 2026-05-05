import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const pluginRoot = path.join(root, "plugins", "epic-loop");
const skillRoot = path.join(pluginRoot, "skills", "epic-loop");

const requiredFiles = [
  "marketplace.json",
  "plugins/epic-loop/.codex-plugin/plugin.json",
  "plugins/epic-loop/skills/epic-loop/SKILL.md",
  "plugins/epic-loop/skills/epic-loop/agents/openai.yaml",
  "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-manager-prompt.md",
  "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-techlead-prompt.md",
];

const errors = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const marketplace = readJson("marketplace.json");
const plugin = readJson("plugins/epic-loop/.codex-plugin/plugin.json");

if (marketplace) {
  const entry = Array.isArray(marketplace.plugins) ? marketplace.plugins.find((item) => item?.name === "epic-loop") : null;
  if (!entry) {
    errors.push("marketplace.json must include an epic-loop plugin entry.");
  } else {
    expectEqual(entry.source?.source, "local", "marketplace epic-loop source.source");
    expectEqual(entry.source?.path, "./plugins/epic-loop", "marketplace epic-loop source.path");
    expectEqual(entry.policy?.installation, "AVAILABLE", "marketplace epic-loop policy.installation");
    expectEqual(entry.policy?.authentication, "ON_INSTALL", "marketplace epic-loop policy.authentication");
  }
}

if (plugin) {
  expectEqual(plugin.name, "epic-loop", "plugin name");
  expectEqual(plugin.skills, "./skills/", "plugin skills path");
  if (!plugin.version || typeof plugin.version !== "string") {
    errors.push("plugin version must be a non-empty string.");
  }
}

const skill = readText("plugins/epic-loop/skills/epic-loop/SKILL.md");
if (skill) {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? "";
  expectYamlField(frontmatter, "name", "epic-loop");
  if (!/^description:\s*.+$/mu.test(frontmatter)) {
    errors.push("SKILL.md frontmatter must include a non-empty description.");
  }
  if (skill.includes(".agents/skills/epic-loop")) {
    errors.push("Packaged SKILL.md must not reference the legacy .agents/skills/epic-loop path.");
  }
  if (!skill.includes("<skill-dir>")) {
    errors.push("Packaged SKILL.md should use <skill-dir> for install-independent commands.");
  }
}

for (const relativePath of listFiles(skillRoot)) {
  const content = fs.readFileSync(relativePath, "utf8");
  const displayPath = path.relative(root, relativePath);
  if (content.includes(".agents/skills/epic-loop")) {
    errors.push(`${displayPath} references the legacy .agents/skills/epic-loop path.`);
  }
  if (content.includes("templates/implementation-") && !content.includes("assets/templates/implementation-")) {
    errors.push(`${displayPath} references implementation templates outside assets/templates.`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("epic-loop package validation passed.");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(`Cannot read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    errors.push(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function expectYamlField(frontmatter, field, expected) {
  const pattern = new RegExp(`^${field}:\\s*"?${escapeRegExp(expected)}"?\\s*$`, "mu");
  if (!pattern.test(frontmatter)) {
    errors.push(`SKILL.md frontmatter ${field} must be ${JSON.stringify(expected)}.`);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
