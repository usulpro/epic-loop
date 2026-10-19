// Watches the epic app while a real loop runs in the sandbox, from outside the agent session (D-19).
// Tab 1 keeps the home open and records, in the page, every feed item and loop-state change it sees.
// Tab 2 checks docs, ids, waits and decisions, then (after the live phase) the statistics against
// progress-report.md, the RU switch with the real cheap model and its cache, the themes through
// emulated prefers-color-scheme, and the review page. Writes check.jsonl, timing.json, html/ and
// shots/ under --out, and the marker <out>/viewer-done.txt at the end.
// Usage: node viewer-check.mjs --sandbox <dir> --out <dir> --url <server url> [--max-minutes 35]
import fs from "node:fs";
import path from "node:path";

const REPO = "/projects/my-projects/epic-loop-workspace/epic-loop-visual";
const { closeChrome, connect, createSession, launchChrome, sleep } = await import(`${REPO}/packages/cli/scripts/cdp.mjs`);

const flag = (name, fallback = null) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const S = flag("--sandbox");
const OUT = flag("--out");
const URL_BASE = flag("--url");
const MAX_MS = Number(flag("--max-minutes", "35")) * 60000;
const SLUG = "mini";
const EPIC = path.join(S, ".epic-loop", "epics", SLUG);
const SHOTS = path.join(OUT, "shots");
const HTML = path.join(OUT, "html");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(HTML, { recursive: true });
const failures = [];
const record = (entry) => fs.appendFileSync(path.join(OUT, "check.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
const log = (line) => {
  console.log(`check: ${line}`);
  record({ line });
};
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};
const jobsCount = () => {
  const file = path.join(EPIC, ".runtime", "translations", "ru", "jobs.jsonl");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).length : 0;
};
const page = (pathname) => new URL(pathname, URL_BASE).href;
const plain = (html) => html.replace(/<a class="el-ref"[^>]*>([^<]*)<\/a>/gu, "$1");

// Records, inside the home tab, the first time each feed item and each loop state is seen.
const OBSERVER = `(() => {
  if (window.__viewer) return true;
  const v = (window.__viewer = { items: {}, states: [], tasks: {} });
  const scan = () => {
    const now = Date.now();
    for (const li of document.querySelectorAll('#el-activity .el-feed__item')) {
      const at = li.querySelector('time')?.dataset.ago;
      const text = li.querySelector('.el-feed__text')?.textContent ?? '';
      // Not li.textContent: it holds the ticking relative time, which would re-key the same item.
      const key = at + '|' + li.dataset.kind + '|' + text;
      if (at && !v.items[key]) v.items[key] = { at, kind: li.dataset.kind, seen: now, text: text.slice(0, 120) };
    }
    const role = [...document.querySelectorAll('.el-loop dt')].find((dt) => dt.textContent === 'role')?.nextElementSibling?.textContent.split(' ·')[0] ?? null;
    const status = document.querySelector('[data-loop-status]')?.dataset.loopStatus ?? null;
    const last = v.states.at(-1);
    if (!last || last.role !== role || last.status !== status) v.states.push({ role, seen: now, status });
    for (const li of document.querySelectorAll('[data-task]')) {
      const list = (v.tasks[li.dataset.task] ??= []);
      if (list.at(-1)?.status !== li.dataset.status) list.push({ seen: now, status: li.dataset.status });
    }
  };
  new MutationObserver(scan).observe(document.querySelector('main'), { childList: true, subtree: true });
  scan();
  return true;
})()`;

async function themeShots(s, name) {
  for (const scheme of ["light", "dark"]) {
    await s.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
    await sleep(500);
    const background = await s.evaluate("getComputedStyle(document.body).backgroundColor");
    const forced = await s.evaluate("document.documentElement.hasAttribute('data-theme')");
    record({ background, forced, scheme, shot: name });
    await s.shot(`${name}-${scheme}`);
  }
  await s.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
}

async function saveHtml(name, pathname, cookie = null) {
  const response = await fetch(page(pathname), { headers: cookie ? { cookie } : {} });
  fs.writeFileSync(path.join(HTML, `${name}.html`), await response.text());
}

