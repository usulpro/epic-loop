// Serves the sandbox review with the local CLI and takes headless Chrome screenshots in English and
// Russian (through the page's language switch). Usage: node shots.mjs <sandbox> <slug>/<id> <out dir>
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [sandbox, target, out] = process.argv.slice(2);
const cli = "/projects/my-projects/epic-loop-workspace/epic-loop-visual/packages/cli/src/cli.mjs";
const env = { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" };
const serve = (...args) => JSON.parse(spawnSync(process.execPath, [cli, "serve", "--root", sandbox, "--json", ...args], { encoding: "utf8", env }).stdout);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = serve("--detach");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "shots-chrome-"));
const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
try {
  const wsUrl = await new Promise((resolve) => {
    let buffer = "";
    chrome.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/u);
      if (match) resolve(match[1]);
    });
  });
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) pending.get(message.id)(message.result ?? message.error);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    socket.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => (await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await page("Emulation.setDeviceMetricsOverride", { width: 1100, height: 1400, deviceScaleFactor: 1, mobile: false });
  await page("Page.navigate", { url: `${server.url}${target.replace("/", "/reviews/")}/` });
  for (let i = 0; i < 100 && !(await evaluate("!!window.epicLoop && !!document.querySelector('.el-submitbar')")); i += 1) await sleep(100);
  await evaluate("document.querySelector('[data-theme-set=light]')?.click()");
  await sleep(600);
  const shot = async (name) => fs.writeFileSync(path.join(out, name), Buffer.from((await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await shot("page-en.png");
  const hasRu = await evaluate("!!document.querySelector('[data-lang=ru]')");
  if (hasRu) {
    await evaluate("document.querySelector('[data-lang=ru]').click()");
    await sleep(800);
    await shot("page-ru.png");
  }
  console.log(JSON.stringify({ url: `${server.url}${target.replace("/", "/reviews/")}/`, ru: hasRu, lang: await evaluate("document.documentElement.lang"), h1: await evaluate("document.querySelector('h1')?.textContent"), cardTitle: await evaluate("document.querySelector('el-card h3')?.textContent") }));
  await send("Browser.close").catch(() => {});
  socket.close();
} finally {
  await sleep(300);
  if (chrome.exitCode === null) chrome.kill("SIGKILL");
  serve("--stop");
  fs.rmSync(profile, { recursive: true, force: true });
}
