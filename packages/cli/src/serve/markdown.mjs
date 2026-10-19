import fs from "node:fs";
import path from "node:path";

import MarkdownIt from "markdown-it";

import { canonicalId } from "../epic/id-index.mjs";
import { isServableDoc } from "../epic/docs.mjs";
import { escapeHtml } from "./pages.mjs";
import { docHref, refLink, splitMentions } from "./refs.mjs";

// Markdown pages of the docs browser (Phase 5 Task 4, D39): markdown-it with raw HTML off, so HTML
// in a doc shows as text. On top of it:
//   - headings get stable GitHub-style ids;
//   - definitions of D/Q/R/H/T ids get an anchor named by the id (`#D27`);
//   - relative links to epic files go to their docs page; links that leave the epic or name a
//     missing file become plain text with the path shown; http(s) links get rel=noopener;
//   - an inline code span naming an epic file links to it;
//   - known id mentions in text become `el-ref` links, except inside code and links and on the
//     line that defines the id.

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/gu, "-") || "section"
  );
}

const EXTERNAL = /^(https?:|mailto:)/iu;

// The epic file a relative link names, tried against the doc's own folder and then the epic root.
function resolveTarget(env, target) {
  const [rawPath] = target.split("#");
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { outside: true };
  }
  if (!decoded || decoded.startsWith("/")) return { outside: true };
  const fromDoc = path.posix.normalize(path.posix.join(path.posix.dirname(env.doc), decoded));
  const fromRoot = path.posix.normalize(decoded);
  const candidates = [fromDoc, fromRoot].filter((rel) => !rel.startsWith("..") && rel !== ".");
  const found = candidates.find((rel) => isServableDoc(rel) && fs.existsSync(path.join(env.epicDir, ...rel.split("/"))));
  if (found) return { relative: found };
  return { outside: !candidates.length, missing: candidates.length > 0 };
}

function anchorOf(target) {
  const hash = target.includes("#") ? target.slice(target.indexOf("#") + 1) : "";
  if (!hash) return null;
  return canonicalId(hash) ?? hash;
}

function html(state, content) {
  const token = new state.Token("html_inline", "", 0);
  token.content = content;
  return token;
}

function rewriteLink(state, env, children, index) {
  const open = children[index];
  const href = open.attrGet("href") ?? "";
  if (EXTERNAL.test(href)) {
    open.attrSet("rel", "noopener noreferrer");
    return;
  }
  if (href.startsWith("#")) {
    const anchor = anchorOf(href);
    open.attrSet("href", `#${anchor}`);
    return;
  }
  const target = resolveTarget(env, href);
  if (target.relative) {
    open.attrSet("href", docHref(env.slug, target.relative, anchorOf(href)));
    return;
  }
  // Not an epic page: keep the text, show the path, never follow it.
  const close = children.findIndex((token, at) => at > index && token.type === "link_close");
  const text = children
    .slice(index + 1, close)
    .map((token) => token.content)
    .join("");
  const title = target.missing ? "not found in this epic" : "outside this epic";
  children[index] = html(state, `<span class="el-path" title="${escapeHtml(title)}">`);
  children[close] = html(state, `${text.trim() === href ? "" : ` <span class="el-meta">(${escapeHtml(href)})</span>`}</span>`);
}

function linkCode(state, env, token) {
  const content = token.content.trim();
  if (!/^[\w./-]+\.md(#[\w-]+)?$/u.test(content)) return [token];
  const target = resolveTarget(env, content);
  if (!target.relative) return [token];
  return [html(state, `<a href="${escapeHtml(docHref(env.slug, target.relative, anchorOf(content)))}">`), token, html(state, "</a>")];
}

function linkMentions(state, env, token, skip) {
  return splitMentions(token.content, env.index, skip).map((part) => {
    if (!part.id) {
      const text = new state.Token("text", "", 0);
      text.content = part.text;
      return text;
    }
    return html(state, refLink(env.slug, part.id, env.index.ids[part.id], part.text));
  });
}

// Ids whose definition sits on 1-based `line` of this doc.
function definitionsAt(env, line) {
  return Object.entries(env.index.ids)
    .filter(([, entry]) => entry.file === env.doc && entry.line === line)
    .map(([id]) => id);
}

function processInline(state, env, inline, line) {
  const defined = line === null ? [] : definitionsAt(env, line);
  const skip = new Set(defined);
  const out = defined.map((id) => html(state, `<span class="el-anchor" id="${escapeHtml(id)}"></span>`));
  let inLink = 0;
  const children = inline.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.type === "link_open") rewriteLink(state, env, children, index);
    const current = children[index];
    if (current.type === "link_open") inLink += 1;
    if (current.type === "link_close") inLink -= 1;
    if (current.type === "code_inline" && !inLink) out.push(...linkCode(state, env, current));
    else if (current.type === "text" && !inLink) out.push(...linkMentions(state, env, current, skip));
    else out.push(current);
  }
  inline.children = out;
}

md.core.ruler.push("epic_loop_docs", (state) => {
  const { env } = state;
  if (!env?.index) return;
  const used = new Map();
  let line = null;
  state.tokens.forEach((token, at) => {
    if (token.map && token.type !== "inline") line = token.map[0] + 1;
    if (token.type === "heading_open") {
      const text = state.tokens[at + 1]?.content ?? "";
      const base = slugify(text);
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      token.attrSet("id", count ? `${base}-${count}` : base);
    }
    if (token.type !== "inline") return;
    processInline(state, env, token, token.map ? token.map[0] + 1 : line);
    // Each table row's definition anchor goes into its first cell only.
    if (!token.map) line = null;
  });
});

// Tables use the app's table component, scrolling sideways on narrow screens.
md.renderer.rules.table_open = () => '<div class="el-table-wrap"><table class="el-table">\n';
md.renderer.rules.table_close = () => "</table></div>\n";

const renderImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, at, options, env, self) => {
  const token = tokens[at];
  const src = token.attrGet("src") ?? "";
  if (!EXTERNAL.test(src) && env?.epicDir) {
    const target = resolveTarget(env, src);
    if (!target.relative) return escapeHtml(token.content || src);
    token.attrSet("src", docHref(env.slug, target.relative));
  }
  return renderImage(tokens, at, options, env, self);
};

// Renders one epic doc. `doc` is its path relative to the epic directory.
export function renderMarkdown(text, { doc, epicDir, index, slug }) {
  return md.render(text, { doc, epicDir, index, slug });
}
