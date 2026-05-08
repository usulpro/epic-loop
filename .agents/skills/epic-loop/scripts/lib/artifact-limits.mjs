import fs from "node:fs";
import path from "node:path";

import { epicsRoot, resolveRoot } from "./common.mjs";

const DEFAULT_MAX_LINES = 900;
const READABLE_EXTENSIONS = new Set([".md", ".mdx"]);

export function checkEpicArtifactLimits(flags = {}) {
  const root = resolveRoot(flags.root);
  const maxLinesRaw = typeof flags.maxLines === "string" ? Number(flags.maxLines) : DEFAULT_MAX_LINES;
  const maxLines = Number.isFinite(maxLinesRaw) && maxLinesRaw > 0 ? Math.floor(maxLinesRaw) : DEFAULT_MAX_LINES;
  const slug = typeof flags.slug === "string" && flags.slug.trim() ? flags.slug.trim() : null;
  const epicSlugs = slug ? [slug] : listEpicSlugs(root);
  const violations = [];

  for (const epicSlug of epicSlugs) {
    const epicDir = path.join(epicsRoot(root), epicSlug);
    if (!fs.existsSync(epicDir)) {
      continue;
    }

    for (const filePath of listReadableFiles(epicDir)) {
      const lineCount = countLines(filePath);
      if (lineCount > maxLines) {
        violations.push({
          file: path.relative(root, filePath),
          lines: lineCount,
          suggestion: suggestSplitPath(filePath, epicDir),
        });
      }
    }
  }

  if (flags.json) {
    console.log(JSON.stringify({ maxLines, slug, violations }, null, 2));
    if (violations.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (violations.length === 0) {
    console.log(`Epic artifact limits OK (max ${maxLines} lines).`);
    return;
  }

  console.log(`Epic artifact limit violations (max ${maxLines} lines):`);
  for (const violation of violations) {
    console.log(`- ${violation.file}: ${violation.lines} lines`);
    console.log(`  Split suggestion: ${violation.suggestion}`);
  }
  process.exitCode = 1;
}

function listEpicSlugs(root) {
  const dir = epicsRoot(root);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== ".runtime")
    .map((entry) => entry.name);
}

function listReadableFiles(epicDir) {
  const files = [];

  walk(epicDir, files);
  return files;
}

function walk(currentDir, files) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === ".runtime") {
      continue;
    }

    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, files);
      continue;
    }

    if (READABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
}

function countLines(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/u).length;
}

function suggestSplitPath(filePath, epicDir) {
  const relative = path.relative(epicDir, filePath);
  const dir = path.dirname(relative);
  const base = path.basename(relative, path.extname(relative));
  const partBaseDir = dir === "." ? base : path.join(dir, base);
  return [
    `split into ${path.join(partBaseDir, "part-1.md")} and ${path.join(partBaseDir, "part-2.md")}`,
    `add a short ${path.join(partBaseDir, "index.md")} cross-reference file`,
  ].join("; ");
}
