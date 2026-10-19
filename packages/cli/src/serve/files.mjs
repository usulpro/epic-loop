import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

export function contentType(file) {
  return TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

// Resolves a URL path below base, or null when it would leave base: "..", encoded "..", absolute
// paths, NUL bytes, and symlinks pointing outside are all refused.
export function resolveInside(base, relativeUrlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(relativeUrlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\") || path.isAbsolute(decoded)) return null;
  const parts = decoded.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.some((part) => part === "..")) return null;
  const candidate = path.join(base, ...parts);
  let real;
  let realBase;
  try {
    real = fs.realpathSync(candidate);
    realBase = fs.realpathSync(base);
  } catch {
    return null;
  }
  const relative = path.relative(realBase, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return real;
}

export function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
