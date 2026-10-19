// `epic-loop review check`: the static check of an agent-written review page. It refuses unsafe or
// broken pages, derives the answer schema into review.json, extracts translation segments into
// i18n/source.json (the same rules as the runtime, see runtime/i18n.mjs), and reports translation gaps.
import fs from "node:fs";
import path from "node:path";

import { REVIEW_RUNTIME_DIR } from "../paths.mjs";
import { writeAtomic } from "../serve/answers.mjs";
import { isName } from "../serve/reviews.mjs";
import { HtmlError, closest, parseHtml, textContent, walk } from "./html.mjs";
import { TRANSLATABLE_ATTRIBUTES, isTranslatableSegment, normalizeSegment } from "./runtime/i18n.mjs";

const CONTROL_KINDS = { "el-choice": "choice", "el-check": "check", "el-select": "select", "el-comment": "comment" };
// Not translated by the runtime: raw text, code, inline frame content, diagram source, the head.
const NO_SEGMENTS = new Set(["head", "script", "style", "textarea", "code", "pre", "template", "el-diagram"]);
// Attributes the runtime renders as visible text, translated as text nodes after upgrade.
const RENDERED_ATTRIBUTES = ["label", "caption"];
const LOADING_LINK_RELS = /\b(stylesheet|preload|prefetch|modulepreload|icon|manifest|import)\b/iu;
const EMBEDS = new Set(["iframe", "frame", "frameset", "object", "embed"]);

function issue(code, message, node) {
  return node?.line ? { code, message, line: node.line } : { code, message };
}

function describe(node) {
  const name = node.attrs.name ? ` name="${node.attrs.name}"` : "";
  return `<${node.tag}${name}>`;
}

function optionsOf(node) {
  return node.children
    .filter((child) => child.type === "element" && child.tag === "el-option")
    .map((option) => ({ value: option.attrs.value ?? normalizeSegment(textContent(option)), label: normalizeSegment(textContent(option)), node: option }));
}

// ---------- References ----------

