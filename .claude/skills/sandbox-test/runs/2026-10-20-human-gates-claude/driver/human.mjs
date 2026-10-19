// The human side of the human-gates run, called from ptydrive `run` steps. It never types into the
// agent session.
//   node human.mjs answer  --sandbox S --out DIR [--stop-report] [--set name=value ...] [--leave regex]
//     Answers the latest gate's page in headless Chrome from its review.json schema (choice: first
//     non-recommended option, check: checked unless --leave matches, select: first option, comment:
//     a sentence), applies --set overrides (check=false clicks it twice), takes a screenshot, submits.
//   node human.mjs inbox   --sandbox S --out DIR --text "..."
//   node human.mjs problem --sandbox S --out DIR --text "..."   (on the latest gate's page)
import fs from "node:fs";
import path from "node:path";

import { closeChrome, connect, createSession, launchChrome, sleep } from "../../../../../../packages/cli/scripts/cdp.mjs";

const SLUG = "mini";
const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const sets = argv.flatMap((value, index) => (argv[index - 1] === "--set" ? [value] : [])).map((pair) => pair.split("="));
const sandbox = flag("--sandbox");
const out = flag("--out");
const epicDir = path.join(sandbox, ".epic-loop", "epics", SLUG);
const server = JSON.parse(fs.readFileSync(path.join(sandbox, ".epic-loop", ".runtime", "server.json"), "utf8"));
const log = (entry) => fs.appendFileSync(path.join(out, "human.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), command, ...entry })}\n`);

function latestGate({ stopReport = false } = {}) {
  const events = fs
    .readFileSync(path.join(epicDir, ".runtime", "progress-log.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((event) => event.action === "gate-opened" && (!stopReport || event.kind === "stop-report"));
  if (events.length === 0) throw new Error("no gate-opened event yet");
  return events.at(-1).review;
}

async function post(pathname, body) {
  const response = await fetch(`${server.url.replace(/\/$/u, "")}${pathname}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.text() };
}

function plan(control, leave) {
  const override = sets.find(([name]) => name === control.name);
  if (override) return control.kind === "check" ? override[1] === "true" : override[1];
  if (control.kind === "choice") return (control.options.find((option) => option.value !== control.recommended) ?? control.options[0]).value;
  if (control.kind === "check") return !(leave && (leave.test(control.name) || leave.test(control.label ?? "")));
  if (control.kind === "select") return control.options[0].value;
  return "Answered by the sandbox human.";
}

async function answer() {
  const review = latestGate({ stopReport: argv.includes("--stop-report") });
  const leave = flag("--leave") ? new RegExp(flag("--leave"), "iu") : null;
  const controls = JSON.parse(fs.readFileSync(path.join(epicDir, "reviews", review, "review.json"), "utf8")).schema.controls;
  const browser = await launchChrome();
  const cdp = connect(browser.wsUrl);
  const failures = [];
  try {
    await cdp.ready;
    const s = await createSession(cdp, { failures, log: () => {} });
    const choices = controls.filter((control) => control.kind === "choice").length;
    await s.send("Page.navigate", { url: `${server.url}${SLUG}/reviews/${review}/` });
    await s.waitFor(`document.readyState === 'complete' && !!window.epicLoop && document.querySelectorAll('el-choice fieldset').length === ${choices}`, "runtime ready", 20000);
    await sleep(300);
    const values = {};
    for (const control of controls) {
      const value = plan(control, leave);
      values[control.name] = value;
      const host = `document.querySelector('el-${control.kind}[name="${control.name}"]')`;
      if (control.kind === "choice") await s.evaluate(`${host}.querySelector('input[value="${value}"]').click()`);
      else if (control.kind === "check") {
        // A check is stored only on change: true clicks it once, an explicit false clicks it twice.
        const clicks = value ? 1 : sets.some(([name]) => name === control.name) ? 2 : 0;
        for (let index = 0; index < clicks; index += 1) await s.evaluate(`${host}.querySelector('input[type=checkbox]').click()`);
      } else if (control.kind === "select")
        await s.evaluate(`(() => { const e = ${host}.querySelector('select'); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      else await s.evaluate(`(() => { const e = ${host}.querySelector('textarea'); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    }
    await s.waitFor("document.querySelector('.el-save').dataset.state === 'saved'", "saved").catch(() => {});
    await sleep(500);
    const height = await s.evaluate("Math.max(document.documentElement.scrollHeight, 900)");
    await s.send("Emulation.setDeviceMetricsOverride", { width: 1280, height, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const shot = path.join(out, `page-${review}-${Date.now()}.png`);
    fs.writeFileSync(shot, Buffer.from((await s.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    await s.evaluate("document.querySelector('.el-submit').click()");
    await s.waitFor("!document.querySelector('.el-submitted').hidden", "submitted", 15000);
    const note = await s.evaluate("document.querySelector('.el-doorbell')?.textContent ?? ''");
    log({ doorbellNote: note, review, screenshot: shot, values });
    console.log(`answered ${review}: ${JSON.stringify(values)}; page says: ${note}`);
  } finally {
    await closeChrome(browser, cdp);
  }
}

if (command === "answer") await answer();
else if (command === "inbox") {
  const result = await post(`/api/${SLUG}/inbox`, { text: flag("--text") });
  log({ result });
  console.log(`inbox: ${result.status} ${result.body.trim()}`);
} else if (command === "problem") {
  const review = latestGate();
  const result = await post(`/api/${SLUG}/reviews/${review}/problem`, { text: flag("--text") });
  log({ result, review });
  console.log(`problem on ${review}: ${result.status}`);
} else throw new Error(`unknown command ${command}`);
