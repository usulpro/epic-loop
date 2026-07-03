import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { findProjectRoot } from './project-root.mjs';
import { listEpics } from './epics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(`epic-loop v${pkg.version}`);
  process.exit(0);
}

const projectRoot = findProjectRoot(process.cwd());

if (!projectRoot) {
  console.error('No epic-loop project found (no .epic-loop directory in this or any parent directory).');
  process.exit(1);
}

const epics = listEpics(projectRoot);

if (epics.length === 0) {
  console.log(`epic-loop project found at ${projectRoot}, but it has no epics yet.`);
  process.exit(0);
}

console.log(`epic-loop project: ${projectRoot}\n`);

for (const epic of epics) {
  let line = `${epic.slug} | ${epic.title} | mode: ${epic.mode}`;

  if (epic.implementationLoop) {
    const { currentRole, nextRole, status } = epic.implementationLoop;
    line += ` | loop: ${status ?? 'unknown'} (current: ${currentRole ?? '-'}, next: ${nextRole ?? '-'})`;
  }

  console.log(line);
}
