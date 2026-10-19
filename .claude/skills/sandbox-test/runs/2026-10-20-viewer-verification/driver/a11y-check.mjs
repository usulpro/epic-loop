// Accessibility checks of the served app pages in both themes (emulated prefers-color-scheme), with no
// third-party engine: WCAG AA contrast of every visible text node against its effective background,
// visible focus for each Tab stop, landmarks and heading order, accessible names of controls, and the
// keyboard paths (language switch, id popover with Escape, <details>, the inbox form).
// Usage: node a11y-check.mjs --url <server url> --out <dir> <path> [<path> ...]
import fs from "node:fs";
import path from "node:path";

const REPO = "/projects/my-projects/epic-loop-workspace/epic-loop-visual";
const { closeChrome, connect, createSession, launchChrome, sleep } = await import(`${REPO}/packages/cli/scripts/cdp.mjs`);
const flag = (name) => process.argv[process.argv.indexOf(name) + 1];
const URL_BASE = flag("--url");
const OUT = flag("--out");
const pages = process.argv.slice(2).filter((arg, index, all) => !arg.startsWith("--") && !all[index - 1]?.startsWith("--"));
fs.mkdirSync(OUT, { recursive: true });

const AUDIT = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const background = (el) => { const layers = []; for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const layer of layers.reverse()) base = blend(layer, base); return base; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const contrast = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.data.trim() || !el || seen.has(el)) continue;
    seen.add(el);
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0 || el.closest('[hidden]')) continue;
    const fg = parse(style.color); if (!fg) continue;
    const bg = background(el);
    const r = ratio(blend(fg, bg), bg);
    const size = parseFloat(style.fontSize); const bold = Number(style.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    if (r < (large ? 3 : 4.5)) contrast.push({ text: t.data.trim().slice(0, 40), ratio: Math.round(r * 100) / 100, sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''), color: style.color, size });
  }
  const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || (el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent) || el.closest('label')?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.value || '').trim();
  const unnamed = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]')].filter((el) => el.getClientRects().length && !name(el)).map((el) => el.outerHTML.slice(0, 120));
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.getClientRects().length).map((h) => Number(h.tagName[1]));
  const skips = headings.filter((level, i) => i > 0 && level > headings[i - 1] + 1).length;
  return { contrast, headings: { h1: headings.filter((l) => l === 1).length, skips, order: headings.join('') }, landmarks: { banner: document.querySelectorAll('header').length, main: document.querySelectorAll('main').length, nav: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')) }, lang: document.documentElement.lang, unnamed };
})()`;

// Tabs through the page and reports stops whose focused look does not differ from the unfocused one.
const FOCUS_STATE = `(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), look: [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.backgroundColor, s.borderColor, s.textDecorationThickness].join('|') }; })()`;

const browser = await launchChrome("/usr/bin/google-chrome");
const cdp = connect(browser.wsUrl);
const report = {};
try {
  await cdp.ready;
  const s = await createSession(cdp, { failures: [], shots: null });
  for (const pathname of pages) {
    const entry = (report[pathname] = {});
    for (const scheme of ["light", "dark"]) {
      await s.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await s.send("Page.navigate", { url: new URL(pathname, URL_BASE).href });
      await s.waitFor("document.readyState === 'complete'", "load", 20000);
      await sleep(1500);
      entry[scheme] = await s.evaluate(AUDIT);
    }
    // Focus: compare each Tab stop's look with the same element blurred.
    const stops = [];
    await s.evaluate("document.activeElement?.blur(); window.scrollTo(0, 0)");
    for (let index = 0; index < 40; index += 1) {
      await s.key("Tab");
      const focused = await s.evaluate(FOCUS_STATE);
      if (!focused) continue;
      const blurred = await s.evaluate(`(() => { const el = document.activeElement; el.blur(); const s = getComputedStyle(el); const look = [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.backgroundColor, s.borderColor, s.textDecorationThickness].join('|'); el.focus({ focusVisible: true }); return look; })()`);
      stops.push({ ...focused, visible: focused.look !== blurred });
    }
    entry.focus = { invisible: stops.filter((stop) => !stop.visible), stops: stops.length };
  }
  // Keyboard paths on the doc page: focus an id opens its popover, Escape closes it.
  const doc = pages.find((pathname) => pathname.includes("/docs/"));
  if (doc) {
    await s.send("Page.navigate", { url: new URL(doc, URL_BASE).href });
    await s.waitFor("document.readyState === 'complete' && !!window.epicLoopRefs", "doc", 20000);
    await s.evaluate("document.querySelector('article a.el-ref').focus()");
    await sleep(400);
    const opened = await s.evaluate("window.epicLoopRefs.open");
    await s.key("Escape");
    report.keyboard = { escapeCloses: (await s.evaluate("window.epicLoopRefs.open")) === null, popoverOnFocus: opened };
  }
  const home = pages.find((pathname) => /^\/[^/]+$/u.test(pathname));
  if (home) {
    await s.send("Page.navigate", { url: new URL(home, URL_BASE).href });
    await s.waitFor("document.readyState === 'complete'", "home", 20000);
    report.keyboard = {
      ...report.keyboard,
      detailsToggle: await s.evaluate("(() => { const d = document.querySelector('details.el-phase:not([open]), details#el-stats'); if (!d) return 'none'; d.querySelector('summary').focus(); return d.id || d.className; })()"),
    };
    // cdp.mjs key() sends Enter with keyCode 69 ('E'); a real Enter needs 13.
    for (const type of ["keyDown", "keyUp"]) await s.send("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: type === "keyDown" ? "\r" : undefined });
    await sleep(200);
    report.keyboard.detailsOpenedByEnter = await s.evaluate("document.activeElement?.parentElement?.open === true");
    report.keyboard.inboxLabel = await s.evaluate("document.querySelector('label[for=\"el-inbox-text\"]')?.textContent.trim().slice(0, 40) ?? null");
    report.keyboard.switchInTabOrder = await s.evaluate("[...document.querySelectorAll('.el-lang a')].every((a) => a.tabIndex === 0)");
  }
} finally {
  await closeChrome(browser, cdp);
}
fs.writeFileSync(path.join(OUT, "a11y.json"), JSON.stringify(report, null, 1));
for (const [pathname, entry] of Object.entries(report)) {
  if (pathname === "keyboard") continue;
  for (const scheme of ["light", "dark"]) {
    const a = entry[scheme];
    console.log(`${pathname} ${scheme}: lang=${a.lang} contrast<AA=${a.contrast.length} unnamed=${a.unnamed.length} h1=${a.headings.h1} skips=${a.headings.skips} (${a.headings.order}) main=${a.landmarks.main} nav=${a.landmarks.nav.join(",")}`);
    for (const item of a.contrast.slice(0, 6)) console.log(`  contrast ${item.ratio} ${item.sel} "${item.text}" ${item.color} ${item.size}px`);
    for (const item of a.unnamed.slice(0, 4)) console.log(`  unnamed ${item}`);
  }
  console.log(`  focus: ${entry.focus.stops} stops, ${entry.focus.invisible.length} without a visible change`);
  for (const stop of entry.focus.invisible.slice(0, 6)) console.log(`  no-focus-look ${stop.tag}.${stop.cls} "${stop.text}"`);
}
console.log(`keyboard: ${JSON.stringify(report.keyboard)}`);
