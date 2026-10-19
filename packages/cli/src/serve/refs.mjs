// Id references in the epic app (D27): `D16`, `H3`, `T12`, `R5`, `Q7` and the hyphenated form
// link to their definition in the docs browser. /_runtime/refs.js turns these links into popovers.
import { MENTION } from "../epic/id-index.mjs";
import { escapeHtml } from "./pages.mjs";

export function docHref(slug, relative, anchor = null) {
  const pathPart = String(relative)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/${encodeURIComponent(slug)}/docs/${pathPart}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
}

export function refLink(slug, id, entry, text) {
  return `<a class="el-ref" data-ref="${escapeHtml(id)}" href="${escapeHtml(docHref(slug, entry.file, id))}">${escapeHtml(text)}</a>`;
}

// Splits plain text into text parts and known id mentions; ids in `skip` stay text.
export function splitMentions(text, index, skip = new Set()) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const id = `${match[1]}${Number(match[3])}`;
    if (!index.ids[id] || skip.has(id)) continue;
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ id, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Elements whose text never gets id links.
const SKIP_TAGS = new Set(["a", "code", "pre", "script", "style", "textarea", "title", "option", "button", "select"]);

// Wraps known id mentions in the text of server-rendered HTML (the home and its fragments). The
// input is the app's own well-formed markup; text between tags is already escaped, and ids are
// plain ASCII, so the escaped text is matched directly.
export function linkIdsInHtml(html, index, slug) {
  const stack = [];
  return html
    .split(/(<[^>]*>)/u)
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = part.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/u);
        if (tag && SKIP_TAGS.has(tag[2].toLowerCase()) && !part.endsWith("/>")) {
          if (tag[1]) stack.pop();
          else stack.push(tag[2]);
        }
        return part;
      }
      if (stack.length || !part) return part;
      return splitMentions(part, index)
        .map((item) => (item.id ? refLink(slug, item.id, index.ids[item.id], item.text) : item.text))
        .join("");
    })
    .join("");
}
