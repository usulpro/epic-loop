import { cpSync, rmSync } from "node:fs";
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