async function liveHome(home, started) {
  await home.send("Page.navigate", { url: page(`/${SLUG}`) });
  await home.waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home live", 30000);
  await home.evaluate(OBSERVER);
  let transcriptChecked = false;
  while (Date.now() - started < MAX_MS) {
    await sleep(3000);
    const v = await home.evaluate("window.__viewer").catch(() => null);
    if (!v) {
      await home.evaluate(OBSERVER).catch(() => {});
      continue;
    }
    const loop = readJson(path.join(EPIC, ".runtime", "runtime-state.json"))?.implementation_loop;
    if (!transcriptChecked && loop?.driver_transcript_path) {
      transcriptChecked = true;
      home.expect(fs.existsSync(loop.driver_transcript_path) && loop.driver_transcript_path.endsWith(".jsonl"), `driver_transcript_path is recorded: ${loop.driver_transcript_path}`);
    }
    const tools = Object.values(v.items).filter((item) => item.kind === "tool" && Date.parse(item.at) > started);
    const roles = new Set(v.states.map((state) => state.role).filter((role) => role && role !== "no open turn"));
    const done = Object.entries(v.tasks).filter(([, list]) => list.length > 1 && list.at(-1).status === "done");
    if (tools.length >= 10 && roles.size >= 2 && done.length >= 1) {
      // Tool lines reach the transcript only when their message completes (0.1-5 s after their
      // timestamp); tool results land within about 0.1 s, so they time the viewer itself.
      const results = Object.values(v.items).filter((item) => item.kind === "result" && Date.parse(item.at) > started);
      const delays = results.map((item) => item.seen - Date.parse(item.at)).toSorted((a, b) => a - b);
      const timing = { median: delays[Math.floor(delays.length / 2)], samples: delays.length, worst: delays.at(-1), delays };
      fs.writeFileSync(path.join(OUT, "timing.json"), JSON.stringify({ items: Object.values(v.items), roles: [...roles], states: v.states, tasks: v.tasks, timing }, null, 1));
      home.expect(true, `live home: ${tools.length} new tool items, roles seen ${[...roles].join(", ")}, tasks done on the page: ${done.map(([id]) => id).join(", ")}`);
      home.expect(timing.median < 3000, `feed delay median ${timing.median} ms, worst ${timing.worst} ms over ${timing.samples} samples`);
      home.expect(transcriptChecked, "the transcript path was checked");
      return true;
    }
  }
  home.expect(false, "the live phase reached its conditions before the time limit");
  return false;
}

