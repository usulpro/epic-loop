import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseHtml, textContent, walk } from "../../packages/cli/src/review/html.mjs";
import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const cliEntry = path.join(repoRoot, "packages", "cli", "src", "cli.mjs");

const VALID = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Pick a mechanism</title><link rel="stylesheet" href="/_runtime/tokens.css"></head>
<body>
<main>
  <h1>Pick the doorbell for Claude Code</h1>
  <el-card id="q1" title="Which doorbell should Claude Code use?">
    <p>The hook wakes an idle session.</p>
    <el-shot caption="Home at 1280 px" group="home"><img src="assets/a.svg" alt="Home at 1280 px"></el-shot>
    <el-choice name="mechanism" recommended="hook" rule="D16" label="Mechanism">
      <el-option value="hook" note="Wakes an idle session in 0.2 s">asyncRewake waiter hook</el-option>
      <el-option value="role" note="Holds the role turn open">Background waiter in the role</el-option>
    </el-choice>
    <el-comment name="why" optional placeholder="Why?"></el-comment>
  </el-card>
  <el-card id="q2" title="Confirm the decisions">
    <el-check name="confirm-d31">Confirm D31</el-check>
    <el-select name="lang" label="Second language"><el-option value="ru">Russian</el-option><el-option value="de">German</el-option></el-select>
  </el-card>
  <el-section title="Evidence">
    <el-table><table><tr><th>cell</th><td>1A</td></tr></table></el-table>
    <el-links><a href="assets/notes.md">Run notes</a> <a href="https://example.com/docs">External docs</a> <a href="#q1">Back to Q1</a></el-links>
    <el-compare caption="Before / after" widths="375,1280">
      <el-shot label="before"><img src="assets/a.svg" alt="before"></el-shot>
      <el-shot label="after"><img src="assets/b.svg" alt="after"></el-shot>
    </el-compare>
    <el-iframe src="https://example.com/" title="Live site"><a href="https://example.com/">Open</a></el-iframe>
    <el-iframe title="Inline demo"><template><p>Inline frame text</p><script>document.body.dataset.ready = "1";</script></template></el-iframe>
    <el-diagram caption="Flow">graph LR
      A[Submit] --&gt; B[Ring]</el-diagram>
    <pre>code is not translated</pre>
    <p data-i18n-skip>skipped text</p>
  </el-section>
</main>
</body>
</html>
`;

function makeReview(page, files = {}) {
  const root = makeTempRoot("check");
  const dir = path.join(root, ".epic-loop", "epics", "demo", "reviews", "r1");
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, ".epic-loop", "epics", "demo", "state-of-epic.md"), "Epic: Demo\n");
  fs.writeFileSync(path.join(dir, "page.html"), page);
  for (const name of ["a.svg", "b.svg", "notes.md"]) fs.writeFileSync(path.join(dir, "assets", name), "x");
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), typeof content === "string" ? content : JSON.stringify(content));
  }
  return { root, dir };
}

function check(target, ...args) {
  const result = spawnSync(process.execPath, [cliEntry, "review", "check", target, "--json", ...args], {
    encoding: "utf8",
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
  });
  return { status: result.status, report: JSON.parse(result.stdout || "{}"), stderr: result.stderr };
}

const page = (body, head = "") => `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;
const PAIR = '<el-choice name="x"><el-option value="a">A</el-option><el-option value="b">B</el-option></el-choice>';

