// The live epic home and doc pages (Phase 5): follows /api/<slug>/events and swaps in the fresh
// <main> from <this page>?fragment=main after each change (a doc page only after a change to its
// own file, named by data-live-file), keeping the scroll position, the open state of every
// <details id>, and an unsent inbox draft. An `activity` event refreshes only the activity section
// from /<slug>?fragment=activity. Ticks the elapsed time of the open role turn and the relative
// times of the feed. The page works without this script; it is only current on reload then.
const main = document.querySelector("main[data-live-main]");
const marker = document.querySelector(".el-live");
const slug = main?.dataset.epic;
const liveFile = main?.dataset.liveFile ?? null;
const state = { activityRefreshes: 0, refreshes: 0, live: "connecting" };
window.epicLoopHome = state;

function formatElapsed(ms) {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  const seconds = Math.floor((Math.max(0, ms) % 60000) / 1000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatAgo(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function tick() {
  for (const node of document.querySelectorAll("time[data-since]")) node.textContent = formatElapsed(Date.now() - Date.parse(node.dataset.since));
  for (const node of document.querySelectorAll("time[data-ago]")) node.textContent = formatAgo(Date.now() - Date.parse(node.dataset.ago));
}

function setLive(value) {
  state.live = value;
  if (!marker) return;
  marker.dataset.live = value;
  marker.textContent = value === "paused" ? "live updates paused" : "live";
}

// Content-Language carries the language chosen by the cookie (not whether a translation is ready).
function languageChanged(response) {
  const lang = response.headers.get("content-language");
  const chosen = document.querySelector('.el-lang [aria-current="true"]')?.dataset.lang ?? "en";
  if (!lang || lang === chosen) return false;
  location.reload();
  return true;
}

let inFlight = null;
let again = false;
async function refresh() {
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    const response = await fetch(`${location.pathname}?fragment=main`, { cache: "no-store", headers: { accept: "text/html" } });
    if (!response.ok) return;
    // The language changed in another tab (the cookie is shared): reload so the header switch and
    // <html lang> follow, instead of swapping translated content into an English page.
    if (languageChanged(response)) return;
    const html = await response.text();
    const openState = new Map([...main.querySelectorAll("details[id]")].map((node) => [node.id, node.open]));
    const draft = main.querySelector("#el-inbox-text");
    const draftValue = draft?.value ?? "";
    const draftFocused = document.activeElement === draft;
    const scroll = window.scrollY;
    main.innerHTML = html;
    for (const [id, open] of openState) {
      const node = main.querySelector(`details[id="${CSS.escape(id)}"]`);
      if (node) node.open = open;
    }
    const nextDraft = main.querySelector("#el-inbox-text");
    if (nextDraft && draftValue) nextDraft.value = draftValue;
    if (nextDraft && draftFocused) nextDraft.focus();
    window.scrollTo(0, scroll);
    tick();
    state.refreshes += 1;
    main.dispatchEvent(new CustomEvent("epic-loop:refreshed"));
  })().finally(() => {
    inFlight = null;
    if (again) {
      again = false;
      refresh();
    }
  });
  return inFlight;
}

let activityInFlight = null;
let activityAgain = false;
async function refreshActivity() {
  if (activityInFlight) {
    activityAgain = true;
    return activityInFlight;
  }
  activityInFlight = (async () => {
    if (inFlight) await inFlight;
    const response = await fetch(`/${encodeURIComponent(slug)}?fragment=activity`, { cache: "no-store", headers: { accept: "text/html" } });
    const section = main.querySelector("[data-live-activity]");
    if (!response.ok || !section || languageChanged(response)) return;
    const template = document.createElement("template");
    template.innerHTML = (await response.text()).trim();
    const next = template.content.firstElementChild;
    if (!next) return;
    section.replaceWith(next);
    tick();
    state.activityRefreshes += 1;
    main.dispatchEvent(new CustomEvent("epic-loop:activity"));
  })().finally(() => {
    activityInFlight = null;
    if (activityAgain) {
      activityAgain = false;
      refreshActivity();
    }
  });
  return activityInFlight;
}

let delay = 1000;
function connect() {
  const source = new EventSource(`/api/${encodeURIComponent(slug)}/events`);
  source.addEventListener("open", () => {
    const wasPaused = state.live === "paused";
    delay = 1000;
    setLive("live");
    // A job may have finished before the stream connected: a page still translating checks once.
    if (wasPaused || main.querySelector("[data-translating]")) refresh();
  });
  source.addEventListener("change", (event) => {
    if (!liveFile) return refresh();
    try {
      if (JSON.parse(event.data).file === liveFile) refresh();
    } catch {}
  });
  // A finished translation job: swap in the (now translated) fragment.
  source.addEventListener("translated", () => refresh());
  source.addEventListener("activity", () => {
    if (main.querySelector("[data-live-activity]")) refreshActivity();
  });
  source.addEventListener("error", () => {
    source.close();
    setLive("paused");
    setTimeout(connect, delay);
    delay = Math.min(delay * 2, 30000);
  });
}

// Fallback while a doc page says "Translating…": refresh now and then in case the event is missed.
let translatingChecks = 0;
setInterval(() => {
  if (main?.querySelector("[data-translating]") && translatingChecks < 20) {
    translatingChecks += 1;
    refresh();
  }
}, 15000);

if (main && slug) {
  tick();
  setInterval(tick, 1000);
  connect();
}
