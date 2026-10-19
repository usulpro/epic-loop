// A small, tolerant HTML parser for agent-written review pages (Node built-ins only). It builds a
// tree of elements and text with line numbers. It is not a full HTML5 parser: it handles attributes
// in all forms, void and self-closing elements, comments, doctype, raw-text elements, <template>
// (contents marked inert), character references, and implied closing of common elements. Input it
// cannot handle reliably (an unterminated tag, comment or raw-text element) raises HtmlError.

export class HtmlError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
const BLOCKS = [
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "fieldset",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
];
// A start tag of a key closes an open element listed in its value (the open element's end tag is implied).
const IMPLIED = {
  li: ["li"],
  dt: ["dt", "dd"],
  dd: ["dt", "dd"],
  tr: ["tr", "td", "th"],
  td: ["td", "th"],
  th: ["td", "th"],
  option: ["option"],
  thead: ["tbody", "tfoot"],
  tbody: ["thead", "tbody", "tfoot"],
  tfoot: ["thead", "tbody"],
};
for (const block of BLOCKS) IMPLIED[block] = [...(IMPLIED[block] ?? []), "p"];

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  times: "×",
  rarr: "→",
  larr: "←",
  uarr: "↑",
  darr: "↓",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  deg: "°",
  euro: "€",
  check: "✓",
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/giu, (match, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function makeElement(tag, attrs, line, parent) {
  return { type: "element", tag, attrs, children: [], line, parent, inert: Boolean(parent?.inert || parent?.tag === "template") };
}

const SPACE = /\s/u;
const NAME_END = /[\s"'>/=]/u;

// Reads attributes from just after the tag name up to ">" (or "/>"); values may be double-quoted,
// single-quoted, unquoted, or absent (boolean). The first occurrence of a name wins.
function parseAttributes(source, from, line) {
  const attrs = {};
  let i = from;
  const n = source.length;
  const skipSpace = () => {
    while (i < n && SPACE.test(source[i])) i += 1;
  };
  while (i < n) {
    skipSpace();
    if (source[i] === ">") return { attrs, end: i + 1, selfClosing: false };
    if (source[i] === "/") {
      if (source[i + 1] === ">") return { attrs, end: i + 2, selfClosing: true };
      i += 1;
      continue;
    }
    const nameStart = i;
    while (i < n && !NAME_END.test(source[i])) i += 1;
    if (i === nameStart) {
      i += 1;
      continue;
    }
    const name = source.slice(nameStart, i).toLowerCase();
    skipSpace();
    let value = "";
    if (source[i] === "=") {
      i += 1;
      skipSpace();
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        const close = source.indexOf(quote, i + 1);
        if (close === -1) throw new HtmlError(`unterminated value of attribute "${name}"`, line);
        value = source.slice(i + 1, close);
        i = close + 1;
      } else {
        const valueStart = i;
        while (i < n && !SPACE.test(source[i]) && source[i] !== ">") i += 1;
        value = source.slice(valueStart, i);
      }
    }
    if (!Object.hasOwn(attrs, name)) attrs[name] = decodeEntities(value);
  }
  throw new HtmlError("unterminated tag", line);
}

function countLines(source, from, to, line) {
  for (let index = from; index < to; index += 1) if (source.charCodeAt(index) === 10) line += 1;
  return line;
}

export function parseHtml(source) {
  const root = { type: "element", tag: "#document", attrs: {}, children: [], line: 1, parent: null, inert: false };
  let current = root;
  let pos = 0;
  let line = 1;
  const advance = (to) => {
    line = countLines(source, pos, to, line);
    pos = to;
  };
  const closeTo = (tag) => {
    for (let node = current; node && node !== root; node = node.parent) {
      if (node.tag === tag) {
        current = node.parent;
        return true;
      }
    }
    return false;
  };
  while (pos < source.length) {
    const lt = source.indexOf("<", pos);
    if (lt === -1 || lt > pos) {
      const end = lt === -1 ? source.length : lt;
      current.children.push({ type: "text", value: decodeEntities(source.slice(pos, end)), line, parent: current });
      advance(end);
      continue;
    }
    if (source.startsWith("<!--", pos)) {
      const end = source.indexOf("-->", pos + 4);
      if (end === -1) throw new HtmlError("unterminated comment", line);
      advance(end + 3);
      continue;
    }
    if (source[pos + 1] === "!" || source[pos + 1] === "?") {
      const end = source.indexOf(">", pos);
      if (end === -1) throw new HtmlError("unterminated declaration", line);
      advance(end + 1);
      continue;
    }
    const endTag = /^<\/([a-zA-Z][\w:-]*)\s*>/u.exec(source.slice(pos, pos + 200));
    if (endTag) {
      closeTo(endTag[1].toLowerCase());
      advance(pos + endTag[0].length);
      continue;
    }
    const startTag = /^<([a-zA-Z][\w:-]*)/u.exec(source.slice(pos, pos + 200));
    if (!startTag) {
      current.children.push({ type: "text", value: "<", line, parent: current });
      advance(pos + 1);
      continue;
    }
    const tag = startTag[1].toLowerCase();
    const tagLine = line;
    const { attrs, end, selfClosing } = parseAttributes(source, pos + startTag[0].length, tagLine);
    advance(end);
    for (const implied of IMPLIED[tag] ?? []) {
      if (current.tag === implied) current = current.parent;
    }
    const element = makeElement(tag, attrs, tagLine, current);
    current.children.push(element);
    if (VOID.has(tag) || selfClosing) continue;
    if (RAW_TEXT.has(tag)) {
      const close = new RegExp(`</${tag}[\\s/>]`, "iu");
      const match = close.exec(source.slice(pos));
      if (!match) throw new HtmlError(`unterminated <${tag}>`, tagLine);
      const text = source.slice(pos, pos + match.index);
      element.children.push({ type: "text", value: tag === "textarea" || tag === "title" ? decodeEntities(text) : text, line, parent: element, raw: true });
      const closeEnd = source.indexOf(">", pos + match.index);
      advance(closeEnd + 1);
      continue;
    }
    current = element;
  }
  return root;
}

// Depth-first walk in document order. The visitor may return false to skip an element's children.
export function walk(node, visit) {
  for (const child of node.children) {
    if (visit(child) === false) continue;
    if (child.type === "element") walk(child, visit);
  }
}

export function closest(node, tags) {
  for (let current = node.parent; current; current = current.parent) if (tags.includes(current.tag)) return current;
  return null;
}

export function textContent(node) {
  if (node.type === "text") return node.value;
  return node.children.map(textContent).join("");
}