test("a valid page with every element passes and writes the schema and the segments", () => {
  const { root, dir } = makeReview(VALID, { "review.json": { id: "r1", title: "Pick", kind: "decision", languages: [] } });
  const { status, report } = check("demo/r1", "--root", root);
  assert.equal(status, 0, JSON.stringify(report.errors));
  assert.deepEqual(report.errors, []);
  const review = JSON.parse(fs.readFileSync(path.join(dir, "review.json"), "utf8"));
  assert.equal(review.kind, "decision", "existing fields are kept");
  assert.ok(review.checkedAt);
  assert.deepEqual(review.schema.controls, [
    {
      name: "mechanism",
      kind: "choice",
      optional: false,
      label: "Mechanism",
      options: [
        { value: "hook", label: "asyncRewake waiter hook" },
        { value: "role", label: "Background waiter in the role" },
      ],
      recommended: "hook",
      rule: "D16",
      card: "q1",
    },
    { name: "why", kind: "comment", optional: true, card: "q1" },
    { name: "confirm-d31", kind: "check", optional: false, label: "Confirm D31", card: "q2" },
    {
      name: "lang",
      kind: "select",
      optional: false,
      label: "Second language",
      options: [
        { value: "ru", label: "Russian" },
        { value: "de", label: "German" },
      ],
      card: "q2",
    },
  ]);
  const { segments } = JSON.parse(fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8"));
  for (const expected of [
    "Pick the doorbell for Claude Code",
    "Which doorbell should Claude Code use?",
    "Mechanism",
    "D16",
    "Wakes an idle session in 0.2 s",
    "asyncRewake waiter hook",
    "Why?",
    "Home at 1280 px",
    "Before / after",
    "before",
    "Live site",
    "Flow",
    "Evidence",
  ]) {
    assert.ok(segments.includes(expected), `segment "${expected}"`);
  }
  for (const excluded of ["Pick a mechanism", "Inline frame text", "code is not translated", "skipped text", "graph LR A[Submit] --> B[Ring]"]) {
    assert.ok(!segments.includes(excluded), `no segment "${excluded}"`);
  }
  assert.ok(report.warnings.every((warning) => warning.code !== "W_NO_CONTROLS"));
});

test("a second run writes byte-identical segments and schema", () => {
  const { root, dir } = makeReview(VALID);
  check("demo/r1", "--root", root);
  const first = [fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8"), JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, "review.json"), "utf8")).schema)];
  check(dir);
  const second = [fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8"), JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, "review.json"), "utf8")).schema)];
  assert.deepEqual(second, first);
});

const FAILURES = [
  ["E_NAME_DUPLICATE", page(`${PAIR}${PAIR}`), /used twice/u],
  ["E_NAME_MISSING", page('<el-comment name=""></el-comment>'), /no name/u],
  ["E_OPTIONS_TOO_FEW", page('<el-choice name="x"><el-option value="a">A</el-option></el-choice>'), /at least two/u],
  ["E_RECOMMENDED_UNKNOWN", page(PAIR.replace('name="x"', 'name="x" recommended="c"')), /recommends "c"/u],
  ["E_FILE_MISSING", page('<img src="assets/missing.png" alt="m">'), /does not exist/u],
  ["E_FILE_OUTSIDE", page('<img src="../../secret.png" alt="s">'), /outside the review folder/u],
  ["E_NETWORK_SCRIPT", page('<script src="https://cdn.example/app.js"></script>'), /from the network/u],
  ["E_NETWORK_SCRIPT", page('<el-iframe title="t"><template><script src="https://cdn.example/x.js"></script></template></el-iframe>'), /from the network/u],
  ["E_NETWORK_STYLESHEET", page("", '<link rel="stylesheet" href="https://fonts.example/a.css">'), /stylesheets must be local/u],
  ["E_CSS_IMPORT", page("<style>@import 'x.css';</style>"), /@import/u],
  ["E_NETWORK_CSS", page('<div style="background: url(https://img.example/bg.png)">x</div>'), /url\(\) from the network/u],
  ["E_NETWORK_MEDIA", page('<img src="https://img.example/shot.png" alt="s">'), /saved next to the page/u],
  ["E_IFRAME", page('<iframe src="https://example.com"></iframe>'), /use <el-iframe>/u],
  ["E_FORM_ACTION", page('<form action="https://evil.example/collect"><input name="q"></form>'), /posts elsewhere/u],
  ["E_BASE", page("", '<base href="https://example.com/">'), /<base> is not allowed/u],
  ["E_META_REFRESH", page("", '<meta http-equiv="refresh" content="0; url=https://example.com">'), /refresh/u],
  ["E_COMPARE_TOO_FEW", page('<el-compare><el-shot label="a"><img src="assets/a.svg" alt="a"></el-shot></el-compare>'), /at least two/u],
  ["E_COMPARE_LABEL", page('<el-compare><el-shot label="a"><img src="assets/a.svg" alt="a"></el-shot><img src="assets/b.svg" alt="b"></el-compare>'), /needs a label/u],
  ["E_SHOT_NO_IMAGE", page('<el-shot caption="nothing"></el-shot>'), /needs an <img>/u],
  ["E_PARSE", page('<div class="unterminated'), /cannot be parsed/u],
];

for (const [code, html, message] of FAILURES) {
  test(`check fails with ${code}`, () => {
    const { dir } = makeReview(html);
    const { status, report } = check(dir);
    assert.equal(status, 1);
    const found = report.errors.find((error) => error.code === code);
    assert.ok(found, `${code} in ${JSON.stringify(report.errors)}`);
    assert.match(found.message, message);
  });
}

test("a failing page keeps the previous review.json and source.json", () => {
  const { dir } = makeReview(VALID);
  check(dir);
  const before = fs.readFileSync(path.join(dir, "review.json"), "utf8");
  const sourceBefore = fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8");
  fs.writeFileSync(path.join(dir, "page.html"), page(`${PAIR}${PAIR}`));
  assert.equal(check(dir).status, 1);
  assert.equal(fs.readFileSync(path.join(dir, "review.json"), "utf8"), before);
  assert.equal(fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8"), sourceBefore);
});

test("translation gaps: missing and stale keys are reported, and --lang makes missing an error", () => {
  const html = page('<h1>Pick one</h1><el-card id="c" title="Which doorbell?">' + PAIR + "</el-card>");
  const { dir } = makeReview(html, {
    "review.json": { languages: ["ru"] },
    "i18n/ru.json": { lang: "ru", segments: { "Pick one": "Выберите", "Which doorbell?": "Какой звонок?", A: "А", "Old text": "Старый" } },
  });
  const lenient = check(dir);
  assert.equal(lenient.status, 0);
  assert.deepEqual(lenient.report.translations.ru, { missing: ["B"], stale: ["Old text"] });
  assert.ok(lenient.report.warnings.some((warning) => warning.code === "W_TRANSLATION_MISSING"));
  assert.ok(lenient.report.warnings.some((warning) => warning.code === "W_TRANSLATION_STALE"));
  const strict = check(dir, "--lang", "ru");
  assert.equal(strict.status, 1);
  assert.ok(strict.report.errors.some((error) => error.code === "E_TRANSLATION_MISSING"));
});

test("warnings: inline handlers, missing alt, two choices in one card, and an answer-less page", () => {
  const { dir } = makeReview(page(`<el-card id="c" title="Two">${PAIR}${PAIR.replace('"x"', '"y"')}</el-card><img src="assets/a.svg"><button onclick="go()">Go</button>`));
  const codes = check(dir).report.warnings.map((warning) => warning.code);
  for (const code of ["W_EVENT_HANDLER", "W_IMG_ALT", "W_CARD_CHOICES"]) assert.ok(codes.includes(code), code);
  const empty = makeReview(page("<p>Read this and acknowledge.</p>"));
  assert.ok(check(empty.dir).report.warnings.some((warning) => warning.code === "W_NO_CONTROLS"));
});

// The slice A browser-check fixture and its Russian translation (copied, not imported).
const RUNTIME_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Doorbell mechanism</title></head><body>
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
  <el-section title="Evidence"><el-links><a href="https://example.invalid/run-10">Run 10 log</a></el-links></el-section>
</main></body></html>`;
const RUNTIME_RU = { "Which doorbell should Claude Code use?": "…", "asyncRewake waiter hook": "…", "Wakes an idle session in 0.2 s": "…", "Why?": "…", Evidence: "…" };

test("segment parity: the check extracts every key the runtime fixture translates", () => {
  const { dir } = makeReview(RUNTIME_PAGE);
  check(dir);
  const { segments } = JSON.parse(fs.readFileSync(path.join(dir, "i18n", "source.json"), "utf8"));
  for (const key of Object.keys(RUNTIME_RU)) assert.ok(segments.includes(key), `segment "${key}"`);
});

// ---------- Tokenizer ----------

function elements(html) {
  const list = [];
  walk(parseHtml(html), (node) => {
    if (node.type === "element") list.push(node);
  });
  return list;
}

test("the parser reads attributes in every form and decodes character references", () => {
  const [node] = elements(`<el-card id=q1 title="Q &amp; A &mdash; &#x2713; &#65;" data-x='single "q"' hidden optional="">x</el-card>`);
  assert.deepEqual(node.attrs, { id: "q1", title: "Q & A — ✓ A", "data-x": 'single "q"', hidden: "", optional: "" });
  assert.equal(textContent(parseHtml("<p>a &lt;b&gt; &unknown; &#999999999;</p>")), "a <b> &unknown; &#999999999;");
});

test("raw text ends at the first matching end tag, as in browsers, and template content is inert", () => {
  const nodes = elements('<script>const s = "<\\/script>"; if (a < b) {}</script><p>after</p><template><p>inside</p><img src="x.png"></template><p>out</p>');
  assert.equal(textContent(nodes[0]), 'const s = "<\\/script>"; if (a < b) {}');
  assert.deepEqual(
    nodes.map((node) => [node.tag, node.inert]),
    [
      ["script", false],
      ["p", false],
      ["template", false],
      ["p", true],
      ["img", true],
      ["p", false],
    ],
  );
  const early = elements('<script>var t = "</script>"; done();</script><p>x</p>');
  assert.equal(textContent(early[0]), 'var t = "');
});

test("unclosed p and li close at the next sibling or the parent's end, and void elements take no children", () => {
  const tree = parseHtml("<div><p>one<p>two<ul><li>a<li>b</ul><img src=a.png/><br><span>s</span></div>");
  const div = tree.children[0];
  assert.deepEqual(
    div.children.map((child) => child.tag),
    ["p", "p", "ul", "img", "br", "span"],
  );
  assert.deepEqual(
    div.children[2].children.map((child) => textContent(child)),
    ["a", "b"],
  );
  assert.equal(div.children[3].attrs.src, "a.png/");
});

test("parse errors carry the line number", () => {
  assert.throws(
    () => parseHtml("<p>ok</p>\n\n<div class='open"),
    (error) => error.line === 3 && /unterminated/u.test(error.message),
  );
  assert.throws(
    () => parseHtml("<p>\n<!-- never closed"),
    (error) => error.line === 2,
  );
  assert.throws(
    () => parseHtml("<script>\nnever closed"),
    (error) => error.line === 1 && /<script>/u.test(error.message),
  );
});
