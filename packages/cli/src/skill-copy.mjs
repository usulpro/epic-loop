import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Replaces `targetDir` with a copy of `sourceDir` without ever leaving a half-written
// skill in place: a hook firing mid-update sees either the old or the new copy.
export function copySkillAtomically(sourceDir, targetDir) {
  const staging = `${targetDir}.epic-loop-staging-${process.pid}`;
  const backup = `${targetDir}.epic-loop-backup-${process.pid}`;

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.rmSync(staging, { force: true, recursive: true });
  fs.cpSync(sourceDir, staging, {
    filter: (entry) => path.basename(entry) !== ".runtime",
    recursive: true,
  });

  if (!fs.existsSync(targetDir)) {
    fs.renameSync(staging, targetDir);
    return;
  }

  fs.renameSync(targetDir, backup);
  try {
    fs.renameSync(staging, targetDir);
  } catch (error) {
    fs.renameSync(backup, targetDir);
    fs.rmSync(staging, { force: true, recursive: true });
    throw error;
  }

  const backupRuntime = path.join(backup, ".runtime");
  if (fs.existsSync(backupRuntime)) {
    fs.renameSync(backupRuntime, path.join(targetDir, ".runtime"));
  }
  fs.rmSync(backup, { force: true, recursive: true });
}
