// Real-browser check of the review page runtime, with no dependencies: headless Chrome driven over
// the DevTools protocol through Node's global WebSocket. Not part of test:unit (needs Chrome).
// Usage: node packages/cli/scripts/browser-check.mjs [--chrome /usr/bin/google-chrome] [--shots <dir>]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.join(here, "..", "src", "cli.mjs");
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const chromeBin = flag("--chrome", "/usr/bin/google-chrome");
const shots = flag("--shots", null);

const PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Doorbell mechanism</title></head>
  <body>
    <main class="el-main" id="content">
      <div class="el-page-head"><div class="el-label">review</div><h1>Pick the doorbell for Claude Code</h1><p class="el-meta">Phase 2 · D34</p></div>
      <el-card id="q1" title="Which doorbell should Claude Code use?">
        <p>The hook wakes an idle session; the role waiter keeps a role turn open.</p>
        <el-choice name="mechanism" recommended="hook" rule="D16">
          <el-option value="hook" note="Wakes an idle session in 0.2 s">asyncRewake waiter hook</el-option>
          <el-option value="role" note="Holds the role turn open">Background waiter in the role</el-option>
        </el-choice>
        <el-comment name="mechanism-why" optional placeholder="Why?"></el-comment>
      </el-card>
      <el-card id="q2" title="Confirm the agent-made decisions">
        <el-check name="confirm-d31">Confirm D31</el-check>
        <el-select name="lang" label="Second language"><el-option value="ru">Russian</el-option><el-option value="de">German</el-option></el-select>
      </el-card>
      <el-section title="Evidence">
        <el-table><table><thead><tr><th>cell</th><th>result</th></tr></thead><tbody><tr><td>1A</td><td>works</td></tr></tbody></table></el-table>
        <el-links><a href="https://example.invalid/run-10">Run 10 log</a></el-links>
      </el-section>
    </main>
  </body>
</html>
`;

const RU = {
  lang: "ru",
  segments: {
    "Which doorbell should Claude Code use?": "Какой звонок использовать в Claude Code?",
    "asyncRewake waiter hook": "Хук-ожидатель asyncRewake",
    "Wakes an idle session in 0.2 s": "Будит простаивающую сессию за 0,2 с",
    "Why?": "Почему?",
    Evidence: "Доказательства",
  },
};

const VISUAL_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Visual evidence</title>
    <script>window.__frameMessages = []; addEventListener("message", (event) => window.__frameMessages.push(event.data));</script>
  </head>
  <body>
    <main class="el-main" id="content">
      <el-card id="v1" title="Does the new home page look right?">
        <el-shot group="home" caption="Home page at 1280 px"><img src="assets/a.svg" alt="Home at 1280" /></el-shot>
        <el-shot group="home" caption="Home page at 375 px"><img src="assets/b.svg" alt="Home at 375" /></el-shot>
        <el-choice name="looks"><el-option value="yes">Yes</el-option><el-option value="no">No</el-option></el-choice>
      </el-card>
      <el-shot caption="A shot outside any card"><img src="assets/c.svg" alt="Lone" /></el-shot>
      <el-iframe title="Inline demo" height="120"><template><p>inline</p><script>let access; try { access = typeof parent.epicLoop; } catch { access = "blocked"; } parent.postMessage({ frame: "inline", access, origin: String(origin) }, "*");</script></template></el-iframe>
      <el-iframe src="assets/frame.html" title="Asset page" height="120"></el-iframe>
      <el-diagram caption="Doorbell flow">
        graph LR
          A[Submit] --> B[Ring]
          B --> C[Manager ingest]
      </el-diagram>
      <el-compare caption="Before / after" widths="375,1280">
        <el-shot label="before"><img src="assets/a.svg" alt="before" /></el-shot>
        <el-shot label="after"><img src="assets/b.svg" alt="after" /></el-shot>
      </el-compare>
    </main>
  </body>
</html>
`;

const FRAME_PAGE = `<!doctype html><html><body><p>asset frame</p><script>let access; try { access = typeof parent.epicLoop; } catch { access = "blocked"; } parent.postMessage({ frame: "asset", access, origin: String(origin) }, "*");</script></body></html>`;

