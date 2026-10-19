import fs from "node:fs";
import path from "node:path";

import { readStateLine } from "../epic/parsers.mjs";
import { escapeHtml } from "./pages.mjs";

// The language layer of the epic app (D9, D40). The second language comes from the
// `Second language:` line of state-of-epic.md; the choice is an `el-lang` cookie, set by the
// switch links (`?lang=<code>`), so it persists across pages without script.

export const LANG_COOKIE = "el-lang";
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/u;

export function readSecondLanguage(epicDir) {
  let text = "";
  try {
    text = fs.readFileSync(path.join(epicDir, "state-of-epic.md"), "utf8");
  } catch {
    return null;
  }
  const lang = readStateLine(text, "Second language");
  return lang && LANGUAGE_CODE.test(lang) && !/^en(-|$)/iu.test(lang) ? lang : null;
}

export function cookieLanguage(req) {
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === LANG_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}

// The language to serve: the second language when the cookie chose it, otherwise English (null).
export function activeLanguage(req, second) {
  return second && cookieLanguage(req) === second ? second : null;
}

export function langCookieHeader(lang) {
  return `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; SameSite=Strict; Max-Age=31536000`;
}

// `EN | RU` in the header: links that set the cookie through the server and come back.
export function langSwitch(pathname, second, active) {
  if (!second) return "";
  const option = (lang, label) =>
    `<a href="${escapeHtml(`${pathname}?lang=${encodeURIComponent(lang)}`)}" hreflang="${escapeHtml(lang)}" data-lang="${escapeHtml(lang)}"${(active ?? "en") === lang ? ' aria-current="true"' : ""}>${escapeHtml(label)}</a>`;
  return `<div class="el-seg el-lang" role="group" aria-label="Language">${option("en", "EN")}${option(second, second.toUpperCase())}</div>`;
}

// ---------- Home segments ----------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP_TAGS = new Set(["code", "pre", "time", "script", "style", "textarea", "option", "select"]);
// Ids, the activity feed (raw agent output) and anything marked data-no-i18n stay as they are.
const SKIP_CLASS = /\bel-(id|feed)\b|\bel-feed__/u;
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const ID_ONLY = /(?<![A-Za-z0-9_-])[DHQRT]-?\d+(?![A-Za-z0-9_])/gu;

const unescape = (text) => text.replace(/&(amp|lt|gt|quot|#39);/gu, (entity) => ENTITIES[entity]);
const normalize = (text) => text.replace(/\s+/gu, " ").trim();

function isSegment(text) {
  return /\p{L}{2,}/u.test(text.replace(ID_ONLY, ""));
}

// Calls visit(text, skipped) for each text node of the app's own well-formed markup and joins the
// results back.
function mapText(html, visit) {
  const stack = [];
  return html
    .split(/(<[^>]*>)/u)
    .map((part) => {
      if (part.startsWith("<!") || !part.startsWith("<")) return part.startsWith("<") ? part : visit(part, stack.some(Boolean));
      const tag = part.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/u);
      if (!tag) return part;
      const name = tag[2].toLowerCase();
      if (tag[1]) stack.pop();
      else if (!VOID.has(name) && !part.endsWith("/>"))
        stack.push(SKIP_TAGS.has(name) || SKIP_CLASS.test(part.match(/\bclass="([^"]*)"/u)?.[1] ?? "") || part.includes("data-no-i18n"));
      return part;
    })
    .join("");
}

export function collectSegments(html) {
  const found = [];
  mapText(html, (text, skipped) => {
    const source = normalize(unescape(text));
    if (!skipped && isSegment(source)) found.push(source);
    return text;
  });
  return found;
}

export function translateHtml(html, translations) {
  return mapText(html, (text, skipped) => {
    if (skipped) return text;
    const translated = translations.get(normalize(unescape(text)));
    if (!translated) return text;
    return `${/^\s*/u.exec(text)[0]}${escapeHtml(translated)}${/\s*$/u.exec(text)[0]}`;
  });
}
