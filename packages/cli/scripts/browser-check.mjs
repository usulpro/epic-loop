// Real-browser check of the review page runtime, with no dependencies: headless Chrome driven over
// the DevTools protocol through Node's global WebSocket. Not part of test:unit (needs Chrome).
// Usage: node packages/cli/scripts/browser-check.mjs [--chrome /usr/bin/google-chrome] [--shots <dir>]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeChrome, connect, createSession, launchChrome, serve, sleep } from "./cdp.mjs";

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
  expect(
    (await evaluate("document.querySelector('.el-doorbell').textContent")) === "Send any message in the agent session to continue.",
    "with no loop waiting, the page says how to continue (doorbell none)",
  );
  const runtimeDir = path.join(project.root, ".epic-loop", "epics", "demo", ".runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, "runtime-state.json"), JSON.stringify({ implementation_loop: { status: "running" } }));
  await evaluate("document.querySelector('.el-submit').click()");
  await waitFor("document.querySelector('.el-doorbell').dataset.doorbell === 'loop-running'", "doorbell loop-running");
  expect(
    (await evaluate("document.querySelector('.el-doorbell').textContent")) === "The loop picks your answers up at its next step.",
    "with the loop running, a resubmit says it is picked up at the next step",
  );

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

const HOME_TRACKER = `# Tracker

Epic: Demo

Next task id: T3

## Active Roadmap

### Phase 1: Build

- Phase status: doing

- [ ] Kind: implementation | Status: todo | T1 · Build the parser
  - Outcome: parses.

- [ ] Kind: verification | Status: todo | T2 · Verify the parser
  - Method: run the fixtures.
  - Acceptance: all pass.
`;

const PROGRESS_FIXTURE = path.resolve(import.meta.dirname, "..", "..", "..", "tests", "fixtures", "activity", "progress-log.jsonl");

// A short Claude Code transcript for the activity feed, ending `secondsAgo` before now.
function transcriptLines(secondsAgo = 5) {
  const at = (offset) => new Date(Date.now() - (secondsAgo + offset) * 1000).toISOString();
  const tool = (offset, name, input) => ({ type: "assistant", timestamp: at(offset), message: { content: [{ type: "tool_use", name, input }] } });
  const result = (offset, text) => ({ type: "user", timestamp: at(offset), message: { content: [{ type: "tool_result", content: text }] } });
  return [
    { type: "user", isMeta: true, timestamp: at(95), message: { content: "Stop hook feedback:\nFocused implementation task 7.\n\nExecute the task brief below." } },
    { type: "assistant", timestamp: at(90), message: { content: [{ type: "thinking", thinking: "hidden" }] } },
    tool(80, "Read", { file_path: "src/parser.mjs" }),
    result(79, "1\texport function parse(input) {"),
    tool(40, "Edit", { file_path: "src/parser.mjs", old_string: "a", new_string: "b" }),
    result(39, "The file src/parser.mjs has been updated successfully."),
    tool(20, "Bash", { command: "node --test tests/parser.test.mjs", description: "Run the parser tests" }),
    result(12, "ok 14 - parses nested lists"),
    { type: "assistant", timestamp: at(0), message: { content: [{ type: "text", text: "The parser handles nested lists now; running the full suite next." }] } },
  ]
    .map((line) => JSON.stringify(line))
    .join("\n");
}

// The live epic home: changes on disk reach the open page through the event stream without a
// reload, open <details> stay open, the open turn's elapsed time ticks, and a new action in the
// driver's transcript shows in the activity feed.
async function checkHome(s, server, project) {
  const { evaluate, waitFor, expect } = s;
  const epicDir = path.join(project.root, ".epic-loop", "epics", "demo");
  const runtimePath = path.join(epicDir, ".runtime", "runtime-state.json");
  fs.writeFileSync(path.join(epicDir, "tracker.md"), HOME_TRACKER);
  fs.writeFileSync(path.join(epicDir, "decision-log.md"), "# Decision Log\n\n## Active Decisions\n\n- None recorded yet.\n");
  fs.mkdirSync(path.join(project.root, ".epic-loop", ".runtime"), { recursive: true });
  fs.writeFileSync(path.join(project.root, ".epic-loop", ".runtime", "platform.json"), JSON.stringify({ platform: "claude-code" }));
  fs.copyFileSync(PROGRESS_FIXTURE, path.join(epicDir, ".runtime", "progress-log.jsonl"));
  const transcript = path.join(project.root, "driver-transcript.jsonl");
  fs.writeFileSync(transcript, `${transcriptLines()}\n`);
  const loop = {
    active_turn_started_at: new Date(Date.now() - 61000).toISOString(),
    current_role: "engineer",
    driver_transcript_path: transcript,
    iteration: 7,
    status: "running",
  };
  fs.writeFileSync(runtimePath, JSON.stringify({ mode: "implementation", implementation_loop: loop }));
  await s.send("Page.navigate", { url: `${server.url}demo` });
  await waitFor("window.epicLoopHome && window.epicLoopHome.live === 'live'", "home live");
  expect(await evaluate('!!document.querySelector(\'[data-task="T1"][data-status="todo"]\')'), "the home lists T1 as todo");
  await evaluate("window.__homeMarker = 'kept'; document.getElementById('task-T2').open = true");
  const elapsedBefore = await evaluate("document.querySelector('time.el-elapsed').textContent");
  await sleep(1500);
  expect((await evaluate("document.querySelector('time.el-elapsed').textContent")) !== elapsedBefore, `the open turn's elapsed time ticks (${elapsedBefore})`);
  expect((await evaluate("document.querySelectorAll('#el-activity .el-feed__item').length")) === 8, "the activity feed lists the transcript's items without the thinking");
  expect(await evaluate("!document.getElementById('el-stats').open"), "turn statistics start closed");
  await evaluate("document.getElementById('el-stats').open = true");
  // The home has no theme switch of its own: force each theme for its screenshot.
  await evaluate("document.documentElement.dataset.theme = 'light'");
  await s.shot("home-light");

  const appended = Date.now();
  const call = { type: "assistant", timestamp: new Date().toISOString(), message: { content: [{ type: "tool_use", name: "Bash", input: { command: "pnpm run test:unit" } }] } };
  fs.appendFileSync(transcript, `${JSON.stringify(call)}\n`);
  await waitFor("document.querySelector('#el-activity .el-feed__item .el-feed__text')?.textContent === 'Bash: pnpm run test:unit'", "activity update", 3000);
  expect(true, `an appended tool call shows in the activity feed in ${Date.now() - appended} ms`);
  expect((await evaluate("window.epicLoopHome.activityRefreshes")) >= 1, "the activity event refreshed only the activity section");

  const started = Date.now();
  fs.writeFileSync(path.join(epicDir, "tracker.md"), HOME_TRACKER.replace("Status: todo | T1", "Status: doing | T1"));
  await waitFor('!!document.querySelector(\'[data-task="T1"][data-status="doing"]\')', "task status update", 3000);
  expect(true, `a task status change reaches the page in ${Date.now() - started} ms`);
  fs.writeFileSync(
    runtimePath,
    JSON.stringify({ mode: "implementation", implementation_loop: { ...loop, gates: [{ blocking: true, covers: [], review: "r1", status: "open" }] } }),
  );
  await waitFor("!!document.querySelector('[data-gate=\"r1\"]')", "gate update", 3000);
  expect(true, "an opened gate reaches the page");
  fs.writeFileSync(
    path.join(epicDir, "decision-log.md"),
    "# Decision Log\n\n## Active Decisions\n\n- **D1 — Parse with a hand-written lexer** (2026-10-20; agent-made, stop class C; unconfirmed).\n  - Default taken: no parser generator\n  - Why: no dependencies\n",
  );
  await waitFor("!!document.querySelector('[data-decision=\"D1\"]')", "decision update", 3000);
  expect(true, "a new agent-made decision reaches the page");
  expect((await evaluate("window.__homeMarker")) === "kept", "no reload: the window marker survives the updates");
  expect(await evaluate("document.getElementById('task-T2').open"), "an open <details> stays open across updates");
  expect(await evaluate("document.getElementById('el-stats').open"), "the opened statistics stay open across updates");
  expect((await evaluate("window.epicLoopHome.refreshes")) >= 3, "each change swapped in a fresh fragment");
  await evaluate("document.documentElement.dataset.theme = 'dark'");
  await s.shot("home-dark");
}

const DOCS_DECISIONS = `# Decision Log

## Active Decisions

- **D1 — Parse with a hand-written lexer** (2026-10-20; agent-made, stop class C; unconfirmed).
  - Default taken: no parser generator
- **D34 — Claude Code doorbell mechanism: an asyncRewake waiter hook** (2026-10-20).
  - Why: it wakes an idle session in 0.2 s; see [the guide](docs/guide.md#the-waiter).
`;

const DOCS_GUIDE = `# Doorbell guide

The loop follows [the decision log](../decision-log.md#d34) and the tracker (\`tracker.md\`).

## The waiter

The waiter hook implements D34 and keeps T1 moving; D1 stays unconfirmed.

| Cell | Result |
|---|---|
| 1A | works |
`;

async function hover(s, selector) {
  const box = await s.evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
}

// The docs browser: a doc page follows relative links, ids open a popover on hover and focus that
// Escape closes, and ids on an agent-written review page expand too.
async function checkDocs(s, server, project) {
  const { evaluate, waitFor, expect } = s;
  const epicDir = path.join(project.root, ".epic-loop", "epics", "demo");
  fs.mkdirSync(path.join(epicDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(epicDir, "decision-log.md"), DOCS_DECISIONS);
  fs.writeFileSync(path.join(epicDir, "docs", "guide.md"), DOCS_GUIDE);
  await s.send("Page.navigate", { url: `${server.url}demo/docs/docs/guide.md` });
  await waitFor("document.readyState === 'complete' && !!window.epicLoopRefs && window.epicLoopHome?.live === 'live'", "doc page ready");
  expect((await evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")) === 3, "the guide's D34, T1 and D1 mentions are links");
  await hover(s, 'a.el-ref[data-ref="D34"]');
  await waitFor("window.epicLoopRefs.open === 'D34' && !document.getElementById('el-refpop').hidden", "popover on hover", 3000);
  const title = await evaluate("document.querySelector('#el-refpop .el-refpop__title').textContent");
  expect(title === "Claude Code doorbell mechanism: an asyncRewake waiter hook", `the hover popover shows the entry title (${title})`);
  expect(
    await evaluate(
      "document.querySelector('a.el-ref[data-ref=\"D34\"]').getAttribute('aria-describedby') === 'el-refpop' && !!document.getElementById('el-refpop').getAttribute('aria-label')",
    ),
    "the popover describes the link and has an accessible name",
  );
  await evaluate("document.documentElement.dataset.theme = 'light'");
  await s.shot("docs-light");
  await evaluate("document.documentElement.dataset.theme = 'dark'");
  await s.shot("docs-dark");
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
  await waitFor("window.epicLoopRefs.open === null", "popover closes on mouse out", 3000);
  await evaluate("document.querySelector('a.el-ref[data-ref=\"D1\"]').focus()");
  await waitFor("window.epicLoopRefs.open === 'D1'", "popover on focus", 3000);
  await s.key("Escape");
  expect(await evaluate("window.epicLoopRefs.open === null && document.getElementById('el-refpop').hidden"), "Escape closes the popover");

  await evaluate("document.querySelector('article.el-doc a[href$=\"decision-log.md#D34\"]').click()");
  await waitFor("location.pathname === '/demo/docs/decision-log.md' && location.hash === '#D34' && document.readyState === 'complete'", "relative link navigation", 5000);
  expect(await evaluate("!!document.getElementById('D34') && document.getElementById('D34').classList.contains('el-anchor')"), "a relative link lands on the definition anchor");
  expect(await evaluate("document.querySelector('article.el-doc a[href=\"/demo/docs/docs/guide.md#the-waiter\"]') !== null"), "links back resolve to the guide's heading anchor");

  await s.send("Page.navigate", { url: `${server.url}demo/reviews/r1/` });
  await waitFor("document.readyState === 'complete' && window.epicLoopRefs?.wrapped > 0", "review page ids wrapped", 5000);
  expect(await evaluate("!!document.querySelector('main .el-page-head a.el-ref[data-ref=\"D34\"]')"), "an id on a review page expands to a link");
  expect(await evaluate("!document.querySelector('el-check a.el-ref, el-option a.el-ref, label a.el-ref')"), "ids inside form controls stay plain");
  await hover(s, 'main a.el-ref[data-ref="D34"]');
  await waitFor("window.epicLoopRefs.open === 'D34'", "review page popover", 3000);
  expect(true, "the review page popover opens");
}

const FAKE_TRANSLATOR = path.resolve(import.meta.dirname, "..", "..", "..", "tests", "fixtures", "translate", "fake-translator.mjs");

// The language switch with the fake translator (never a model): RU on a doc page shows the
// translation once the background job finishes, without a manual reload, and the choice holds on
// the home.
async function checkI18n(s, server, project) {
  const { evaluate, waitFor, expect } = s;
  const epicDir = path.join(project.root, ".epic-loop", "epics", "demo");
  fs.writeFileSync(path.join(epicDir, "state-of-epic.md"), "# State Of Epic\n\nEpic: Demo\nSecond language: ru\n");
  await s.send("Page.navigate", { url: `${server.url}demo/docs/docs/guide.md` });
  await waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live' && !!document.querySelector('.el-lang a[data-lang=\"ru\"]')", "language switch");
  const clicked = Date.now();
  await evaluate("document.querySelector('.el-lang a[data-lang=\"ru\"]').click()");
  await waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live' && document.cookie.includes('el-lang=ru')", "switched page");
  expect(await evaluate("!!document.querySelector('[data-translating]')"), "a cache miss shows the quiet Translating… note");
  const refreshesBefore = await evaluate("window.epicLoopHome.refreshes");
  await waitFor("document.querySelector('article.el-doc h1')?.textContent === '[ru] Doorbell guide'", "translated doc", 8000);
  expect(true, `the translated doc appears without a manual reload in ${Date.now() - clicked} ms`);
  expect((await evaluate("window.epicLoopHome.refreshes")) > refreshesBefore, "the translated fragment was swapped in by the live script");
  expect((await evaluate("document.querySelectorAll('article.el-doc a.el-ref').length")) === 3, "ids still expand in the translation");
  await evaluate("document.documentElement.dataset.theme = 'light'");
  await s.shot("i18n-doc-light");
  await evaluate("document.documentElement.dataset.theme = 'dark'");
  await s.shot("i18n-doc-dark");

  await s.send("Page.navigate", { url: `${server.url}demo` });
  await waitFor("document.readyState === 'complete' && window.epicLoopHome?.live === 'live'", "home after switch");
  expect((await evaluate("document.querySelector('.el-lang a[aria-current=\"true\"]')?.dataset.lang")) === "ru", "the choice persists on the home");
  await waitFor("document.getElementById('el-loop-title')?.textContent === '[ru] Loop'", "translated home labels", 8000);
  expect(true, "the home's labels arrive translated without a reload");
  await evaluate("document.querySelector('.el-lang a[data-lang=\"en\"]').click()");
  await waitFor("document.readyState === 'complete' && document.getElementById('el-loop-title')?.textContent === 'Loop'", "back to English");
  expect(true, "EN switches back");
}

async function main() {
  // The language check translates with the fake translator, never a model.
  process.env.EPIC_LOOP_CLAUDE_BIN = FAKE_TRANSLATOR;
  const project = makeProject();
  const server = serve(project.root, "--detach");
  const browser = await launchChrome(chromeBin);
  const cdp = connect(browser.wsUrl);
  const failures = [];
  try {
    await cdp.ready;
    const s = await createSession(cdp, { failures, shots });
    await checkAnswers(s, server, project);
    await checkVisual(s, server, project);
    await checkHome(s, server, project);
    await checkDocs(s, server, project);
    await checkI18n(s, server, project);
    s.expect(s.consoleErrors.length === 0, `no page errors (${s.consoleErrors.join(" | ") || "none"})`);
  } finally {
    await closeChrome(browser, cdp);
    serve(project.root, "--stop");
    fs.rmSync(project.root, { recursive: true, force: true });
  }
  console.log(failures.length ? `check: ${failures.length} failed` : "check: all passed");
  process.exitCode = failures.length ? 1 : 0;
}

await main();
