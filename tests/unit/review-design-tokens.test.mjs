import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { copyReviewRuntime } from "../../packages/cli/scripts/copy-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageRoot = path.join(repoRoot, "packages", "cli");
const runtimeDir = path.join(packageRoot, "src", "review", "runtime");
const tokensCss = fs.readFileSync(path.join(runtimeDir, "tokens.css"), "utf8");

function block(selector) {
  const start = tokensCss.indexOf(selector);
  assert.notEqual(start, -1, `tokens.css has no block for ${selector}`);
  const open = tokensCss.indexOf("{", start);
  return tokensCss.slice(open + 1, tokensCss.indexOf("}", open));
}

function colors(body) {
  return Object.fromEntries([...body.matchAll(/--(color-[a-z-]+):\s*([^;]+);/gu)].map(([, name, value]) => [name, value.trim()]));
}

function rgb(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/iu);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const fn = value.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/u);
  assert.ok(fn, `unsupported colour value ${value}`);
  return [Number(fn[1]), Number(fn[2]), Number(fn[3]), Number(fn[4])];
}

// Alpha colours (the scrim) are composited over the page background.
function opaque(value, background) {
  const [r, g, b, a = 1] = rgb(value);
  const [br, bg, bb] = rgb(background);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

function luminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const shared = colors(block(":root {"));
const themes = {
  light: { ...shared, ...colors(block(':root[data-theme="light"]')) },
  dark: { ...shared, ...colors(block(':root[data-theme="dark"]')) },
};

// [foreground, background, minimum]: 4.5 for text, 3 for UI components and focus indicators.
const TEXT = 4.5;
const UI = 3;
const pairs = [
  ["color-text", "color-bg", TEXT],
  ["color-text", "color-surface", TEXT],
  ["color-text", "color-raised", TEXT],
  ["color-text", "color-sunken", TEXT],
  ["color-text", "color-accent-tint", TEXT],
  ["color-text-muted", "color-bg", TEXT],
  ["color-text-muted", "color-surface", TEXT],
  ["color-text-muted", "color-raised", TEXT],
  ["color-text-muted", "color-sunken", TEXT],
  ["color-text-faint", "color-raised", TEXT],
  ["color-text-faint", "color-surface", TEXT],
  ["color-accent", "color-bg", TEXT],
  ["color-accent", "color-surface", TEXT],
  ["color-accent", "color-raised", TEXT],
  ["color-accent", "color-accent-tint", TEXT],
  ["color-accent-fg", "color-accent", TEXT],
  ["color-recommended", "color-raised", TEXT],
  ["color-recommended", "color-recommended-tint", TEXT],
  ["color-danger", "color-raised", TEXT],
  ["color-danger", "color-surface", TEXT],
  ["color-danger", "color-danger-tint", TEXT],
  ["color-info", "color-raised", TEXT],
  ["color-on-scrim", "color-scrim", TEXT],
  ["color-focus", "color-bg", UI],
  ["color-focus", "color-surface", UI],
  ["color-focus", "color-raised", UI],
  ["color-rule-strong", "color-raised", UI],
  ["color-accent", "color-raised", UI],
  ["color-danger", "color-raised", UI],
  ["color-recommended", "color-raised", UI],
];

for (const [theme, tokens] of Object.entries(themes)) {
  test(`review design tokens meet WCAG AA contrast in the ${theme} theme`, (t) => {
    const failures = [];
    for (const [fg, bg, min] of pairs) {
      assert.ok(tokens[fg] && tokens[bg], `${theme}: missing ${fg} or ${bg}`);
      const background = opaque(tokens[bg], tokens["color-bg"]);
      const ratio = contrast(opaque(tokens[fg], tokens["color-bg"]), background);
      t.diagnostic(`${theme} ${fg} on ${bg}: ${ratio.toFixed(2)} (min ${min})`);
      if (ratio < min) failures.push(`${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
    }
    assert.deepEqual(failures, []);
  });
}

test("the OS dark block and the forced dark block define the same colours", () => {
  const media = colors(block(':root:not([data-theme="light"])'));
  assert.deepEqual(media, colors(block(':root[data-theme="dark"]')));
});

test("both themes define the same colour tokens", () => {
  assert.deepEqual(Object.keys(colors(block(':root[data-theme="light"]'))).sort(), Object.keys(colors(block(':root[data-theme="dark"]'))).sort());
});

test("the specimen lists every colour token", () => {
  const specimen = fs.readFileSync(path.join(runtimeDir, "specimen.html"), "utf8");
  for (const name of Object.keys(themes.light)) assert.ok(specimen.includes(`--${name}`), `specimen misses --${name}`);
});

test("the build copies the review runtime next to the bundled entry", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-runtime-"));
  try {
    fs.cpSync(path.join(packageRoot, "src", "review"), path.join(temp, "src", "review"), { recursive: true });
    const target = copyReviewRuntime(temp);
    assert.equal(target, path.join(temp, "dist", "review", "runtime"));
    for (const file of ["tokens.css", "base.css", "specimen.html"]) assert.ok(fs.existsSync(path.join(target, file)), `dist misses ${file}`);
    assert.equal(fs.readFileSync(path.join(target, "tokens.css"), "utf8"), tokensCss);
  } finally {
    fs.rmSync(temp, { force: true, recursive: true });
  }
});