function svg(label, fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="${fill}"/><text x="240" y="160" font-family="monospace" font-size="40" text-anchor="middle" fill="#333">render ${label}</text></svg>`;
}

function makeProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-browser-")));
  const review = path.join(root, ".epic-loop", "epics", "demo", "reviews", "r1");
  fs.mkdirSync(path.join(review, "i18n"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", "epics", "demo", "state-of-epic.md"), "Epic: Demo\n");
  fs.writeFileSync(path.join(review, "page.html"), PAGE);
  fs.writeFileSync(path.join(review, "review.json"), JSON.stringify({ id: "r1", title: "Doorbell mechanism", languages: ["ru"] }));
  fs.writeFileSync(path.join(review, "i18n", "ru.json"), JSON.stringify(RU));
  const visual = path.join(root, ".epic-loop", "epics", "demo", "reviews", "r2");
  fs.mkdirSync(path.join(visual, "assets"), { recursive: true });
  fs.writeFileSync(path.join(visual, "page.html"), VISUAL_PAGE);
  for (const [name, fill] of [
    ["a", "#d9e8df"],
    ["b", "#f3e3c8"],
    ["c", "#dfe3ea"],
  ])
    fs.writeFileSync(path.join(visual, "assets", `${name}.svg`), svg(name, fill));
  fs.writeFileSync(path.join(visual, "assets", "frame.html"), FRAME_PAGE);
  return { root, review, visual };
}

function serve(root, ...extra) {
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--json", ...extra], {
    encoding: "utf8",
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

async function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-chrome-"));
  const chrome = spawn(
    chromeBin,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1280,1600",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not start")), 20000);
    chrome.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/u);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited ${code}`)));
  });
  return { chrome, profile, wsUrl };
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let next = 0;
  const pending = new Map();
  const handlers = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else for (const handler of handlers) handler(message);
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = ++next;
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on: (handler) => handlers.add(handler),
    close: () => socket.close(),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line) => console.log(`check: ${line}`);

