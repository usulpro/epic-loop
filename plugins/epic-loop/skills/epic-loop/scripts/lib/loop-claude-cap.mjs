import { readRuntimePlatform, runtimeStatePath, writeJson } from "./common.mjs";

const CLAUDE_BLOCK_CAP_ENV = "CLAUDE_CODE_STOP_HOOK_BLOCK_CAP";
const CLAUDE_BLOCK_CAP_PROXIMITY_REMAINING = 1;

export function ensureClaudeBlockCapMetadata(projectRoot, slug, runtime, loop, timestamp) {
  const nextLoop = withClaudeBlockCapMetadata(projectRoot, loop, timestamp);

  if (nextLoop === loop) {
    return { loop, runtime };
  }

  const nextRuntime = {
    ...runtime,
    implementation_loop: nextLoop,
    updated_at: timestamp,
  };

  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  return {
    loop: nextLoop,
    runtime: nextRuntime,
  };
}

export function withClaudeBlockCapMetadata(projectRoot, loop, timestamp) {
  if (readRuntimePlatform(projectRoot).platform !== "claude-code") {
    return loop;
  }

  const existing = normalizeObject(loop.claude_code_stop_hook_block_cap);
  if (existing.recorded_at) {
    return loop;
  }

  return {
    ...loop,
    claude_code_stop_hook_block_cap: {
      ...readClaudeBlockCapEnv(),
      consecutive_blocks: Number.isFinite(existing.consecutive_blocks) ? existing.consecutive_blocks : 0,
      last_block_at: existing.last_block_at ?? null,
      proximity_remaining: CLAUDE_BLOCK_CAP_PROXIMITY_REMAINING,
      proximity_routed_at: existing.proximity_routed_at ?? null,
      recorded_at: timestamp,
    },
  };
}

export function isClaudeBlockCapExhausted(loop) {
  const cap = normalizeObject(loop.claude_code_stop_hook_block_cap);
  if (cap.uncapped === true || cap.finite !== true || !Number.isFinite(cap.value)) {
    return false;
  }

  const consecutiveBlocks = Number.isFinite(cap.consecutive_blocks) ? cap.consecutive_blocks : 0;
  return cap.value - consecutiveBlocks <= 0;
}

export function resetClaudeBlockCountForTurn(projectRoot, slug, runtime, loop, timestamp) {
  const cap = normalizeObject(loop.claude_code_stop_hook_block_cap);
  const consecutiveBlocks = Number.isFinite(cap.consecutive_blocks) ? cap.consecutive_blocks : 0;

  if (consecutiveBlocks === 0 && !cap.proximity_routed_at) {
    return { loop, runtime };
  }

  const nextLoop = {
    ...loop,
    claude_code_stop_hook_block_cap: {
      ...cap,
      consecutive_blocks: 0,
      proximity_routed_at: null,
    },
  };
  const nextRuntime = {
    ...runtime,
    implementation_loop: nextLoop,
    updated_at: timestamp,
  };

  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  return { loop: nextLoop, runtime: nextRuntime };
}

export function getClaudeBlockCapProximityRoute(loop, timestamp) {
  const cap = normalizeObject(loop.claude_code_stop_hook_block_cap);
  if (cap.uncapped === true || cap.finite !== true || !Number.isFinite(cap.value)) {
    return null;
  }

  const consecutiveBlocks = Number.isFinite(cap.consecutive_blocks) ? cap.consecutive_blocks : 0;
  const remainingBlocks = cap.value - consecutiveBlocks;
  if (remainingBlocks > CLAUDE_BLOCK_CAP_PROXIMITY_REMAINING || cap.proximity_routed_at) {
    return null;
  }

  return {
    reason: [
      `${CLAUDE_BLOCK_CAP_ENV}-proximity`,
      `The implementation loop is at ${consecutiveBlocks}/${cap.value} consecutive Claude Code Stop-hook block continuations.`,
      "Route to manager before Claude Code forces the run to stop.",
      `Tell the user the loop is stopping because it is close to ${CLAUDE_BLOCK_CAP_ENV}.`,
      "Tell the user to manually ask the agent to continue loop mode when ready.",
    ].join(" "),
    routed_at: timestamp,
  };
}

export function incrementClaudeBlockCount(loop, platform, timestamp, capProximityRoute) {
  if (platform !== "claude-code") {
    return loop;
  }

  const cap = normalizeObject(loop.claude_code_stop_hook_block_cap);
  const consecutiveBlocks = Number.isFinite(cap.consecutive_blocks) ? cap.consecutive_blocks : 0;

  return {
    ...loop,
    claude_code_stop_hook_block_cap: {
      ...cap,
      consecutive_blocks: consecutiveBlocks + 1,
      last_block_at: timestamp,
      proximity_routed_at: capProximityRoute?.routed_at ?? cap.proximity_routed_at ?? null,
    },
  };
}

function readClaudeBlockCapEnv() {
  const rawValue = process.env[CLAUDE_BLOCK_CAP_ENV] ?? null;
  const numericValue = typeof rawValue === "string" && /^\d+$/u.test(rawValue) ? Number(rawValue) : null;

  return {
    env_var: CLAUDE_BLOCK_CAP_ENV,
    finite: numericValue !== null && numericValue > 0,
    raw_value: rawValue,
    uncapped: numericValue === 0,
    valid: numericValue !== null,
    value: numericValue,
  };
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
