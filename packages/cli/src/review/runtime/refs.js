// Id references (D27) in the epic app: hovering or focusing an `a.el-ref` shows its entry (id,
// kind, title, status, source) in a popover; Escape closes it; a click goes to the definition.
// The server wraps ids on the home and doc pages; on agent-written review pages this script wraps
// the ids it finds in the text of <main> itself, from /api/<slug>/ids.
const MENTION = /(?<![A-Za-z0-9_-])([DHQRT])(-?)(\d+)(?![A-Za-z0-9_])/gu;
const HAS_MENTION = new RegExp(MENTION.source, "u");
const SKIP = "a, code, pre, script, style, textarea, input, select, option, button, label, [contenteditable], .el-refpop";
const KINDS = { decision: "decision", "human-queue": "human-queue item", "open-question": "open question", risk: "risk", task: "task" };

const reviewKey = document.querySelector('meta[name="epic-loop-review"]')?.getAttribute("content") ?? null;
const slug = document.querySelector("main[data-epic]")?.dataset.epic ?? reviewKey?.split("/")[0] ?? null;
const state = { open: null, wrapped: 0 };
window.epicLoopRefs = state;

let indexPromise = null;
function loadIndex() {
  indexPromise ??= fetch(`/api/${encodeURIComponent(slug)}/ids`, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { aliases: {}, ids: {} }))
    .catch(() => ({ aliases: {}, ids: {} }));
  return indexPromise;
}

const docHref = (file, id) =>
  `/${encodeURIComponent(slug)}/docs/${file
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}#${encodeURIComponent(id)}`;

const pop = document.createElement("div");
pop.className = "el-refpop";
pop.id = "el-refpop";
pop.setAttribute("role", "tooltip");
pop.hidden = true;
let current = null;
let hideTimer = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fill(id, entry) {
  const kind = KINDS[entry.kind] ?? entry.kind;
  const head = element("div", "el-refpop__head");
  head.append(element("span", "el-id", id), " ", element("span", "el-tag", kind));
  const status = entry.resolved ? "resolved" : entry.status;
  if (status) head.append(" ", element("span", "el-tag el-tag--accent", status));
  const title = element("p", "el-refpop__title", entry.title ?? "(no title)");
  const meta = element("p", "el-meta", `${entry.file}${entry.line ? ` · line ${entry.line}` : ""}`);
  const source = element("a", "el-refpop__source", "Go to source");
  source.href = docHref(entry.file, id);
  pop.replaceChildren(head, title, meta, source);
  pop.setAttribute("aria-label", `${id}, ${kind}: ${entry.title ?? ""}`.trim());
}

function place(link) {
  const rect = link.getBoundingClientRect();
  const width = Math.min(pop.offsetWidth || 320, window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  pop.style.left = `${window.scrollX + left}px`;
  pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
}

async function show(link) {
  clearTimeout(hideTimer);
  const id = link.dataset.ref;
  const entry = (await loadIndex()).ids[id];
  if (!entry) return;
  if (current && current !== link) current.removeAttribute("aria-describedby");
  current = link;
  fill(id, entry);
  if (!pop.isConnected) document.body.append(pop);
  pop.hidden = false;
  place(link);
  link.setAttribute("aria-describedby", pop.id);
  state.open = id;
}

function hide() {
  clearTimeout(hideTimer);
  pop.hidden = true;
  current?.removeAttribute("aria-describedby");
  current = null;
  state.open = null;
}

const hideSoon = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 200);
};

document.addEventListener("mouseover", (event) => {
  const link = event.target.closest?.("a.el-ref");
  if (link) show(link);
  else if (event.target.closest?.(".el-refpop")) clearTimeout(hideTimer);
});
document.addEventListener("mouseout", (event) => {
  if (!current) return;
  const to = event.relatedTarget;
  if (to && (to.closest?.("a.el-ref") === current || to.closest?.(".el-refpop"))) return;
  if (event.target.closest?.("a.el-ref, .el-refpop")) hideSoon();
});
document.addEventListener("focusin", (event) => {
  const link = event.target.closest?.("a.el-ref");
  if (link) show(link);
  else if (current && !event.target.closest?.(".el-refpop")) hide();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !current) return;
  const link = current;
  const inside = pop.contains(document.activeElement);
  hide();
  if (inside) link.focus();
});
window.addEventListener("resize", () => current && place(current));

// Review pages: wrap known ids in the text of <main>, skipping code, links and form controls.
async function wrapReviewPage() {
  const scope = document.querySelector("main") ?? document.body;
  const index = await loadIndex();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(SKIP) || !HAS_MENTION.test(node.data) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let last = 0;
    let changed = false;
    for (const match of node.data.matchAll(MENTION)) {
      const id = `${match[1]}${Number(match[3])}`;
      const entry = index.ids[id];
      if (!entry) continue;
      fragment.append(node.data.slice(last, match.index));
      const link = element("a", "el-ref", match[0]);
      link.dataset.ref = id;
      link.href = docHref(entry.file, id);
      fragment.append(link);
      last = match.index + match[0].length;
      changed = true;
      state.wrapped += 1;
    }
    if (!changed) continue;
    fragment.append(node.data.slice(last));
    node.replaceWith(fragment);
  }
  document.dispatchEvent(new CustomEvent("epic-loop:refs-wrapped", { detail: { wrapped: state.wrapped } }));
}

if (slug && reviewKey) {
  // After the page runtime has upgraded its components.
  if (document.readyState === "complete") wrapReviewPage();
  else window.addEventListener("load", () => wrapReviewPage());
}