function classify(url) {
  const value = url.trim();
  if (!value || value.startsWith("#")) return "fragment";
  if (/^(mailto|tel):/iu.test(value)) return "contact";
  if (/^data:/iu.test(value)) return "data";
  if (/^(https?:)?\/\//iu.test(value) || /^[a-z][a-z0-9+.-]*:/iu.test(value)) return "network";
  return "local";
}

function referencesOf(node) {
  const pick = (...names) => names.filter((name) => node.attrs[name] !== undefined).map((name) => ({ attr: name, url: node.attrs[name] }));
  switch (node.tag) {
    case "img":
    case "source":
    case "audio":
    case "el-shot":
    case "el-iframe":
    case "script":
    case "track":
      return pick("src");
    case "video":
      return pick("src", "poster");
    case "a":
    case "link":
      return pick("href");
    default:
      return [];
  }
}

function networkIssue(node, url) {
  const where = `${describe(node)} at ${JSON.stringify(url)}`;
  if (node.tag === "a") return null;
  if (node.tag === "el-iframe") return /^https:\/\//iu.test(url.trim()) ? null : issue("E_NETWORK_FRAME", `${where}: an el-iframe may only load https: URLs`, node);
  if (node.tag === "script") return issue("E_NETWORK_SCRIPT", `${where}: scripts must be local files; the page must not load code from the network`, node);
  if (node.tag === "link") {
    const rel = node.attrs.rel ?? "";
    if (/\bstylesheet\b/iu.test(rel)) return issue("E_NETWORK_STYLESHEET", `${where}: stylesheets must be local; the runtime styles are injected for you`, node);
    return LOADING_LINK_RELS.test(rel) ? issue("E_NETWORK_LINK", `${where}: <link rel="${rel}"> must not load from the network`, node) : null;
  }
  return issue("E_NETWORK_MEDIA", `${where}: evidence must be saved next to the page (for example assets/), not loaded from the network`, node);
}

function localIssue(dir, node, url) {
  const clean = url.trim().split(/[?#]/u)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    return issue("E_FILE_MISSING", `${describe(node)} refers to an undecodable path ${JSON.stringify(url)}`, node);
  }
  if (decoded.startsWith("/_runtime/")) {
    return fs.existsSync(path.join(REVIEW_RUNTIME_DIR, decoded.slice("/_runtime/".length)))
      ? null
      : issue("E_FILE_MISSING", `${describe(node)} refers to ${JSON.stringify(url)}, which the runtime does not provide`, node);
  }
  const target = path.resolve(dir, decoded);
  const relative = path.relative(dir, target);
  if (decoded.startsWith("/") || relative.startsWith("..") || path.isAbsolute(relative)) {
    return issue("E_FILE_OUTSIDE", `${describe(node)} refers to ${JSON.stringify(url)}, outside the review folder; copy the file into it (for example assets/)`, node);
  }
  return fs.existsSync(target) ? null : issue("E_FILE_MISSING", `${describe(node)} refers to ${JSON.stringify(url)}, which does not exist in the review folder`, node);
}

function checkReferences(dir, elements, errors) {
  for (const node of elements) {
    for (const { url } of referencesOf(node)) {
      const kind = classify(url);
      if (kind === "network") {
        const problem = networkIssue(node, url);
        if (problem) errors.push(problem);
      } else if (kind === "local" && !node.inert) {
        const problem = localIssue(dir, node, url);
        if (problem) errors.push(problem);
      }
    }
  }
}

// ---------- Structure, safety, warnings ----------

function checkControls(elements, errors) {
  const seen = new Map();
  for (const node of elements) {
    if (node.inert || !CONTROL_KINDS[node.tag]) continue;
    const name = (node.attrs.name ?? "").trim();
    if (!name) errors.push(issue("E_NAME_MISSING", `<${node.tag}> has no name; every answer control needs a unique name`, node));
    else if (seen.has(name)) errors.push(issue("E_NAME_DUPLICATE", `name "${name}" is used twice (first on line ${seen.get(name).line}); control names must be unique`, node));
    else seen.set(name, node);
    if (node.tag !== "el-choice" && node.tag !== "el-select") continue;
    const options = optionsOf(node);
    if (options.length < 2) errors.push(issue("E_OPTIONS_TOO_FEW", `${describe(node)} has ${options.length} option(s); a choice needs at least two <el-option> children`, node));
    const values = options.map((option) => option.value);
    const duplicate = values.find((value, index) => values.indexOf(value) !== index);
    if (duplicate !== undefined) errors.push(issue("E_OPTION_DUPLICATE", `${describe(node)} has the option value "${duplicate}" twice`, node));
    const recommended = node.attrs.recommended;
    if (recommended !== undefined && !values.includes(recommended))
      errors.push(issue("E_RECOMMENDED_UNKNOWN", `${describe(node)} recommends "${recommended}", which is not one of its options (${values.join(", ")})`, node));
  }
}

function checkMedia(elements, errors) {
  for (const node of elements) {
    if (node.inert) continue;
    if (node.tag === "el-shot" && node.attrs.src === undefined && !hasDescendant(node, "img"))
      errors.push(issue("E_SHOT_NO_IMAGE", "<el-shot> needs an <img> child (or a src attribute)", node));
    if (node.tag !== "el-compare") continue;
    const images = node.children.filter((child) => child.type === "element" && ["el-shot", "img", "figure"].includes(child.tag));
    if (images.length < 2) errors.push(issue("E_COMPARE_TOO_FEW", `<el-compare> has ${images.length} image(s); it needs at least two el-shot or img children`, node));
    for (const image of images)
      if (!image.attrs.label?.trim()) errors.push(issue("E_COMPARE_LABEL", `<${image.tag}> inside <el-compare> needs a label attribute (for example label="before")`, image));
  }
}

function hasDescendant(node, tag) {
  let found = false;
  walk(node, (child) => {
    if (child.type === "element" && child.tag === tag) found = true;
  });
  return found;
}

function checkCss(css, node, errors) {
  if (/@import\b/iu.test(css)) errors.push(issue("E_CSS_IMPORT", `${describe(node)} uses @import; put the styles in the page instead`, node));
  if (/url\(\s*['"]?\s*(https?:)?\/\//iu.test(css)) errors.push(issue("E_NETWORK_CSS", `${describe(node)} loads a url() from the network; save the file next to the page`, node));
}

function checkUnsafe(elements, errors) {
  for (const node of elements) {
    if (node.tag === "style") checkCss(textContent(node), node, errors);
    if (node.attrs.style) checkCss(node.attrs.style, node, errors);
    if (node.inert) continue;
    if (EMBEDS.has(node.tag)) errors.push(issue("E_IFRAME", `<${node.tag}> is not allowed; use <el-iframe>, which sandboxes the frame`, node));
    if (node.tag === "form" && (node.attrs.action ?? "").trim())
      errors.push(issue("E_FORM_ACTION", `<form action="${node.attrs.action}"> posts elsewhere; answers go through the answer controls`, node));
    if (node.tag === "base") errors.push(issue("E_BASE", "<base> is not allowed; it breaks the page's relative paths and the API", node));
    if (node.tag === "meta" && /refresh/iu.test(node.attrs["http-equiv"] ?? "")) errors.push(issue("E_META_REFRESH", '<meta http-equiv="refresh"> is not allowed', node));
  }
}

function collectWarnings(elements, warnings) {
  let controls = 0;
  let registers = false;
  for (const node of elements) {
    if (node.inert) continue;
    if (CONTROL_KINDS[node.tag]) controls += 1;
    if (node.tag === "script" && /registerControl\s*\(/u.test(textContent(node))) registers = true;
    for (const name of Object.keys(node.attrs))
      if (/^on[a-z]+$/u.test(name))
        warnings.push(issue("W_EVENT_HANDLER", `${describe(node)} has an inline ${name} handler; page scripts should use window.epicLoop and addEventListener`, node));
    if (node.tag === "img" && node.attrs.alt === undefined) warnings.push(issue("W_IMG_ALT", `<img src="${node.attrs.src ?? ""}"> has no alt text`, node));
    if (node.tag === "el-card") {
      const choices = elements.filter((child) => child.tag === "el-choice" && closest(child, ["el-card"]) === node).length;
      if (choices > 1) warnings.push(issue("W_CARD_CHOICES", `<el-card${node.attrs.id ? ` id="${node.attrs.id}"` : ""}> has ${choices} choices; keep one decision per card`, node));
    }
  }
  if (controls === 0 && !registers) warnings.push(issue("W_NO_CONTROLS", "the page has no answer controls; it can only be acknowledged with Submit"));
}

// ---------- Schema and segments ----------

function buildSchema(elements) {
  const controls = [];
  for (const node of elements) {
    const kind = CONTROL_KINDS[node.tag];
    if (node.inert || !kind) continue;
    const control = { name: node.attrs.name ?? "", kind, optional: node.attrs.optional !== undefined };
    const label = node.attrs.label ?? (kind === "check" ? normalizeSegment(textContent(node)) : undefined);
    if (label) control.label = label;
    if (kind === "choice" || kind === "select") control.options = optionsOf(node).map(({ value, label: text }) => ({ value, label: text }));
    if (node.attrs.recommended !== undefined) control.recommended = node.attrs.recommended;
    if (node.attrs.rule) control.rule = node.attrs.rule;
    const card = closest(node, ["el-card"]);
    if (card) control.card = card.attrs.id ?? card.attrs.title ?? "";
    controls.push(control);
  }
  return { controls };
}

export function extractSegments(tree) {
  const segments = [];
  const seen = new Set();
  const add = (text) => {
    if (!isTranslatableSegment(text)) return;
    const key = normalizeSegment(text);
    if (!seen.has(key)) {
      seen.add(key);
      segments.push(key);
    }
  };
  walk(tree, (node) => {
    if (node.type === "text") return add(node.value);
    if (node.attrs["data-i18n-skip"] !== undefined || node.tag === "head") return false;
    // Attributes first: an el-diagram caption is rendered as translatable text even though its source is not.
    for (const attr of [...TRANSLATABLE_ATTRIBUTES, ...RENDERED_ATTRIBUTES]) if (node.attrs[attr] !== undefined) add(node.attrs[attr]);
    return !NO_SEGMENTS.has(node.tag);
  });
  return segments;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function compareTranslations(dir, segments, languages, strictLang, errors, warnings) {
  const result = {};
  for (const lang of languages) {
    const translated = readJson(path.join(dir, "i18n", `${lang}.json`), {}).segments ?? {};
    const missing = segments.filter((segment) => !Object.hasOwn(translated, segment));
    const stale = Object.keys(translated).filter((key) => !segments.includes(key));
    result[lang] = { missing, stale };
    if (missing.length)
      (lang === strictLang ? errors : warnings).push(
        issue(lang === strictLang ? "E_TRANSLATION_MISSING" : "W_TRANSLATION_MISSING", `${missing.length} segment(s) have no ${lang} translation in i18n/${lang}.json`),
      );
    if (stale.length) warnings.push(issue("W_TRANSLATION_STALE", `${stale.length} key(s) in i18n/${lang}.json are no longer on the page`));
  }
  return result;
}

// ---------- Entry points ----------

export function checkReview(dir, { lang } = {}) {
  const errors = [];
  const warnings = [];
  const pagePath = path.join(dir, "page.html");
  if (!fs.existsSync(pagePath)) return { ok: false, errors: [issue("E_NO_PAGE", `no page.html in ${dir}`)], warnings, schema: null, segments: [], translations: {} };
  let tree;
  try {
    tree = parseHtml(fs.readFileSync(pagePath, "utf8"));
  } catch (error) {
    if (!(error instanceof HtmlError)) throw error;
    return {
      ok: false,
      errors: [{ code: "E_PARSE", message: `page.html cannot be parsed reliably: ${error.message}`, line: error.line }],
      warnings,
      schema: null,
      segments: [],
      translations: {},
    };
  }
  const elements = [];
  walk(tree, (node) => {
    if (node.type === "element") elements.push(node);
  });
  checkControls(elements, errors);
  checkMedia(elements, errors);
  checkReferences(dir, elements, errors);
  checkUnsafe(elements, errors);
  collectWarnings(elements, warnings);
  const segments = extractSegments(tree);
  const review = readJson(path.join(dir, "review.json"), {});
  const languages = [...new Set([...(Array.isArray(review.languages) ? review.languages : []), ...(lang ? [lang] : [])])].filter(
    (code) => typeof code === "string" && code && code !== "en",
  );
  const translations = compareTranslations(dir, segments, languages, lang, errors, warnings);
  return { ok: errors.length === 0, errors, warnings, schema: buildSchema(elements), segments, translations };
}

export function writeCheckOutputs(dir, result) {
  if (!result.ok) return false;
  const reviewPath = path.join(dir, "review.json");
  const review = readJson(reviewPath, {});
  writeAtomic(reviewPath, `${JSON.stringify({ ...review, schema: result.schema, checkedAt: new Date().toISOString() }, null, 2)}\n`);
  fs.mkdirSync(path.join(dir, "i18n"), { recursive: true });
  writeAtomic(path.join(dir, "i18n", "source.json"), `${JSON.stringify({ segments: result.segments }, null, 2)}\n`);
  return true;
}

export function resolveReviewDir(target, root) {
  if (!target) throw new Error("Usage: epic-loop review check <slug>/<id> | <review folder>");
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) return path.resolve(target);
  const [slug, id, extra] = target.split("/");
  if (!isName(slug) || !isName(id) || extra !== undefined) throw new Error(`Not a review folder or <slug>/<id>: ${target}`);
  if (!root) throw new Error("No epic-loop project here: run inside a project with .epic-loop/ or pass --root.");
  const dir = path.join(root, ".epic-loop", "epics", slug, "reviews", id);
  if (!fs.existsSync(dir)) throw new Error(`No review folder at ${dir}`);
  return dir;
}

export function formatCheck(dir, result) {
  const lines = [`${result.ok ? "PASS" : "FAIL"} ${dir}`];
  const show = (label, list) => list.forEach((item) => lines.push(`  ${label} ${item.code}${item.line ? ` (line ${item.line})` : ""}: ${item.message}`));
  show("error", result.errors);
  show("warning", result.warnings);
  if (result.schema) lines.push(`  ${result.schema.controls.length} control(s), ${result.segments.length} segment(s)`);
  for (const [lang, { missing, stale }] of Object.entries(result.translations)) lines.push(`  ${lang}: ${missing.length} missing, ${stale.length} stale`);
  if (result.ok) lines.push("  wrote review.json (schema) and i18n/source.json");
  return lines.join("\n");
}
