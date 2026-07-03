import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

const outfile = 'dist/epic-loop.mjs';

await build({
  entryPoints: ['src/cli.mjs'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  banner: { js: '#!/usr/bin/env node' },
});

chmodSync(outfile, 0o755);

console.log(`Built ${outfile}`);
