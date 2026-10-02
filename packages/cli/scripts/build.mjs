import { build } from "esbuild";
import { chmodSync, cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const outfile = "dist/epic-loop.mjs";
const skillSource = path.join("..", "..", "plugins", "epic-loop", "skills", "epic-loop");
const skillTarget = "skill";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const wrapper = readFileSync(path.join(skillSource, "scripts", "epic-loop.mjs"), "utf8");
const skillVersion = wrapper.match(/^const SKILL_VERSION = "([^"]+)";$/mu)?.[1];

if (skillVersion !== version) {
  console.error(`Skill wrapper pins ${skillVersion ?? "no version"} but the package is ${version}. Run \`pnpm run release <version>\` at the repo root.`);
  process.exit(1);
}

await build({
  entryPoints: ["src/cli.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  banner: { js: "#!/usr/bin/env node" },
});

chmodSync(outfile, 0o755);
console.log(`Built ${outfile}`);

rmSync(skillTarget, { force: true, recursive: true });
cpSync(skillSource, skillTarget, {
  filter: (entry) => path.basename(entry) !== ".runtime",
  recursive: true,
});
console.log(`Copied skill ${version} into ${skillTarget}/`);
