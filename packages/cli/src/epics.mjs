import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function readJsonSafe(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readTitleFromState(statePath) {
  if (!existsSync(statePath)) {
    return null;
  }

  const match = readFileSync(statePath, 'utf8').match(/^Epic:\s*(.+)$/mu);
  return match?.[1]?.trim() || null;
}

function readModeFromState(statePath) {
  if (!existsSync(statePath)) {
    return null;
  }

  const match = readFileSync(statePath, 'utf8').match(/^Current mode:\s*(.+)$/mu);
  return match?.[1]?.trim() || null;
}

function readEpicSummary(epicsDir, slug) {
  const epicDir = path.join(epicsDir, slug);
  const statePath = path.join(epicDir, 'state-of-epic.md');
  const runtime = readJsonSafe(path.join(epicDir, '.runtime', 'runtime-state.json')) ?? {};

  const title = runtime.title || readTitleFromState(statePath) || slug;
  const mode = runtime.mode || readModeFromState(statePath) || 'unknown';

  const loop = runtime.implementation_loop ?? null;
  const implementationLoop = mode === 'implementation' && loop
    ? {
        currentRole: loop.current_role ?? null,
        nextRole: loop.next_role ?? null,
        status: loop.status ?? null,
      }
    : null;

  return { slug, title, mode, implementationLoop };
}

export function listEpics(projectRoot) {
  const epicsDir = path.join(projectRoot, '.epic-loop', 'epics');

  if (!existsSync(epicsDir)) {
    return [];
  }

  return readdirSync(epicsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readEpicSummary(epicsDir, entry.name))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
