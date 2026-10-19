// The docs browser (Phase 5 Task 4): every epic artifact and doc as a page with working links and
// expandable ids. `renderDocPage` is the full page; `renderDocMain` is the inner <main>, which
// /_runtime/home.js swaps in when the doc's own file changes.
import fs from "node:fs";

import { isMarkdown, listEpicDocs, resolveEpicDoc } from "../epic/docs.mjs";
import { buildIdIndex } from "../epic/id-index.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { escapeHtml, layout } from "./pages.mjs";
import { docHref } from "./refs.mjs";

const GROUPS = [
  ["artifacts", "Artifacts"],
  ["docs", "Docs"],
  ["stopReports", "Stop reports"],
];

export function docsList(slug, docs) {
  return GROUPS.filter(([key]) => docs[key].length)
    .map(
      ([key, label]) => `          <div class="el-holds" data-docs-group="${key}">
            <h3>${label} <span class="el-meta">${docs[key].length}</span></h3>
            <ul class="el-list el-docs">
${docs[key].map((rel) => `              <li><a href="${escapeHtml(docHref(slug, rel))}">${escapeHtml(rel)}</a></li>`).join("\n")}
            </ul>
          </div>`,
    )
    .join("\n");
}

// The home's Docs section.
export function docsSection(slug, docs) {
  const body = docsList(slug, docs);
  if (!body) return "";
  return `        <section class="el-section el-docs-section" id="docs">
          <div class="el-section__head"><h2>Docs</h2><span class="el-meta">${docs.artifacts.length + docs.docs.length + docs.stopReports.length}</span></div>
${body}
        </section>
`;
}

function crumbs(projectName, slug, doc) {
  return [
    { href: "/", label: projectName },
    { href: `/${encodeURIComponent(slug)}`, label: slug },
    { href: `/${encodeURIComponent(slug)}/docs/`, label: "docs" },
    ...(doc ? [{ href: docHref(slug, doc), label: doc }] : []),
  ];
}

export function renderDocMain({ doc, html }) {
  return `        <div class="el-page-head"><div class="el-label">doc</div><p class="el-meta el-doc__path">${escapeHtml(doc)}</p></div>
        <article class="el-doc">
${html}
        </article>
`;
}

export function renderDocPage(projectName, { slug, doc, html, title }) {
  return layout({
    title: title ?? doc,
    crumbs: crumbs(projectName, slug, doc),
    headerEnd: '<span class="el-live el-meta" data-live="connecting" aria-live="polite">live</span>',
    main: { attributes: ` data-epic="${escapeHtml(slug)}" data-live-main data-live-file="${escapeHtml(doc)}"` },
    scripts: ['<script type="module" src="/_runtime/home.js"></script>', '<script type="module" src="/_runtime/refs.js"></script>'],
    body: renderDocMain({ doc, html }),
  });
}

export function renderDocsIndex(projectName, { slug, docs }) {
  return layout({
    title: `${slug} docs`,
    crumbs: crumbs(projectName, slug, null),
    main: { attributes: ` data-epic="${escapeHtml(slug)}"` },
    body: `        <div class="el-page-head"><div class="el-label">epic</div><h1>Docs</h1><p class="el-meta">${escapeHtml(slug)}</p></div>
        <section class="el-section">
${docsList(slug, docs) || '          <p class="el-muted">No docs yet.</p>'}
        </section>
`,
  });
}

// The first top-level heading of a markdown doc, for the page title.
export function docTitle(text) {
  return text.match(/^#\s+(.+?)\s*#*\s*$/mu)?.[1] ?? null;
}

// The response for /<slug>/docs/<rest>: the docs index, a rendered markdown page (or its inner
// <main> for ?fragment=main), another file under docs/ to serve as is, or null for a 404.
export function docsResponse(projectName, epicDir, slug, rest, fragment) {
  if (!rest) return { html: renderDocsIndex(projectName, { docs: listEpicDocs(epicDir), slug }) };
  const found = resolveEpicDoc(epicDir, rest);
  if (!found) return null;
  if (!isMarkdown(found.relative)) return { file: found.file };
  const text = fs.readFileSync(found.file, "utf8");
  const html = renderMarkdown(text, { doc: found.relative, epicDir, index: buildIdIndex(epicDir), slug });
  if (fragment === "main") return { html: renderDocMain({ doc: found.relative, html }) };
  return { html: renderDocPage(projectName, { doc: found.relative, html, slug, title: docTitle(text) }) };
}
