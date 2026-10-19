// The epic home (Phase 5): the live overview of one epic. `renderEpicHome` is the full page;
// `renderHomeMain` is the inner <main> content, which /_runtime/home.js fetches with
// `?fragment=main` and swaps in when /api/<slug>/events reports a change. `renderActivity` is the
// activity section alone (`?fragment=activity`), refreshed on `event: activity`.
import { formatDuration } from "../epic/statistics.mjs";
import { escapeHtml, layout, pendingBadge } from "./pages.mjs";

const reviewHref = (slug, id) => `/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(id)}/`;

function statusTag(status) {
  const tone = status === "doing" ? " el-tag--accent" : status === "on-hold" || status === "blocked" ? " el-tag--danger" : "";
  return `<span class="el-tag${tone}">${escapeHtml(status)}</span>`;
}

function elapsed(since) {
  const ms = Math.max(0, Date.now() - Date.parse(since));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const row = (label, value) => `            <dt>${label}</dt><dd>${value}</dd>`;

function loopSection(overview) {
  const { loop } = overview;
  const tone = loop.status === "awaiting-review" ? " el-tag--danger" : loop.status === "running" ? " el-tag--accent" : "";
  const role = loop.role
    ? `${escapeHtml(loop.role)} · <time class="el-elapsed" data-since="${escapeHtml(loop.turnStartedAt)}" datetime="${escapeHtml(loop.turnStartedAt)}" title="turn started ${escapeHtml(loop.turnStartedAt)}">${elapsed(loop.turnStartedAt)}</time>`
    : '<span class="el-muted">no open turn</span>';
  return `        <section class="el-section el-loop" aria-labelledby="el-loop-title">
          <div class="el-section__head"><h2 id="el-loop-title">Loop</h2><span class="el-tag${tone}" data-loop-status="${escapeHtml(loop.status ?? "none")}">${escapeHtml(loop.label)}</span></div>
          <dl class="el-kv">
${[
  row("mode", escapeHtml(overview.mode ?? "unknown")),
  row("phase", escapeHtml(overview.activePhase ?? "none")),
  row("task", escapeHtml(overview.activeTask ?? "none")),
  row("role", role),
  row("iteration", loop.iteration === null ? "none" : String(loop.iteration)),
].join("\n")}
          </dl>
        </section>
`;
}

export function relativeTime(at, now = Date.now()) {
  const ms = now - Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const ago = (at) => (at ? `<time class="el-ago" data-ago="${escapeHtml(at)}" datetime="${escapeHtml(at)}" title="${escapeHtml(at)}">${relativeTime(at)}</time>` : "");

// What the driver session is doing now (Task 3): the tail of its transcript, newest first.
export function renderActivity(activity) {
  const items = activity?.items ?? [];
  const head = [
    activity?.role ? `<span class="el-tag el-tag--accent">${escapeHtml(activity.role)}</span>` : "",
    items[0]?.at ? `<span class="el-meta">last ${ago(items[0].at)}</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const body = items.length
    ? `          <ol class="el-feed">
${items
  .map(
    (item) =>
      `            <li class="el-feed__item" data-kind="${escapeHtml(item.kind)}"><span class="el-feed__time el-meta">${ago(item.at)}</span><span class="el-feed__kind">${escapeHtml(item.kind === "message" ? (item.role ?? "message") : item.kind)}</span><span class="el-feed__text">${escapeHtml(item.summary)}</span></li>`,
  )
  .join("\n")}
          </ol>`
    : '          <p class="el-muted">No activity recorded yet.</p>';
  return `        <section class="el-section el-activity" id="el-activity" data-live-activity aria-labelledby="el-activity-title">
          <div class="el-section__head"><h2 id="el-activity-title">Activity</h2>${head}</div>
${body}
        </section>
`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function waitLine(label, wait) {
  if (!wait.count) return row(label, '<span class="el-muted">none</span>');
  return row(label, `${plural(wait.count, "wait")} · ${formatDuration(wait.durationMs)}${wait.open ? ' · <span class="el-tag el-tag--danger">waiting now</span>' : ""}`);
}

// Turn statistics (Task 3), from the progress log; the numbers match progress-report.md.
function statisticsSection(stats) {
  if (!stats) return "";
  const empty = '<p class="el-muted">No completed turns yet.</p>';
  const roles = stats.byRole.length
    ? `<div class="el-table-wrap"><table class="el-table" data-stats="roles">
              <thead><tr><th>role</th><th>turns</th><th>total</th><th>average</th></tr></thead>
              <tbody>
${stats.byRole.map((item) => `                <tr data-role="${escapeHtml(item.role)}"><td>${escapeHtml(item.role)}</td><td>${item.turns}</td><td>${formatDuration(item.durationMs)}</td><td>${formatDuration(item.averageMs)}</td></tr>`).join("\n")}
              </tbody>
            </table></div>`
    : empty;
  const phases = stats.phases.length
    ? `<div class="el-table-wrap"><table class="el-table" data-stats="phases">
              <thead><tr><th>phase / task</th><th>turns</th><th>active time</th></tr></thead>
              <tbody>
${stats.phases
  .map((phase) =>
    [
      `                <tr class="el-stats__phase" data-phase="${escapeHtml(phase.phase)}"><td>${escapeHtml(phase.phase)}</td><td>${phase.turns}</td><td>${formatDuration(phase.durationMs)}</td></tr>`,
      ...phase.tasks.map(
        (task) =>
          `                <tr class="el-stats__task" data-task="${escapeHtml(task.task)}"><td>${escapeHtml(task.task)}</td><td>${task.turns}</td><td>${formatDuration(task.durationMs)}</td></tr>`,
      ),
    ].join("\n"),
  )
  .join("\n")}
              </tbody>
            </table></div>`
    : empty;
  return `        <section class="el-section el-stats">
          <details id="el-stats">
            <summary><h2>Turn statistics</h2> <span class="el-meta">${formatDuration(stats.activeMs)} active · ${plural(stats.turns, "turn")}</span></summary>
            <dl class="el-kv">
${[
  row("active time", formatDuration(stats.activeMs)),
  row("turns", `${stats.completedTurns} completed · ${stats.interruptedTurns} interrupted · ${stats.abortedTurns} aborted`),
  row("wall time", `${formatDuration(stats.elapsedMs)} · ${formatDuration(stats.idleMs)} idle or paused`),
  waitLine("background waits", stats.waits.background),
  waitLine("awaiting review", stats.waits.review),
].join("\n")}
            </dl>
            <h3>By role</h3>
            ${roles}
            <h3>By phase and task</h3>
            ${phases}
          </details>
        </section>
`;
}

// Gates (implementation_loop.gates): a blocking gate means the loop waits for this review.
function gateNotices(slug, reviews, gates) {
  if (!gates.length) return "";
  const titleOf = (id) => reviews.find((review) => review.id === id)?.title ?? id;
  const items = gates
    .map((gate) => {
      const text =
        gate.kind === "stop-report"
          ? "The loop stopped and waits for this report to be answered."
          : gate.blocking
            ? "The loop waits for this review."
            : "The loop keeps working; answer when you can.";
      return `          <div class="el-notice ${gate.blocking ? "el-notice--danger" : "el-notice--action"}" data-gate="${escapeHtml(gate.review)}" data-blocking="${gate.blocking}">
            <span class="el-tag ${gate.blocking ? "el-tag--danger" : "el-tag--accent"}">${gate.kind === "stop-report" ? "stop report" : gate.blocking ? "blocking gate" : "gate"}</span>
            <div><div class="el-notice__title">${escapeHtml(titleOf(gate.review))}</div><p class="el-notice__text">${text}${gate.status === "open" ? "" : ` · ${escapeHtml(gate.status)}`}</p></div>
            <a class="el-btn el-btn--primary" href="${reviewHref(slug, gate.review)}">Open</a>
          </div>`;
    })
    .join("\n");
  return `        <section class="el-section el-gates">
          <div class="el-section__head"><h2>Gates</h2><span class="el-meta">${gates.length}</span></div>
${items}
        </section>
`;
}

function queueItem(slug, item) {
  const held = item.tasks.length ? ` · holds ${item.tasks.map((task) => `${escapeHtml(task.tid ?? "")} ${escapeHtml(task.title)}`.trim()).join(", ")}` : "";
  const link = item.review ? ` <a href="${reviewHref(slug, item.review)}">answer on its page</a>` : "";
  return `              <li data-item="${escapeHtml(item.id)}"><span class="el-id">${escapeHtml(item.id)}</span> ${escapeHtml(item.ask)}<div class="el-meta">blocks ${escapeHtml(item.blocks || "nothing named")}${held}</div>${link}</li>`;
}

function waitingSection(slug, reviews, gates, overview) {
  const pending = reviews.filter((review) => !review.submittedAt);
  const gateIds = new Set(gates.map((gate) => gate.review));
  const notices = pending
    .map(
      (review) => `          <div class="el-notice el-notice--action">
            <span class="el-id">${escapeHtml(review.id)}</span>
            <div><div class="el-notice__title">${escapeHtml(review.title)}${gateIds.has(review.id) ? ' <span class="el-tag el-tag--accent">gate</span>' : ""}</div><p class="el-notice__text">Waiting for your answers${review.savedAt ? ` · draft saved ${escapeHtml(review.savedAt)}` : ""}</p></div>
            <a class="el-btn el-btn--primary" href="${reviewHref(slug, review.id)}">Open</a>
          </div>`,
    )
    .join("\n");
  const holds = overview.holds
    .map(
      (group) => `          <div class="el-holds" data-hold-kind="${escapeHtml(group.kind)}">
            <h3>${escapeHtml(group.kind)} <span class="el-meta">${group.items.length}</span></h3>
            <ul class="el-list">
${group.items.map((item) => queueItem(slug, item)).join("\n")}
            </ul>
          </div>`,
    )
    .join("\n");
  const external = overview.external.length
    ? `          <div class="el-holds" data-hold-kind="external-wait">
            <h3>external waits <span class="el-meta">${overview.external.length}</span></h3>
            <ul class="el-list">
${overview.external.map((item) => queueItem(slug, item)).join("\n")}
            </ul>
          </div>`
    : "";
  const count = pending.length + overview.holds.reduce((sum, group) => sum + group.items.length, 0) + overview.external.length;
  const body = [notices, holds, external].filter(Boolean).join("\n") || '          <p class="el-muted">Nothing is waiting for you.</p>';
  return `        <section class="el-section el-waiting">
          <div class="el-section__head"><h2>Waiting for you</h2>${pendingBadge(count)}</div>
${body}
        </section>
`;
}

function decisionsSection(overview) {
  if (!overview.decisions.length) return "";
  return `        <section class="el-section el-decisions">
          <div class="el-section__head"><h2>Agent-made decisions to confirm</h2><span class="el-meta">${overview.decisions.length}</span></div>
          <ul class="el-list">
${overview.decisions.map((decision) => `            <li data-decision="${escapeHtml(decision.id)}"><span class="el-id">${escapeHtml(decision.id)}</span> ${escapeHtml(decision.title)}${decision.default ? `<div class="el-meta">default taken: ${escapeHtml(decision.default)}</div>` : ""}</li>`).join("\n")}
          </ul>
        </section>
`;
}

function taskLine(task, key) {
  const details = [
    task.hold ? ["Hold", `${task.hold.kind} (${task.hold.item})`] : null,
    ...["outcome", "acceptance", "docs", "method", "evidence"].map((name) => (task.details[name] ? [name[0].toUpperCase() + name.slice(1), task.details[name]] : null)),
  ].filter(Boolean);
  const head = `<span class="el-id">${escapeHtml(task.tid ?? "·")}</span> ${statusTag(task.status)} <span class="el-task__title">${escapeHtml(task.title)}</span> <span class="el-meta">${escapeHtml(task.kind)}</span>`;
  if (!details.length) return `              <li class="el-task" data-task="${escapeHtml(task.tid ?? key)}" data-status="${escapeHtml(task.status)}">${head}</li>`;
  return `              <li class="el-task" data-task="${escapeHtml(task.tid ?? key)}" data-status="${escapeHtml(task.status)}"><details id="task-${escapeHtml(task.tid ?? key)}"><summary>${head}</summary>
                <dl class="el-kv">${details.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>
              </details></li>`;
}

function phasesSection(overview) {
  const phases = overview.phases
    .map((phase) => {
      const open = phase.status === "doing" ? " open" : "";
      const value = phase.total ? phase.done / phase.total : 0;
      const archived = phase.archived ? `<li class="el-task el-muted">${phase.archived} closed task${phase.archived === 1 ? "" : "s"} archived</li>` : "";
      return `          <details class="el-phase" id="${escapeHtml(phase.id)}" data-phase="${escapeHtml(phase.id)}"${open}>
            <summary><span class="el-phase__title">${escapeHtml(phase.heading)}</span> ${statusTag(phase.status)} <span class="el-meta">${phase.done} / ${phase.total} done</span> <span class="el-progress" style="--value: ${value}" role="progressbar" aria-label="${escapeHtml(phase.heading)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}"></span></summary>
            <ul class="el-tasks">
${[...phase.tasks.map((task, index) => taskLine(task, `${phase.id}-${index + 1}`)), archived].filter(Boolean).join("\n")}
            </ul>
          </details>`;
    })
    .join("\n");
  const followUps = overview.followUps.length
    ? `
          <details class="el-phase" id="follow-ups" data-phase="follow-ups"${overview.followUps.some((task) => task.status !== "done") ? " open" : ""}>
            <summary><span class="el-phase__title">Follow-up tasks</span> <span class="el-meta">${overview.followUps.filter((task) => task.status === "done").length} / ${overview.followUps.length} done</span></summary>
            <ul class="el-tasks">
${overview.followUps.map((task, index) => taskLine(task, `follow-up-${index + 1}`)).join("\n")}
            </ul>
          </details>`
    : "";
  return `        <section class="el-section el-phases">
          <div class="el-section__head"><h2>Phases and tasks</h2></div>
${phases || '          <p class="el-muted">No phases yet.</p>'}${followUps}
        </section>
`;
}

// The inbox (D22): a no-JS form that sends a request to the running loop, and the last entries.
function inboxSection(slug, inbox) {
  const recent = inbox.slice(-5).toReversed();
  const list = recent.length
    ? `
          <ul class="el-inbox__list">
${recent.map((entry) => `            <li><span class="el-id">${escapeHtml(entry.id)}</span> <span class="el-meta">${escapeHtml(entry.createdAt)}</span><div>${escapeHtml(entry.text)}</div></li>`).join("\n")}
          </ul>`
    : "";
  return `        <section class="el-section el-inbox">
          <div class="el-section__head"><h2>Send to the loop</h2><span class="el-meta">${inbox.length}</span></div>
          <form class="el-card el-inbox__form" method="post" action="/api/${encodeURIComponent(slug)}/inbox" style="display:grid;gap:8px">
            <label class="el-field__label" for="el-inbox-text">A request or a change for the loop; it is picked up at the next role transition.</label>
            <textarea id="el-inbox-text" class="el-comment" name="text" rows="3" maxlength="4000" required></textarea>
            <div><button class="el-btn el-btn--primary" type="submit">Send to the loop</button></div>
          </form>${list}
        </section>
`;
}

function historySection(slug, reviews) {
  const done = reviews.filter((review) => review.submittedAt);
  if (!done.length) return "";
  return `        <section class="el-section">
          <div class="el-section__head"><h2>Answered</h2><span class="el-meta">${done.length}</span></div>
          <div class="el-table-wrap"><table class="el-table">
            <thead><tr><th>review</th><th>title</th><th>submitted</th></tr></thead>
            <tbody>
${done.map((review) => `              <tr><td><span class="el-id">${escapeHtml(review.id)}</span></td><td><a href="${reviewHref(slug, review.id)}">${escapeHtml(review.title)}</a></td><td class="el-meta"><time datetime="${escapeHtml(review.submittedAt)}" title="${escapeHtml(review.submittedAt)}">${escapeHtml(review.submittedAt)}</time></td></tr>`).join("\n")}
            </tbody>
          </table></div>
        </section>`;
}

export function renderHomeMain({ activity = null, epic, gates = [], inbox = [], overview, reviews, statistics = null }) {
  const title = overview.title ?? epic.title;
  return `        <div class="el-page-head"><div class="el-label">epic</div><h1>${escapeHtml(title)}</h1><p class="el-meta">${escapeHtml(epic.slug)} · ${escapeHtml(overview.mode ?? epic.mode)}</p>${overview.intent ? `<p class="el-intent">${escapeHtml(overview.intent)}</p>` : ""}</div>
${loopSection(overview)}${renderActivity(activity)}${gateNotices(epic.slug, reviews, gates)}${waitingSection(epic.slug, reviews, gates, overview)}${decisionsSection(overview)}${phasesSection(overview)}${statisticsSection(statistics)}${inboxSection(epic.slug, inbox)}${historySection(epic.slug, reviews)}`;
}

export function renderEpicHome(projectName, view) {
  const { epic, overview, reviews } = view;
  const pending = reviews.filter((review) => !review.submittedAt).length;
  return layout({
    title: overview.title ?? epic.title,
    crumbs: [
      { href: "/", label: projectName },
      { href: `/${encodeURIComponent(epic.slug)}`, label: epic.slug },
    ],
    headerEnd: `<span class="el-live el-meta" data-live="connecting" aria-live="polite">live</span> <span class="el-meta">pending</span> ${pendingBadge(pending)}`,
    main: { attributes: ` data-epic="${escapeHtml(epic.slug)}" data-live-main` },
    scripts: ['<script type="module" src="/_runtime/home.js"></script>'],
    body: renderHomeMain(view),
  });
}
