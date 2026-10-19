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

function makeProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "epic-loop-browser-")));
  const review = path.join(root, ".epic-loop", "epics", "demo", "reviews", "r1");
  fs.mkdirSync(path.join(review, "i18n"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", "epics", "demo", "state-of-epic.md"), "Epic: Demo\n");
  fs.writeFileSync(path.join(review, "page.html"), PAGE);
  fs.writeFileSync(path.join(review, "review.json"), JSON.stringify({ id: "r1", title: "Doorbell mechanism", languages: ["ru"] }));
  fs.writeFileSync(path.join(review, "i18n", "ru.json"), JSON.stringify(RU));
  return { root, review };
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

async function main() {
  const { root, review } = makeProject();
  const server = serve(root, "--detach");
  const { chrome, profile, wsUrl } = await launchChrome();
  const cdp = connect(wsUrl);
  const failures = [];
  const expect = (ok, what) => {
    log(`${ok ? "PASS" : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };
  try {
    await cdp.ready;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    const consoleErrors = [];
    cdp.on((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === "Runtime.exceptionThrown") consoleErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
        consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    const waitFor = async (expression, what, timeout = 10000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate(expression).catch(() => false)) return true;
        await sleep(100);
      }
      throw new Error(`timeout waiting for ${what}`);
    };
    const open = async (url) => {
      await send("Page.navigate", { url });
      await waitFor(
        "document.readyState === 'complete' && !!window.epicLoop && !!document.querySelector('.el-submitbar') && document.querySelectorAll('el-choice fieldset').length === 1",
        "runtime ready",
      );
      await sleep(300);
    };
    const shot = async (name) => {
      if (!shots) return;
      await sleep(400); // let theme transitions finish
      fs.mkdirSync(shots, { recursive: true });
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      fs.writeFileSync(path.join(shots, `${name}.png`), Buffer.from(data, "base64"));
    };
    const pageUrl = `${server.url}demo/reviews/r1/`;
    const readAnswers = () => JSON.parse(fs.existsSync(path.join(review, "answers.json")) ? fs.readFileSync(path.join(review, "answers.json"), "utf8") : '{"controls":{}}');

    await open(pageUrl);
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
    expect(consoleErrors.length === 0, `no page errors (${consoleErrors.join(" | ") || "none"})`);
  } finally {
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
    await sleep(300);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
    serve(root, "--stop");
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
  process.exitCode = failures.length ? 1 : 0;
}

await main();
