import { readJson, runtimeStatePath, writeJson } from "./common.mjs";

// The driver session's transcript (Claude Code session JSONL, Codex rollout), for the epic app's
// activity feed (Phase 5 of the visual-review epic). Recorded as
// `implementation_loop.driver_transcript_path` from any hook payload of the driver that carries
// `transcript_path`; other sessions never change it.
export function recordDriverTranscript(projectRoot, payload, binding) {
  const slug = binding?.epic_slug;
  const transcriptPath = typeof payload?.transcript_path === "string" && payload.transcript_path ? payload.transcript_path : null;
  if (!slug || !transcriptPath) return;
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = readJson(runtimePath, {});
  const loop = runtime?.implementation_loop;
  if (!loop || typeof loop !== "object" || loop.driver_session_id !== payload.session_id || loop.driver_transcript_path === transcriptPath) return;
  writeJson(runtimePath, { ...runtime, implementation_loop: { ...loop, driver_transcript_path: transcriptPath } });
}
