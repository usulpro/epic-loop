// Shared helpers for the real-browser scripts: run `epic-loop serve`, launch headless Chrome, and drive
// one page over the DevTools protocol through Node's global WebSocket. No dependencies.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const cliEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.mjs");
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function serve(root, ...extra) {
  const result = spawnSync(process.execPath, [cliEntry, "serve", "--root", root, "--json", ...extra], {
    encoding: "utf8",
    env: { ...process.env, EPIC_LOOP_NO_UPDATE_CHECK: "1" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

export async function launchChrome(chromeBin = "/usr/bin/google-chrome") {
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

export async function closeChrome({ chrome, profile }, cdp) {
  await cdp.send("Browser.close").catch(() => {});
  cdp.close();
  await sleep(300);
  if (chrome.exitCode === null) chrome.kill("SIGKILL");
  fs.rmSync(profile, { recursive: true, force: true });
}

export function connect(wsUrl) {
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

// One page session. `expect` logs PASS/FAIL lines and collects failures; `shot` is a no-op without `shots`.
export async function createSession(cdp, { failures, shots = null, log = (line) => console.log(`check: ${line}`) }) {
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
