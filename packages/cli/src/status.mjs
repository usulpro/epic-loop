import process from "node:process";

import { listEpics } from "./epics.mjs";
import { findProjectRoot } from "./project-root.mjs";

// Zero-argument command: locate the project and list its epics.
export function runStatus() {
  const projectRoot = findProjectRoot(process.cwd());

  if (!projectRoot) {
    console.error("No epic-loop project found (no .epic-loop directory in this or any parent directory).");
    return 1;
  }

  const epics = listEpics(projectRoot);

  if (epics.length === 0) {
    console.log(`epic-loop project found at ${projectRoot}, but it has no epics yet.`);
    return 0;
  }

  console.log(`epic-loop project: ${projectRoot}\n`);

  for (const epic of epics) {
    let line = `${epic.slug} | ${epic.title} | mode: ${epic.mode}`;

    if (epic.implementationLoop) {
      const { currentRole, nextRole, status } = epic.implementationLoop;
      line += ` | loop: ${status ?? "unknown"} (current: ${currentRole ?? "-"}, next: ${nextRole ?? "-"})`;
    }

    console.log(line);
  }
  return 0;
}
