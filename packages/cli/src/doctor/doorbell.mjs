// Doorbell readiness on the host (D34, D37 of the visual-review epic). These are advisory: a
// missing prerequisite is reported with a fix, but only missing or broken hook entries make
// doctor setup-required. EPIC_LOOP_CLAUDE_BIN / EPIC_LOOP_CODEX_BIN override the binaries.
import { spawnSync } from "node:child_process";
import process from "node:process";

export const CLAUDE_MIN_VERSION = "2.1.293";
export const CODEX_MIN_VERSION = "0.149.0";

function run(bin, args, env) {
  const result = spawnSync(bin, args, { encoding: "utf8", env, timeout: 5000 });
  if (result.error) return { error: result.error.code === "ENOENT" ? "not found" : result.error.message, ok: false, output: "" };
  return { error: result.status === 0 ? null : `exit ${result.status}`, ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function parseVersion(text) {
  const match = String(text).match(/(\d+)\.(\d+)\.(\d+)/u);
  return match ? match.slice(1, 4).map(Number) : null;
}

function atLeast(version, minimum) {
  const min = parseVersion(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (version[index] !== min[index]) return version[index] > min[index];
  }
  return true;
}

export function inspectClaudeDoorbell(waiter, env = process.env) {
  const bin = env.EPIC_LOOP_CLAUDE_BIN || "claude";
  const probe = run(bin, ["--version"], env);
  const version = probe.ok ? parseVersion(probe.output) : null;
  const versionStatus = !version ? "unknown" : atLeast(version, CLAUDE_MIN_VERSION) ? "ok" : "too-old";
  const warnings = [];
  if (waiter.checked && waiter.timeoutMissing.length > 0) {
    warnings.push(`The doorbell waiter hook on ${waiter.timeoutMissing.join(", ")} has no explicit timeout; the default 600 s kills it. Reinstall the hooks.`);
  }
  if (versionStatus === "too-old") warnings.push(`Claude Code ${version.join(".")} is older than ${CLAUDE_MIN_VERSION}, the version the doorbell was verified on.`);
  return {
    mechanism: "asyncRewake waiter hook",
    minimumVersion: CLAUDE_MIN_VERSION,
    note: "asyncRewake runs in the background only in interactive sessions; a headless claude -p driver relies on the UserPromptSubmit fallback.",
    ready: waiter.ready && versionStatus !== "too-old",
    version: version ? version.join(".") : null,
    versionStatus,
    waiter,
    warnings,
  };
}

export function inspectCodexDoorbell(env = process.env) {
  const bin = env.EPIC_LOOP_CODEX_BIN || "codex";
  const probe = run(bin, ["--version"], env);
  const version = probe.ok ? parseVersion(probe.output) : null;
  const queue = probe.ok ? run(bin, ["queue", "--help"], env) : { error: "not checked", ok: false };
  let fix = null;
  if (!probe.ok) fix = `Install the Codex CLI (${CODEX_MIN_VERSION} or newer) so \`${bin}\` is on PATH; the review server rings the session with \`codex queue\`.`;
  else if (!version || !atLeast(version, CODEX_MIN_VERSION))
    fix = `Upgrade the Codex CLI to ${CODEX_MIN_VERSION} or newer (found ${version ? version.join(".") : "an unknown version"}).`;
  else if (!queue.ok) fix = "This Codex CLI has no working `codex queue`; upgrade it.";
  return {
    codex: { error: probe.error, found: probe.ok, version: version ? version.join(".") : null },
    fix,
    mechanism: "codex queue from the review server (provisional, D37)",
    minimumVersion: CODEX_MIN_VERSION,
    queue: { error: queue.error, ok: queue.ok },
    ready: fix === null,
    warnings: fix ? [`Doorbell not ready: ${fix} Until then the human sends a message to continue.`] : [],
  };
}