async function docsAndIds(s) {
  await s.send("Page.navigate", { url: page(`/${SLUG}/docs/docs/notes.md`) });
  await s.waitFor("document.readyState === 'complete' && !!window.epicLoopRefs", "notes page", 20000);
  s.expect((await s.evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")) >= 6, "notes: id mentions are links");
  const hrefs = await s.evaluate("[...document.querySelectorAll('article.el-doc a:not(.el-ref)')].map((a) => a.getAttribute('href'))");
  for (const href of hrefs) {
    const response = await fetch(page(href.split("#")[0]));
    const text = await response.text();
    const anchor = href.includes("#") ? href.slice(href.indexOf("#") + 1) : null;
    s.expect(response.status === 200 && (!anchor || text.includes(`id="${decodeURIComponent(anchor)}"`)), `link ${href} resolves${anchor ? " to its anchor" : ""}`);
  }
  const box = await s.evaluate("(() => { const r = document.querySelector('article.el-doc a.el-ref[data-ref=\"D1\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await s.waitFor("window.epicLoopRefs.open === 'D1'", "popover", 5000);
  s.expect((await s.evaluate("document.querySelector('#el-refpop .el-refpop__title').textContent")) === "The helpers stay in one module", "the D1 popover shows its title");
  await themeShots(s, "doc-popover-en");
  await saveHtml("doc-notes-en", `/${SLUG}/docs/docs/notes.md`);
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await s.evaluate("document.querySelector('article.el-doc a[href$=\"tracker.md#T2\"]').click()");
  await s.waitFor("location.pathname.endsWith('/docs/tracker.md') && location.hash === '#T2' && document.readyState === 'complete'", "follow link", 10000);
  s.expect(await s.evaluate("!!document.getElementById('T2')"), "following the tracker link lands on #T2");

  await s.send("Page.navigate", { url: page(`/${SLUG}`) });
  await s.waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home tab 2", 20000);
  s.expect(await s.evaluate("!!document.querySelector('[data-hold-kind=\"human-action\"] [data-item=\"H1\"]')"), "the home lists H1 under human-action");
  s.expect(await s.evaluate("!!document.querySelector('[data-decision=\"D1\"]')"), "the home lists the unconfirmed D1");
  s.expect(await s.evaluate("!!document.querySelector('[data-docs-group=\"docs\"] a[href$=\"notes.md\"]')"), "the home lists the docs");
  await themeShots(s, "home-live-en");
  await saveHtml("home-live-en", `/${SLUG}`);
}

async function statistics(s) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const report = fs.readFileSync(path.join(EPIC, ".runtime", "progress-report.md"), "utf8");
    const html = plain(await (await fetch(page(`/${SLUG}?fragment=main`))).text());
    const field = (label) => report.match(new RegExp(`^- ${label}: (.+)$`, "mu"))?.[1];
    const roles = [...report.matchAll(/^- (manager|techlead|engineer): (.+) across (\d+) turns?$/gmu)];
    const checks = [
      html.includes(`<dt>active time</dt><dd>${field("Active turn time")}</dd>`),
      html.includes(`<dt>turns</dt><dd>${field("Completed turns")} completed · ${field("Interrupted turns")} interrupted · ${field("Aborted turns")} aborted</dd>`),
      ...roles.map(([, role, total, turns]) => html.includes(`<tr data-role="${role}"><td>${role}</td><td>${turns}</td><td>${total}</td>`)),
    ];
    if (checks.every(Boolean)) {
      s.expect(true, `statistics match progress-report.md (attempt ${attempt}): active ${field("Active turn time")}, ${field("Completed turns")} completed, ${roles.length} roles`);
      fs.writeFileSync(path.join(OUT, "progress-report-at-match.md"), report);
      return;
    }
    await sleep(1500);
  }
  s.expect(false, "statistics match progress-report.md");
}

async function translation(s) {
  const before = jobsCount();
  await s.send("Page.navigate", { url: page(`/${SLUG}/docs/docs/notes.md?lang=ru`) });
  await s.waitFor("document.readyState === 'complete' && document.cookie.includes('el-lang=ru')", "RU switch", 20000);
  const started = Date.now();
  await s.waitFor("document.querySelector('article.el-doc h1')?.textContent !== 'Notes' && !document.querySelector('[data-translating]')", "translated notes", 180000);
  s.expect(true, `notes translated in ${Date.now() - started} ms: ${await s.evaluate("document.querySelector('article.el-doc h1').textContent")}`);
  s.expect((await s.evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")) >= 6, "ids still expand in the translation");
  const box = await s.evaluate("(() => { const r = document.querySelector('article.el-doc a.el-ref[data-ref=\"D1\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await s.waitFor("window.epicLoopRefs.open === 'D1'", "popover ru", 5000);
  await themeShots(s, "doc-popover-ru");
  await saveHtml("doc-notes-ru", `/${SLUG}/docs/docs/notes.md`, "el-lang=ru");
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  const afterDoc = jobsCount();
  await s.send("Page.navigate", { url: page(`/${SLUG}/docs/docs/notes.md`) });
  await s.waitFor("document.readyState === 'complete' && !document.querySelector('[data-translating]')", "notes again", 20000);
  s.expect(jobsCount() === afterDoc, `a second visit to the doc is a cache hit (jobs ${before} -> ${afterDoc} -> ${jobsCount()})`);

  await s.send("Page.navigate", { url: page(`/${SLUG}`) });
  await s.waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home ru", 20000);
  const homeStarted = Date.now();
  await s.waitFor("document.getElementById('el-loop-title')?.textContent !== 'Loop'", "translated home", 180000);
  s.expect(true, `home labels translated in ${Date.now() - homeStarted} ms: ${await s.evaluate("document.getElementById('el-loop-title').textContent")}`);
  await sleep(4000);
  await themeShots(s, "home-ru");
  await saveHtml("home-ru", `/${SLUG}`, "el-lang=ru");
  const afterHome = jobsCount();
  await fetch(page(`/${SLUG}/docs/docs/notes.md`), { headers: { cookie: "el-lang=ru" } });
  s.expect(jobsCount() === afterHome, "the translated doc stays cached after the home's jobs");
  const jobs = fs.readFileSync(path.join(EPIC, ".runtime", "translations", "ru", "jobs.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  record({ jobs });
  s.expect(jobs.every((job) => job.platform === "claude-code" && job.model === "haiku"), `jobs ran on claude-code haiku: ${jobs.map((job) => `${job.kind} ${job.ms} ms ${job.ok ? "ok" : job.reason}`).join("; ")}`);
  await s.send("Page.navigate", { url: page(`/${SLUG}?lang=en`) });
  await s.waitFor("document.readyState === 'complete' && document.cookie.includes('el-lang=en')", "back to EN", 20000);
}

async function reviewPage(s) {
  await s.send("Page.navigate", { url: page(`/${SLUG}/reviews/2026-10-20-package-name/`) });
  await s.waitFor("document.readyState === 'complete' && !!window.epicLoop && window.epicLoopRefs?.wrapped > 0", "review page", 20000);
  s.expect(true, `the review page wraps ${await s.evaluate("window.epicLoopRefs.wrapped")} ids`);
  await themeShots(s, "review");
  await saveHtml("review", `/${SLUG}/reviews/2026-10-20-package-name/`);
}

async function main() {
  const started = Date.now();
  const browser = await launchChrome("/usr/bin/google-chrome");
  const cdp = connect(browser.wsUrl);
  try {
    await cdp.ready;
    // The home tab stays the only, foreground tab during the live phase: attempt 2 opened a second
    // tab after 20 s, and the backgrounded home lagged by seconds (headless Chrome throttles it).
    const home = await createSession(cdp, { failures, log, shots: SHOTS });
    await home.send("Page.bringToFront");
    const ok = await liveHome(home, started);
    const tab = await createSession(cdp, { failures, log, shots: SHOTS });
    await tab.send("Page.bringToFront");
    await docsAndIds(tab).catch((error) => tab.expect(false, `docs and ids: ${error.message}`));
    if (ok) await statistics(tab).catch((error) => tab.expect(false, `statistics: ${error.message}`));
    await translation(tab).catch((error) => tab.expect(false, `translation: ${error.message}`));
    await reviewPage(tab).catch((error) => tab.expect(false, `review page: ${error.message}`));
    await home.send("Page.bringToFront");
    await home.shot("home-live-tab1");
  } catch (error) {
    failures.push(error.message);
    log(`ERROR ${error.stack}`);
  } finally {
    await closeChrome(browser, cdp);
    fs.writeFileSync(path.join(OUT, "viewer-done.txt"), `${failures.length ? `failed: ${failures.join(" | ")}` : "all passed"}\n`);
    console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
  }
}

await main();
