import { existsSync } from 'node:fs';
import path from 'node:path';

export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    if (existsSync(path.join(dir, '.epic-loop'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}
