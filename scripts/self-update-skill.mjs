import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, "plugins", "epic-loop", "skills", "epic-loop");

const codexRoot = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(root, ".codex");
const claudeRoot = process.env.CLAUDE_HOME
  ? path.resolve(process.env.CLAUDE_HOME)
  : path.join(root, ".claude");

const destinations = [
  path.join(codexRoot, "skills", "epic-loop"),
  path.join(claudeRoot, "skills", "epic-loop"),
];

await assertDirectory(source, "source skill");

for (const destination of destinations) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true, errorOnExist: false });
  console.log(`Updated ${destination}`);
}

console.log("epic-loop skill synced for Codex and Claude Code.");

async function assertDirectory(dir, label) {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch (error) {
    throw new Error(`Cannot read ${label} at ${dir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
