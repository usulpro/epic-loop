// Part 3: this epic's own artifacts in the app, on a migrated copy. Translates docs/review-engine.md,
// state-of-epic.md and the home with the real cheap model through the RU switch, and screenshots the
// home and a doc in both themes (emulated prefers-color-scheme) and both languages.
// Usage: node epic-check.mjs --sandbox <dir> --out <dir> --url <server url>
import fs from "node:fs";
import path from "node:path";

const REPO = "/projects/my-projects/epic-loop-workspace/epic-loop-visual";
const { closeChrome, connect, createSession, launchChrome, sleep } = await import(`${REPO}/packages/cli/scripts/cdp.mjs`);
const flag = (name) => process.argv[process.argv.indexOf(name) + 1];
const S = flag("--sandbox");
const OUT = flag("--out");
const URL_BASE = flag("--url");
const SLUG = "visual-review";
const EPIC = path.join(S, ".epic-loop", "epics", SLUG);
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const failures = [];
const page = (pathname) => new URL(pathname, URL_BASE).href;
const jobs = () => {
  const file = path.join(EPIC, ".runtime", "translations", "ru", "jobs.jsonl");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
};

async function shots(s, name) {
  for (const scheme of ["light", "dark"]) {
    await s.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
    await sleep(500);
    await s.shot(`${name}-${scheme}`);
  }
}

const browser = await launchChrome("/usr/bin/google-chrome");
const cdp = connect(browser.wsUrl);
try {
  await cdp.ready;
  const s = await createSession(cdp, { failures, shots: SHOTS });
  await s.send("Page.navigate", { url: page(`/${SLUG}`) });
  await s.waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home", 30000);
  s.expect((await s.evaluate("document.querySelectorAll('[data-task]').length")) > 20, `the home lists ${await s.evaluate("document.querySelectorAll('[data-task]').length")} tasks`);
  s.expect((await s.evaluate("document.querySelectorAll('main a.el-ref').length")) > 20, `the home links ${await s.evaluate("document.querySelectorAll('main a.el-ref').length")} ids`);
  await shots(s, "epic-home-en");
  await s.send("Page.navigate", { url: page(`/${SLUG}/docs/docs/review-engine.md`) });
  await s.waitFor("document.readyState === 'complete' && !!window.epicLoopRefs", "doc", 30000);
  await shots(s, "epic-doc-en");

  for (const [doc, english] of [
    ["docs/review-engine.md", null],
    ["state-of-epic.md", null],
  ]) {
    const started = Date.now();
    await s.send("Page.navigate", { url: page(`/${SLUG}/docs/${doc}?lang=ru`) });
    await s.waitFor("document.readyState === 'complete' && document.cookie.includes('el-lang=ru')", "ru", 20000);
    const first = english ?? (await s.evaluate("document.querySelector('article.el-doc h1')?.textContent"));
    await s.waitFor(`!document.querySelector('[data-translating]')`, `translated ${doc}`, 200000);
    const note = await s.evaluate("document.querySelector('.el-doc__note')?.textContent ?? null");
    const title = await s.evaluate("document.querySelector('article.el-doc h1')?.textContent");
    const job = jobs().find((item) => item.doc === doc);
    s.expect(!note && title !== first, `${doc} translated in ${Date.now() - started} ms (job ${job?.ms} ms ${job?.ok ? "ok" : job?.reason}): ${title}`);
    s.expect((await s.evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")) > 0, `${doc}: ids expand in the translation (${await s.evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")})`);
  }
  await shots(s, "epic-doc-ru");
  await s.send("Page.navigate", { url: page(`/${SLUG}`) });
  await s.waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home ru", 30000);
  const started = Date.now();
  await s.waitFor("document.getElementById('el-loop-title')?.textContent !== 'Loop'", "translated home", 200000);
  await sleep(3000);
  s.expect(true, `the home translated in ${Date.now() - started} ms`);
  await shots(s, "epic-home-ru");
  fs.writeFileSync(path.join(OUT, "jobs.json"), JSON.stringify(jobs(), null, 1));
  const before = jobs().length;
  await s.send("Page.navigate", { url: page(`/${SLUG}/docs/docs/review-engine.md`) });
  await s.waitFor("document.readyState === 'complete' && !document.querySelector('[data-translating]')", "cached", 20000);
  s.expect(jobs().length === before, "revisiting the translated doc is a cache hit");
} catch (error) {
  failures.push(error.message);
  console.log(`check: ERROR ${error.stack}`);
} finally {
  await closeChrome(browser, cdp);
}
console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
