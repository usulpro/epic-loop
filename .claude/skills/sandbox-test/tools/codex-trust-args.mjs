// Prints two NUL-separated `-c` values that pre-trust a sandbox for one Codex run without editing ~/.codex/config.toml:
// hook trust (`hooks.state={...}`) and project trust (`projects={...}`). Usage: node codex-trust-args.mjs <abs hooks.json> <abs project dir>
import { execFileSync } from 'node:child_process';
const [hooksJson, projectDir] = process.argv.slice(2);
const out = execFileSync('node', [new URL('./codex-hook-hash.mjs', import.meta.url).pathname, hooksJson], { encoding: 'utf8' });
const re = /\[hooks\.state\."(.+?)"\]\ntrusted_hash = "(.+?)"/g;
const entries = [...out.matchAll(re)].map(m => `${JSON.stringify(m[1])}={trusted_hash=${JSON.stringify(m[2])}}`);
process.stdout.write(`hooks.state={${entries.join(',')}}\0projects={${JSON.stringify(projectDir)}={trust_level="trusted"}}`);