async function createSession(cdp, failures) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const s = { send, consoleErrors: [], requests: [] };
  cdp.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") s.consoleErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      s.consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    if (message.method === "Network.requestWillBeSent") s.requests.push(message.params.request.url);
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false });
  s.expect = (ok, what) => {
    log(`${ok ? "PASS" : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };
  s.evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  s.waitFor = async (expression, what, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await s.evaluate(expression).catch(() => false)) return true;
      await sleep(100);
    }
    throw new Error(`timeout waiting for ${what}`);
  };
  s.open = async (url, choices) => {
    await send("Page.navigate", { url });
    await s.waitFor(
      `document.readyState === 'complete' && !!window.epicLoop && !!document.querySelector('.el-submitbar') && document.querySelectorAll('el-choice fieldset').length === ${choices}`,
      "runtime ready",
    );
    await sleep(300);
  };
  s.key = async (key) => {
    const code = /^[0-9]$/u.test(key) ? `Digit${key}` : key;
    const keyCode = { ArrowRight: 39, ArrowLeft: 37, Escape: 27, " ": 32 }[key] ?? key.toUpperCase().charCodeAt(0);
    for (const type of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode, text: type === "keyDown" && key.length === 1 ? key : undefined });
    await sleep(150);
  };
  s.shot = async (name) => {
    if (!shots) return;
    await sleep(400); // let theme transitions finish
    fs.mkdirSync(shots, { recursive: true });
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(path.join(shots, `${name}.png`), Buffer.from(data, "base64"));
  };
  return s;
}

const answersOf = (dir) => JSON.parse(fs.existsSync(path.join(dir, "answers.json")) ? fs.readFileSync(path.join(dir, "answers.json"), "utf8") : '{"controls":{}}');

async function checkAnswers(s, server, project) {
  const { evaluate, waitFor, expect, shot, send, open } = s;
  const pageUrl = `${server.url}demo/reviews/r1/`;
  const review = project.review;
  const readAnswers = () => answersOf(review);
  await open(pageUrl, 1);
  expect((await evaluate("document.querySelector('.el-progress-text').textContent")) === "0 / 3 answered", "progress starts at 0 / 3 (optional comment not counted)");
  expect(await evaluate("!!document.querySelector('.el-choice--recommended .el-tag--recommended')"), "the recommended option is tagged");
  expect(await evaluate("document.querySelectorAll('.el-toc__list li').length === 2"), "table of contents lists the two cards");

  await evaluate(`(() => {
      document.querySelectorAll('el-choice input[type=radio]')[1].click();
      document.querySelector('el-check input[type=checkbox]').click();
      const select = document.querySelector('el-select select'); select.value = 'de'; select.dispatchEvent(new Event('change', { bubbles: true }));
      const area = document.querySelector('el-comment textarea'); area.value = 'Lower risk.'; area.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  await waitFor("document.querySelector('.el-save').dataset.state === 'saved'", "saved status");
  const saved = readAnswers().controls;
  expect(
    saved.mechanism === "role" && saved["confirm-d31"] === true && saved.lang === "de" && saved["mechanism-why"] === "Lower risk.",
    `answers.json holds every control: ${JSON.stringify(saved)}`,
  );
  expect((await evaluate("document.querySelector('.el-progress-text').textContent")) === "3 / 3 answered", "progress reaches 3 / 3");
  await shot("runtime-light-en");
  await evaluate("document.querySelector('[data-theme-set=dark]').click()");
  expect((await evaluate("document.documentElement.dataset.theme")) === "dark", "theme switch sets data-theme=dark");
  await shot("runtime-dark-en");

  await send("Page.reload");
  await waitFor("document.readyState === 'complete' && !!window.epicLoop && document.querySelectorAll('el-choice fieldset').length === 1", "reload");
  await waitFor("document.querySelector('.el-progress-text').textContent === '3 / 3 answered'", "restored progress");
  const restored = await evaluate(`({
      mechanism: [...document.querySelectorAll('el-choice input')].find((i) => i.checked)?.value,
      check: document.querySelector('el-check input').checked,
      lang: document.querySelector('el-select select').value,
      comment: document.querySelector('el-comment textarea').value,
      theme: document.documentElement.dataset.theme,
    })`);
  expect(
    restored.mechanism === "role" && restored.check === true && restored.lang === "de" && restored.comment === "Lower risk.",
    `values restored after reload: ${JSON.stringify(restored)}`,
  );
  expect(restored.theme === "dark", "theme remembered after reload");

  const englishBefore = await evaluate("document.getElementById('content').innerHTML");
  await evaluate("document.querySelector('[data-lang=ru]').click()");
  await waitFor("document.documentElement.lang === 'ru'", "Russian applied");
  const ru = await evaluate(
    "({ title: document.querySelector('#q1 h3').textContent, option: document.querySelector('.el-choice__title').firstChild.nodeValue, placeholder: document.querySelector('el-comment textarea').placeholder, section: document.querySelector('el-section h2').textContent })",
  );
  expect(
    ru.title === RU.segments["Which doorbell should Claude Code use?"] && ru.placeholder === "Почему?" && ru.section === "Доказательства",
    `Russian segments applied: ${JSON.stringify(ru)}`,
  );
  await shot("runtime-dark-ru");
  await evaluate("document.querySelector('[data-theme-set=light]').click()");
  await shot("runtime-light-ru");
  await evaluate("document.querySelector('[data-lang=en]').click()");
  await waitFor("document.documentElement.lang === 'en'", "English restored");
  expect((await evaluate("document.getElementById('content').innerHTML")) === englishBefore, "switching back restores the English page exactly");

  const shotsBefore = readAnswers().submittedAt;
  expect(!shotsBefore, "not submitted before Submit");
  await evaluate("document.querySelector('.el-submit').click()");
  await waitFor("!document.querySelector('.el-submitted').hidden", "submitted state");
  const submitted = readAnswers();
  expect(Boolean(submitted.submittedAt), `answers.json has submittedAt ${submitted.submittedAt}`);
  expect((await evaluate("document.querySelector('.el-submit').textContent")) === "Submit again", "button offers Submit again");

  await evaluate("document.querySelector('#el-problem textarea').value = 'browser check problem'; document.querySelector('#el-problem form').submit()");
  await waitFor("document.body.textContent.includes('the problem is recorded')", "problem confirmation");
  const problems = fs.readFileSync(path.join(review, "problems.jsonl"), "utf8");
  expect(problems.includes("browser check problem"), "the injected problem form still works on the page");
}

async function checkLightbox(s) {
  const { evaluate, waitFor, expect, key } = s;
  await evaluate("document.querySelector('[data-theme-set=light]').click()");
  await evaluate("document.querySelector('#v1 el-shot .el-shot__open').focus(); document.querySelector('#v1 el-shot .el-shot__open').click()");
  await waitFor("!document.querySelector('.el-lightbox').hidden", "lightbox open");
  expect((await evaluate("document.querySelector('.el-lightbox__counter').textContent")) === "1 / 2", "the lightbox counts the shot group: 1 / 2");
  expect(
    await evaluate("!!document.querySelector('.el-lightbox__controls el-choice') && !document.querySelector('#v1 el-choice')"),
    "the card's choice is moved into the side panel",
  );
  await key("ArrowRight");
  expect((await evaluate("document.querySelector('.el-lightbox__counter').textContent")) === "2 / 2", "ArrowRight pages to 2 / 2");
  await key("1");
  await waitFor("document.querySelector('.el-save').dataset.state === 'saved'", "panel answer saved");
  await s.shot("lightbox-open");
  await key("Escape");
  expect(await evaluate("document.querySelector('.el-lightbox').hidden"), "Esc closes the lightbox");
  expect(
    await evaluate("!!document.querySelector('#v1 el-choice') && !document.querySelector('.el-lightbox__controls el-choice')"),
    "the choice is back in its card after closing",
  );
  expect(await evaluate("document.activeElement === document.querySelector('#v1 el-shot .el-shot__open')"), "focus returns to the shot");
}

async function checkVisual(s, server, project) {
  const { evaluate, waitFor, expect } = s;
  await s.open(`${server.url}demo/reviews/r2/`, 1);
  const progressBefore = await evaluate("document.querySelector('.el-progress-text').textContent");
  await checkLightbox(s);
  expect(answersOf(project.visual).controls.looks === "yes", "a digit in the panel picked and saved the option (answers.json looks = yes)");
  expect(
    (await evaluate("document.querySelector('.el-progress-text').textContent")) === "1 / 1 answered" && progressBefore === "0 / 1 answered",
    `progress counts only the choice (${progressBefore} -> 1 / 1)`,
  );

  await waitFor("window.__frameMessages.length >= 2", "both frames reported");
  const frames = await evaluate("({ messages: window.__frameMessages, sandboxes: [...document.querySelectorAll('.el-iframe__frame')].map((f) => f.getAttribute('sandbox')) })");
  expect(
    frames.messages.every((m) => m.access === "blocked" && m.origin === "null"),
    `frames cannot reach the page: ${JSON.stringify(frames.messages)}`,
  );
  expect(
    frames.sandboxes.every((value) => value === "allow-scripts"),
    `inline and same-origin frames get sandbox=allow-scripts: ${JSON.stringify(frames.sandboxes)}`,
  );

  await waitFor("document.querySelector('el-diagram').dataset.rendered === 'light' && !!document.querySelector('el-diagram svg')", "diagram rendered", 20000);
  expect(true, "the diagram renders an svg with bundled Mermaid");
  await s.shot("diagram-light");
  await evaluate("document.querySelector('[data-theme-set=dark]').click()");
  await waitFor("document.querySelector('el-diagram').dataset.rendered === 'dark'", "diagram re-rendered dark", 20000);
  expect((await evaluate("document.querySelector('el-diagram').dataset.renders")) === "2", "a theme switch re-renders the diagram");
  await s.shot("diagram-dark");
  await evaluate("document.querySelector('[data-theme-set=light]').click()");

  const compare = "document.querySelector('el-compare .el-compare')";
  await evaluate(`document.querySelector('el-compare').scrollIntoView()`);
  await s.shot("compare-side");
  await evaluate(
    `${compare}.querySelector('[data-value=overlay]').click(); const r = ${compare}.querySelector('.el-compare__opacity'); r.value = '20'; r.dispatchEvent(new Event('input'))`,
  );
  expect(
    await evaluate(`${compare}.classList.contains('el-compare--overlay') && ${compare}.style.getPropertyValue('--overlay-opacity') === '0.2'`),
    "overlay mode with the opacity slider",
  );
  await s.shot("compare-overlay");
  await evaluate(`${compare}.querySelector('[data-value=flip]').click()`);
  const front = `[...${compare}.querySelectorAll('.el-compare__pane')].findIndex((p) => p.classList.contains('is-front'))`;
  const before = await evaluate(front);
  await evaluate(`${compare}.focus()`);
  await s.key(" ");
  expect(before === 0 && (await evaluate(front)) === 1, "flip mode shows one pane and space flips to the next");
  await s.shot("compare-flip");
  await evaluate(`${compare}.querySelector('[data-value="375"]').click()`);
  expect((await evaluate(`${compare}.querySelector('.el-compare__panes').style.maxWidth`)) === "375px", "a width preset constrains the panes");

  const origin = server.url.replace(/\/$/u, "");
  const external = s.requests.filter((url) => !url.startsWith(origin) && !/^(data|about|blob):/u.test(url));
  expect(external.length === 0, `no request leaves 127.0.0.1 (${s.requests.length} requests${external.length ? `; external: ${external.join(", ")}` : ""})`);
  expect(
    s.requests.some((url) => url.endsWith("/_runtime/vendor/mermaid.min.js")),
    "Mermaid loads from /_runtime/vendor/",
  );
}

async function main() {
  const project = makeProject();
  const server = serve(project.root, "--detach");
  const { chrome, profile, wsUrl } = await launchChrome();
  const cdp = connect(wsUrl);
  const failures = [];
  try {
    await cdp.ready;
    const s = await createSession(cdp, failures);
    await checkAnswers(s, server, project);
    await checkVisual(s, server, project);
    s.expect(s.consoleErrors.length === 0, `no page errors (${s.consoleErrors.join(" | ") || "none"})`);
  } finally {
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
    await sleep(300);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
    serve(project.root, "--stop");
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(project.root, { recursive: true, force: true });
  }
  console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
  process.exitCode = failures.length ? 1 : 0;
}

await main();
