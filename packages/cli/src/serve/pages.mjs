// Server-rendered pages of the epic app and the injection into agent-written review pages.
// Styling comes only from the runtime's tokens.css and base.css (el-* classes).

const RUNTIME_CSS = ["/_runtime/tokens.css", "/_runtime/base.css"];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function cssLinks() {
  return RUNTIME_CSS.map((href) => `<link rel="stylesheet" href="${href}" />`).join("\n    ");
}

function layout({ title, crumbs = [], headerEnd = "", body }) {
  const nav = crumbs
    .map((crumb, index) => {
      const last = index === crumbs.length - 1;
      const link = last ? `<a href="${crumb.href}" aria-current="page">${escapeHtml(crumb.label)}</a>` : `<a href="${crumb.href}">${escapeHtml(crumb.label)}</a>`;
      return index === 0 ? link : `<span class="el-nav__sep">/</span>${link}`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · epic-loop</title>
    ${cssLinks()}
  </head>
  <body>
    <div class="el-shell">
      <header class="el-header">
        <a class="el-brand" href="/">epic-loop</a>
        <nav class="el-nav" aria-label="Breadcrumb">${nav}</nav>
        <div class="el-header__end">${headerEnd}</div>
      </header>
      <main class="el-main">
${body}
      </main>
    </div>
  </body>
</html>
`;
}

function pendingBadge(count) {
  return count > 0 ? `<span class="el-badge" title="${count} pending">${count}</span>` : `<span class="el-badge el-badge--quiet" title="nothing pending">0</span>`;
}

export function renderEpicList(projectName, epics) {
  const pending = epics.reduce((sum, epic) => sum + epic.pending, 0);
  const rows = epics.length
    ? epics
        .map(
          (epic) => `          <tr>
            <td><a href="/${encodeURIComponent(epic.slug)}">${escapeHtml(epic.title)}</a></td>
            <td><span class="el-id">${escapeHtml(epic.slug)}</span></td>
            <td class="el-meta">${escapeHtml(epic.mode)}</td>
            <td class="num">${pendingBadge(epic.pending)}</td>
          </tr>`,
        )
        .join("\n")
    : `          <tr><td colspan="4" class="el-muted">No epics in this project yet.</td></tr>`;
  return layout({
    title: "Epics",
    crumbs: [{ href: "/", label: projectName }],
    headerEnd: `<span class="el-meta">pending reviews</span> ${pendingBadge(pending)}`,
    body: `        <div class="el-page-head"><div class="el-label">project</div><h1>Epics</h1></div>
        <div class="el-table-wrap">
          <table class="el-table">
            <thead><tr><th>epic</th><th>slug</th><th>mode</th><th class="num">pending</th></tr></thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>`,
  });
}

export function renderEpicHome(projectName, epic, reviews) {
  const pending = reviews.filter((review) => !review.submittedAt);
  const done = reviews.filter((review) => review.submittedAt);
  const href = (review) => `/${encodeURIComponent(epic.slug)}/reviews/${encodeURIComponent(review.id)}/`;
  const notices = pending.length
    ? pending
        .map(
          (review) => `          <div class="el-notice el-notice--action">
            <span class="el-id">${escapeHtml(review.id)}</span>
            <div><div class="el-notice__title">${escapeHtml(review.title)}</div><p class="el-notice__text">Waiting for your answers${review.savedAt ? ` · draft saved ${escapeHtml(review.savedAt)}` : ""}</p></div>
            <a class="el-btn el-btn--primary" href="${href(review)}">Open</a>
          </div>`,
        )
        .join("\n")
    : `          <p class="el-muted">Nothing is waiting for you.</p>`;
  const history = done.length
    ? `        <section class="el-section">
          <div class="el-section__head"><h2>Answered</h2><span class="el-meta">${done.length}</span></div>
          <div class="el-table-wrap"><table class="el-table">
            <thead><tr><th>review</th><th>title</th><th>submitted</th></tr></thead>
            <tbody>
${done.map((review) => `              <tr><td><span class="el-id">${escapeHtml(review.id)}</span></td><td><a href="${href(review)}">${escapeHtml(review.title)}</a></td><td class="el-meta">${escapeHtml(review.submittedAt)}</td></tr>`).join("\n")}
            </tbody>
          </table></div>
        </section>`
    : "";
  return layout({
    title: epic.title,
    crumbs: [
      { href: "/", label: projectName },
      { href: `/${encodeURIComponent(epic.slug)}`, label: epic.slug },
    ],
    headerEnd: `<span class="el-meta">pending</span> ${pendingBadge(pending.length)}`,
    body: `        <div class="el-page-head"><div class="el-label">epic</div><h1>${escapeHtml(epic.title)}</h1><p class="el-meta">${escapeHtml(epic.slug)} · ${escapeHtml(epic.mode)}</p></div>
        <section class="el-section">
          <div class="el-section__head"><h2>Waiting for you</h2>${pendingBadge(pending.length)}</div>
${notices}
        </section>
${history}`,
  });
}

export function renderNotFound(projectName, message = "There is no page at this address.") {
  return layout({
    title: "Not found",
    crumbs: [{ href: "/", label: projectName }],
    body: `        <div class="el-page-head"><div class="el-label">404</div><h1>Not found</h1></div>
        <p>${escapeHtml(message)}</p>
        <p><a href="/">Back to the epics</a></p>`,
  });
}

export function renderProblemThanks(projectName, backHref) {
  return layout({
    title: "Problem reported",
    crumbs: [{ href: "/", label: projectName }],
    body: `        <div class="el-page-head"><div class="el-label">reported</div><h1>Thanks, the problem is recorded</h1></div>
        <p>The loop will look at this page and fix it. You can go back to it now.</p>
        <p><a class="el-btn el-btn--primary" href="${escapeHtml(backHref)}">Back to the page</a></p>`,
  });
}

// The problem control: a plain HTML form inside <details>, so it works when the page's own
// script throws or the page has no JS at all. Inline styles keep it usable even if the page
// overrides the runtime classes.
function problemControl(slug, id) {
  const action = `/api/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/problem`;
  const back = `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/`;
  return `
<div id="el-problem" style="position:fixed;top:8px;right:8px;z-index:2147483647;max-width:22rem;font-family:var(--font-sans,system-ui,sans-serif)">
  <details>
    <summary class="el-btn el-btn--danger" style="cursor:pointer;list-style:none">Something is wrong with this page</summary>
    <form method="post" action="${action}" class="el-card" style="margin-top:4px;display:grid;gap:8px">
      <label class="el-field__label" for="el-problem-text">What is wrong?</label>
      <textarea id="el-problem-text" class="el-comment" name="text" rows="3" maxlength="4000" placeholder="Broken layout, missing image, wrong question…"></textarea>
      <input type="hidden" name="url" value="${back}" />
      <button class="el-btn el-btn--primary" type="submit">Send report</button>
    </form>
  </details>
</div>
`;
}

export function injectReview(html, { slug, id, runtimeScript }) {
  let page = html;
  const head = [];
  if (!/\/_runtime\/tokens\.css/u.test(page)) head.push(cssLinks());
  head.push(`<meta name="epic-loop-review" content="${escapeHtml(`${slug}/${id}`)}" />`);
  // Page runtime (components, autosave): an ES module, deferred by default.
  if (runtimeScript) head.push(`<script type="module" src="/_runtime/runtime.js"></script>`);
  const headBlock = `\n    ${head.join("\n    ")}\n`;
  page = /<\/head>/iu.test(page) ? page.replace(/<\/head>/iu, () => `${headBlock}</head>`) : `${headBlock}${page}`;
  const control = problemControl(slug, id);
  page = /<\/body>/iu.test(page) ? page.replace(/<\/body>(?![\s\S]*<\/body>)/iu, () => `${control}</body>`) : `${page}${control}`;
  return page;
}
