// Logs every event of /api/<slug>/events with its arrival time, and the driver transcript's size
// changes, so feed delays can be split between the host, the server and the page.
// Usage: node sse-log.mjs --url <server url> --sandbox <dir> --out <file> --minutes <n>
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
const flag = (name) => process.argv[process.argv.indexOf(name) + 1];
const base = new URL(flag("--url"));
const runtime = path.join(flag("--sandbox"), ".epic-loop", "epics", "mini", ".runtime", "runtime-state.json");
const out = flag("--out");
const end = Date.now() + Number(flag("--minutes")) * 60000;
const log = (entry) => fs.appendFileSync(out, `${JSON.stringify({ t: Date.now(), ...entry })}\n`);
const connect = () => {
  const req = http.get({ headers: { host: base.host }, host: base.hostname, path: "/api/mini/events", port: base.port }, (res) => {
    log({ open: res.statusCode });
    res.setEncoding("utf8");
    res.on("data", (chunk) => { for (const m of chunk.matchAll(/event: (\w+)\ndata: (.*)/g)) log({ data: m[2], event: m[1] }); });
    res.on("end", () => log({ closed: true }));
  });
  req.on("error", (error) => log({ error: error.message }));
};
connect();
let size = -1;
let file = null;
while (Date.now() < end) {
  await new Promise((r) => setTimeout(r, 100));
  try {
    file ??= JSON.parse(fs.readFileSync(runtime, "utf8")).implementation_loop?.driver_transcript_path ?? null;
    if (file) {
      const now = fs.statSync(file).size;
      if (now !== size) log({ size: now });
      size = now;
    }
  } catch {}
}
process.exit(0);
