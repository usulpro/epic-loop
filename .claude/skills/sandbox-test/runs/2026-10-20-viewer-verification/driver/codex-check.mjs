// The Codex cell's watcher (HTTP only, outside Codex): records when the skill stores
// driver_transcript_path, how the activity feed follows the live rollout (delay from an item's
// rollout timestamp to its first appearance in ?fragment=activity), and whether the statistics follow
// progress-report.md. Stops the session (SIGTERM to --kill) after --turns turn-stop events or
// --max-minutes. Usage: node codex-check.mjs --sandbox <dir> --out <dir> --url <url> --kill <pid>
import fs from "node:fs";
import path from "node:path";

const flag = (name, fallback = null) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const S = flag("--sandbox");
const OUT = flag("--out");
const URL_BASE = flag("--url");
const KILL = Number(flag("--kill", "0"));
const TURNS = Number(flag("--turns", "3"));
const MAX_MS = Number(flag("--max-minutes", "10")) * 60000;
const EPIC = path.join(S, ".epic-loop", "epics", "mini");
const record = (entry) => fs.appendFileSync(path.join(OUT, "codex-check.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};
const progress = () =>
  (fs.existsSync(path.join(EPIC, ".runtime", "progress-log.jsonl")) ? fs.readFileSync(path.join(EPIC, ".runtime", "progress-log.jsonl"), "utf8") : "")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const plain = (html) => html.replace(/<a class="el-ref"[^>]*>([^<]*)<\/a>/gu, "$1");

const seen = new Map();
const results = { feedItems: 0, kinds: {}, statsMatches: 0, statsChecks: 0, transcript: null };
const started = Date.now();
let stopped = null;
while (Date.now() - started < MAX_MS + 120000) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const loop = readJson(path.join(EPIC, ".runtime", "runtime-state.json"))?.implementation_loop;
  if (!results.transcript && loop?.driver_transcript_path) {
    results.transcript = { exists: fs.existsSync(loop.driver_transcript_path), path: loop.driver_transcript_path, seenAfterMs: Date.now() - started };
    record({ transcript: results.transcript });
  }
  try {
    const feed = await (await fetch(new URL("/mini?fragment=activity", URL_BASE))).text();
    for (const match of feed.matchAll(/data-kind="([a-z]+)"><span class="el-feed__time el-meta"><time class="el-ago" data-ago="([^"]+)"[^>]*>[^<]*<\/time><\/span><span class="el-feed__kind">[^<]*<\/span><span class="el-feed__text">([^<]*)</gu)) {
      const key = `${match[2]}|${match[3]}`;
      if (seen.has(key)) continue;
      seen.set(key, { at: match[2], delay: Date.now() - Date.parse(match[2]), kind: match[1], text: match[3].slice(0, 120) });
      results.kinds[match[1]] = (results.kinds[match[1]] ?? 0) + 1;
    }
    const report = fs.existsSync(path.join(EPIC, ".runtime", "progress-report.md")) ? fs.readFileSync(path.join(EPIC, ".runtime", "progress-report.md"), "utf8") : null;
    if (report) {
      const html = plain(await (await fetch(new URL("/mini?fragment=main", URL_BASE))).text());
      const active = report.match(/^- Active turn time: (.+)$/mu)?.[1];
      const completed = report.match(/^- Completed turns: (\d+)$/mu)?.[1];
      results.statsChecks += 1;
      if (html.includes(`<dt>active time</dt><dd>${active}</dd>`) && html.includes(`<dt>turns</dt><dd>${completed} completed`)) results.statsMatches += 1;
      results.lastStats = { active, completed };
    }
  } catch (error) {
    record({ error: error.message });
  }
  const events = progress();
  const stops = events.filter((event) => event.action === "turn-stop").length;
  if (!stopped && (stops >= TURNS || Date.now() - started > MAX_MS)) {
    stopped = { reason: stops >= TURNS ? `${stops} turn-stop events` : "time limit", stops, turnStarts: events.filter((event) => event.action === "turn-start").length };
    record({ stopped });
    if (KILL) {
      try {
        process.kill(KILL, "SIGTERM");
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    break;
  }
}
const items = [...seen.values()].filter((item) => Date.parse(item.at) > started);
const delays = items.map((item) => item.delay).toSorted((a, b) => a - b);
results.feedItems = items.length;
results.delays = { median: delays[Math.floor(delays.length / 2)] ?? null, samples: delays.length, worst: delays.at(-1) ?? null };
results.stopped = stopped;
results.sample = items.slice(-12);
fs.writeFileSync(path.join(OUT, "codex-check.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify({ ...results, sample: undefined }, null, 1));
