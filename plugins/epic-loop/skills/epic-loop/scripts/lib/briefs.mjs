import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicRuntimeRoot, eventTimestamp, requireFlag, resolveRoot } from "./common.mjs";

export function writeEngineerBrief(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const runtimeDir = epicRuntimeRoot(root, slug);
  const briefPath = path.join(runtimeDir, "current-engineer-prompt.md");
  const body = readBriefBody(flags);

  if (!body.trim()) {
    throw new Error("Engineer brief body is empty.");
  }

  ensureDir(runtimeDir);
  archiveExistingBrief(briefPath, runtimeDir);
  fs.writeFileSync(briefPath, `${body.trim()}\n`, "utf8");
  console.log(path.relative(root, briefPath));
}

function readBriefBody(flags) {
  if (flags.stdin) {
    return fs.readFileSync(0, "utf8");
  }

  if (typeof flags["body-file"] === "string") {
    return fs.readFileSync(flags["body-file"], "utf8");
  }

  if (typeof flags.body === "string") {
    return flags.body;
  }

  throw new Error("Missing brief body. Use --stdin, --body-file, or --body.");
}

function archiveExistingBrief(briefPath, runtimeDir) {
  if (!fs.existsSync(briefPath)) {
    return;
  }

  const archiveDir = path.join(runtimeDir, "engineer-briefs");
  ensureDir(archiveDir);
  fs.renameSync(briefPath, path.join(archiveDir, `${eventTimestamp()}-engineer-brief.md`));
}
