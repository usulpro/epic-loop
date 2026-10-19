// Part 3: every doc page of a served epic copy renders, every internal link and anchor resolves, and every
// el-ref points at its definition. Usage: node epic-links.mjs <base url> <slug> <epic dir> <cli src dir>
import path from "node:path";
const [base, slug, epicDir, cliSrc] = process.argv.slice(2);
const { listEpicDocs } = await import(path.join(cliSrc, "epic", "docs.mjs"));
const { buildIdIndex } = await import(path.join(cliSrc, "epic", "id-index.mjs"));
const index = buildIdIndex(epicDir);
const docs = listEpicDocs(epicDir);
const all = [...docs.artifacts, ...docs.docs, ...docs.stopReports];
const pages = new Map();
async function page(url) {
  if (!pages.has(url)) pages.set(url, fetch(new URL(url, base)).then(async (r) => ({ status: r.status, text: await r.text() })));
  return pages.get(url);
}
const counts = { pages: 0, links: 0, linkFailures: [], anchors: 0, anchorFailures: [], refs: 0, refFailures: [], plainPaths: 0, plainSamples: [] };
for (const doc of all) {
  const url = `/${slug}/docs/${doc}`;
  const { status, text } = await page(url);
  counts.pages += 1;
  if (status !== 200) { counts.linkFailures.push(`${url} -> ${status}`); continue; }
  const article = text.slice(text.indexOf('<article class="el-doc">'));
  for (const match of article.matchAll(/<a (class="el-ref" data-ref="([A-Z]\d+)" )?href="([^"]+)"/gu)) {
    const [, isRef, refId, href] = match;
    if (/^https?:/u.test(href)) continue;
    const [target, hash] = href.startsWith("#") ? [url, href.slice(1)] : href.split("#");
    const { status: s, text: t } = await page(target);
    counts.links += 1;
    if (s !== 200) counts.linkFailures.push(`${doc}: ${href} -> ${s}`);
    if (hash) {
      counts.anchors += 1;
      if (!t.includes(`id="${decodeURIComponent(hash)}"`)) counts.anchorFailures.push(`${doc}: ${href}`);
    }
    if (isRef) {
      counts.refs += 1;
      const entry = index.ids[refId];
      if (!entry || target !== `/${slug}/docs/${entry.file}` || hash !== refId) counts.refFailures.push(`${doc}: ${refId} -> ${href}`);
    }
  }
  for (const match of article.matchAll(/<span class="el-path" title="([^"]+)">([^<]*)(?: <span class="el-meta">\(([^)]*)\))?/gu)) {
    counts.plainPaths += 1;
    if (counts.plainSamples.length < 12) counts.plainSamples.push(`${doc}: ${match[3] ?? match[2]} (${match[1]})`);
  }
}
const unknownIds = [...new Set(index.unknown.map((m) => m.id))];
console.log(JSON.stringify({ ...counts, ids: Object.keys(index.ids).length, duplicates: index.duplicates.length, unknownMentions: index.unknown.length, unknownIds }, null, 2));
