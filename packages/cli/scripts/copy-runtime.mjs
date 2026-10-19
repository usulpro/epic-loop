import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// The review runtime (tokens, styles, later the page runtime script) is served as static files, not
// bundled. dist/review/runtime/ mirrors src/review/runtime/ relative to the entry file, so code that
// resolves assets with new URL("./review/runtime/", import.meta.url) works from src/ and from dist/.
export function copyReviewRuntime(packageRoot, outDir = "dist") {
  const source = path.join(packageRoot, "src", "review", "runtime");
  const target = path.join(packageRoot, outDir, "review", "runtime");
  rmSync(target, { force: true, recursive: true });
  cpSync(source, target, { recursive: true });
  return target;
}

// Third-party browser files (see REVIEW_VENDOR_FILES in src/paths.mjs) copied from node_modules.
export function copyReviewVendor(packageRoot, files, outDir = "dist") {
  const target = path.join(packageRoot, outDir, "review", "runtime", "vendor");
  mkdirSync(target, { recursive: true });
  for (const [name, parts] of Object.entries(files)) {
    const source = path.join(packageRoot, "node_modules", ...parts);
    if (!existsSync(source)) throw new Error(`Missing ${source}: run pnpm install in packages/cli.`);
    cpSync(source, path.join(target, name));
  }
  return target;
}
