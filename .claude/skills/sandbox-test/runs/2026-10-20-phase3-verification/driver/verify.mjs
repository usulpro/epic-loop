// Verifies the review pages a manager session built, outside the agent session: runs the strict check
// for each page, starts `epic-loop serve --detach`, and answers every page in headless Chrome from the
// schema in review.json (en and ru screenshots, lightbox, compare modes, submit, problem report,
// reload). Asserts answers.json and problems.jsonl on disk, then stops the server.
// Usage: node verify.mjs <sandbox> <out dir>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cliEntry, closeChrome, connect, createSession, launchChrome, serve, sleep } from "../../../../../../packages/cli/scripts/cdp.mjs";

const [sandbox, out] = process.argv.slice(2);
const SLUG = "demo";
const IDS = ["2026-10-20-stop-report", "2026-10-20-pricing-layout", "2026-10-20-footer-result"];
const reviewsDir = path.join(sandbox, ".epic-loop", "epics", SLUG, "reviews");
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
const PROBLEM = (id) => `verify: the problem report for ${id}`;

function check(id) {
  const result = spawnSync(process.execPath, [cliEntry, "review", "check", `${SLUG}/${id}`, "--lang", "ru", "--json", "--root", sandbox], {
    encoding: "utf8",
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
  });
  return { status: result.status, json: result.stdout.trim() ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}

// The value each control gets: the first non-recommended option, a checked check, the first select
// option, and a text for comments.
function plan(control) {
  if (control.kind === "choice") return (control.options.find((option) => option.value !== control.recommended) ?? control.options[0]).value;
  if (control.kind === "check") return true;
  if (control.kind === "select") return control.options[0].value;
  return `Verification comment for ${control.name}.`;
}

const sel = (control) => `document.querySelector('el-${control.kind}[name="${control.name}"]')`;

function answerScript(control, value) {
  const host = sel(control);
  if (control.kind === "choice") return `${host}.querySelector('input[value="${value}"]').click()`;
  if (control.kind === "check") return `(() => { const i = ${host}.querySelector('input[type=checkbox]'); if (!i.checked) i.click(); })()`;
  if (control.kind === "select") return `(() => { const s = ${host}.querySelector('select'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`;
  return `(() => { const a = ${host}.querySelector('textarea'); a.value = ${JSON.stringify(value)}; a.dispatchEvent(new Event('input', { bubbles: true })); })()`;
}

function readScript(control) {
  const host = sel(control);
  if (control.kind === "choice") return `[...${host}.querySelectorAll('input')].find((i) => i.checked)?.value ?? null`;
  if (control.kind === "check") return `${host}.querySelector('input[type=checkbox]').checked`;
  if (control.kind === "select") return `${host}.querySelector('select').value`;
  return `${host}.querySelector('textarea').value`;
}

const ready = (choices) =>
  `document.readyState === 'complete' && !!window.epicLoop && !!document.querySelector('.el-submitbar') && document.querySelectorAll('el-choice fieldset').length === ${choices}`;

// Full-page screenshots through a viewport as tall as the page: captureBeyondViewport leaves the fixed
// submit bar mid-page and does not paint out-of-process (sandboxed) iframes below the fold.
function fullShots(s, dir) {
  s.shot = async (name) => {
    await sleep(400);
    const height = await s.evaluate("Math.max(document.documentElement.scrollHeight, 900)");
    await s.send("Emulation.setDeviceMetricsOverride", { width: 1280, height, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const { data } = await s.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(data, "base64"));
    await s.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  };
}

async function lightbox(s, row) {
  const opener = "[...document.querySelectorAll('el-shot .el-shot__open')].find((b) => !b.closest('el-compare'))";
  if (!(await s.evaluate(`!!${opener}`))) return;
  await s.evaluate(`${opener}.click()`);
  await s.waitFor("!document.querySelector('.el-lightbox').hidden", "lightbox open");
  row.lightbox = await s.evaluate("document.querySelector('.el-lightbox__counter').textContent");
  const { data } = await s.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(out, row.id, "lightbox.png"), Buffer.from(data, "base64"));
  await s.key("Escape");
  s.expect(await s.evaluate("document.querySelector('.el-lightbox').hidden"), `${row.id}: lightbox opened (${row.lightbox}) and closed`);
}

async function compare(s, row) {
  const host = "document.querySelector('el-compare .el-compare')";
  if (!(await s.evaluate(`!!${host}`))) return;
  await s.evaluate("document.querySelector('el-compare').scrollIntoView()");
  const modes = [];
  for (const mode of ["overlay", "flip", "side"]) {
    if (!(await s.evaluate(`!!${host}.querySelector('[data-value=${mode}]')`))) continue;
    await s.evaluate(`${host}.querySelector('[data-value=${mode}]').click()`);
    if (mode !== "side") await s.shot(`compare-${mode}`);
    modes.push(`${mode}:${await s.evaluate(`${host}.classList.contains('el-compare--${mode}') || '${mode}' === 'side'`)}`);
  }
  const widths = await s.evaluate(`[...${host}.querySelectorAll('[data-value]')].map((b) => b.dataset.value).filter((v) => /^[0-9]+$/.test(v))`);
  for (const width of widths) {
    await s.evaluate(`${host}.querySelector('[data-value="${width}"]').click()`);
    modes.push(`${width}:${await s.evaluate(`${host}.querySelector('.el-compare__panes').style.maxWidth`)}`);
  }
  row.compare = modes.join(" ");
  s.expect(widths.length > 0 && !modes.some((m) => m.endsWith(":false")), `${row.id}: compare modes and width presets (${row.compare})`);
}

async function verifyPage(s, server, id) {
  const dir = path.join(reviewsDir, id);
  const row = { id };
  for (const file of ["answers.json", "problems.jsonl"]) fs.rmSync(path.join(dir, file), { force: true });
  const checked = check(id);
  fs.writeFileSync(path.join(out, id, "check-ru.json"), `${JSON.stringify(checked.json, null, 2)}\n`);
  const tr = checked.json?.translations?.ru;
  row.check = checked.json?.ok ? `ok, ${checked.json.segments} segments, ${tr?.missing?.length ?? "?"} missing, ${tr?.stale?.length ?? "?"} stale, ${checked.json.warnings.length} warnings` : "FAILED";
  s.expect(checked.json?.ok === true, `${id}: review check --lang ru (${row.check})`);
  if (!checked.json?.ok) return row;
  const controls = readJson(path.join(dir, "review.json"), {}).schema.controls;
  const url = `${server.url}${SLUG}/reviews/${id}/`;
  const choices = controls.filter((c) => c.kind === "choice").length;
  await s.send("Page.navigate", { url });
  await s.waitFor(ready(choices), "runtime ready");
  await sleep(300);
  await s.evaluate("document.querySelector('[data-theme-set=light]').click()");
  row.iframes = await s.evaluate("[...document.querySelectorAll('.el-iframe__frame')].map((f) => `${f.getAttribute('src') ?? 'srcdoc'} sandbox=${f.getAttribute('sandbox')}`).join(', ')");
  await lightbox(s, row);
  await compare(s, row);

  const expected = Object.fromEntries(controls.map((c) => [c.name, plan(c)]));
  for (const control of controls) await s.evaluate(answerScript(control, expected[control.name]));
  await s.waitFor("document.querySelector('.el-save').dataset.state === 'saved'", "saved");
  await sleep(500);
  row.progress = await s.evaluate("document.querySelector('.el-progress-text').textContent");
  await s.evaluate("scrollTo(0, 0)");
  await s.shot("en");
  const h1 = await s.evaluate("document.querySelector('h1')?.textContent");
  await s.evaluate("document.querySelector('[data-lang=ru]').click()");
  await s.waitFor("document.documentElement.lang === 'ru'", "Russian");
  await sleep(300);
  row.h1 = { en: h1, ru: await s.evaluate("document.querySelector('h1')?.textContent") };
  row.englishLeft = await s.evaluate(
    "[...document.querySelectorAll('#content, main')].slice(0, 1).flatMap((root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const found = []; while (w.nextNode()) { const t = w.currentNode.nodeValue.trim(); if (t.length > 12 && /[A-Za-z]{4}/.test(t) && !/[А-Яа-я]/.test(t) && !w.currentNode.parentElement.closest('.el-submitbar, code, pre, .el-meta, .el-id, .el-kbd, .el-field__hint, .el-tag')) found.push(t); } return found; }).slice(0, 8)",
  );
  s.expect(/[А-Яа-я]/u.test(row.h1.ru ?? "") && row.h1.ru !== h1, `${id}: Russian applied (h1 "${row.h1.ru}")`);
  await s.shot("ru");
  await s.evaluate("document.querySelector('[data-lang=en]').click()");
  await s.waitFor("document.documentElement.lang === 'en'", "English");

  await s.evaluate("document.querySelector('.el-submit').click()");
  await s.waitFor("!document.querySelector('.el-submitted').hidden", "submitted");
  const answers = readJson(path.join(dir, "answers.json"), { controls: {} });
  const wrong = controls.filter((c) => answers.controls[c.name] !== expected[c.name]).map((c) => c.name);
  row.controls = `${controls.length - wrong.length}/${controls.length}`;
  row.submittedAt = answers.submittedAt ?? null;
  s.expect(wrong.length === 0, `${id}: answers.json holds every control (${row.controls}${wrong.length ? `; wrong: ${wrong.join(", ")}` : ""})`);
  s.expect(Boolean(row.submittedAt), `${id}: answers.json has submittedAt ${row.submittedAt}`);
  fs.copyFileSync(path.join(dir, "answers.json"), path.join(out, id, "answers.json"));

  await s.evaluate("document.querySelector('#el-problem summary').click()");
  await s.evaluate(`document.querySelector('#el-problem textarea').value = ${JSON.stringify(PROBLEM(id))}`);
  await s.evaluate("document.querySelector('#el-problem button[type=submit]').click()");
  await s.waitFor("document.body.textContent.includes('the problem is recorded')", "problem confirmation");
  const lines = fs.existsSync(path.join(dir, "problems.jsonl")) ? fs.readFileSync(path.join(dir, "problems.jsonl"), "utf8").trim().split("\n") : [];
  const problem = lines.map((line) => JSON.parse(line)).find((entry) => entry.text === PROBLEM(id));
  row.problem = Boolean(problem);
  s.expect(row.problem, `${id}: problems.jsonl has the report`);
  fs.writeFileSync(path.join(out, id, "problem.jsonl"), `${lines.join("\n")}\n`);

  await s.send("Page.navigate", { url });
  await s.waitFor(ready(choices), "reload");
  await s.waitFor("!document.querySelector('.el-submitted').hidden", "submitted state after reload");
  const restored = {};
  for (const control of controls) restored[control.name] = await s.evaluate(readScript(control));
  const lost = controls.filter((c) => restored[c.name] !== expected[c.name]).map((c) => c.name);
  const submitLabel = await s.evaluate("document.querySelector('.el-submit').textContent");
  row.reload = lost.length === 0 && submitLabel === "Submit again" ? "restored, submitted" : `lost: ${lost.join(", ")}; button ${submitLabel}`;
  s.expect(row.reload === "restored, submitted", `${id}: after reload (${row.reload})`);
  row.shots = fs.readdirSync(path.join(out, id)).filter((f) => f.endsWith(".png")).join(" ");
  return row;
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = serve(sandbox, "--detach");
  const browser = await launchChrome();
  const cdp = connect(browser.wsUrl);
  const failures = [];
  const rows = [];
  try {
    await cdp.ready;
    for (const id of IDS) {
      fs.mkdirSync(path.join(out, id), { recursive: true });
      const s = await createSession(cdp, { failures });
      fullShots(s, path.join(out, id));
      try {
        rows.push(await verifyPage(s, server, id));
      } catch (error) {
        s.expect(false, `${id}: ${error.message}`);
        rows.push({ id, error: error.message });
      }
      const origin = server.url.replace(/\/$/u, "");
      const external = s.requests.filter((url) => !url.startsWith(origin) && !/^(data|about|blob):/u.test(url));
      s.expect(external.length === 0, `${id}: no request leaves 127.0.0.1 (${s.requests.length} requests)`);
      s.expect(s.consoleErrors.length === 0, `${id}: no page errors (${s.consoleErrors.join(" | ") || "none"})`);
    }
  } finally {
    await closeChrome(browser, cdp);
    serve(sandbox, "--stop");
  }
  fs.writeFileSync(path.join(out, "summary.json"), `${JSON.stringify({ failures, rows }, null, 2)}\n`);
  console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
  process.exitCode = failures.length ? 1 : 0;
}

await main();
