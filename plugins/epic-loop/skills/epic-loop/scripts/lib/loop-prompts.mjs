import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = path.dirname(path.dirname(LIB_DIR));
export const MANAGER_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "assets", "templates", "implementation-manager-prompt.md");
export const TECHLEAD_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "assets", "templates", "implementation-techlead-prompt.md");
export const STOP_REVIEW_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "assets", "templates", "implementation-stop-review-prompt.md");
const LATEST_ENGINEER_REPORT_RELATIVE_PATH = ".runtime/latest-engineer-report.md";
const LATEST_MANAGER_REPORT_RELATIVE_PATH = ".runtime/latest-manager-report.md";
const CLAUDE_MANUAL_CONTINUE_NOTE = [
  "",
  "## Claude Code Continuation Note",
  "",
  "This run is approaching `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, so the implementation loop will pause after this turn instead of chaining into the next role automatically.",
  "Tell the user that when they are ready to resume they should send: `continue loop mode`.",
].join("\n");

export function buildTechleadPrompt(slug, iteration, stopChallenge = null) {
  const promptPath = `.epic-loop/epics/${slug}/.runtime/current-engineer-prompt.md`;
  const latestEngineerReportPath = `.epic-loop/epics/${slug}/${LATEST_ENGINEER_REPORT_RELATIVE_PATH}`;

  const prompt = renderTemplate(fs.readFileSync(TECHLEAD_PROMPT_TEMPLATE_PATH, "utf8"), {
    EngineerPromptPath: promptPath,
    EpicSlug: slug,
    Iteration: String(iteration),
    LatestEngineerReportPath: latestEngineerReportPath,
    SkillDir: SKILL_DIR,
  });

  if (!stopChallenge) {
    return prompt;
  }

  // Right under the header line, so the challenge frames the whole turn.
  const [header, ...rest] = prompt.split("\n");
  return [header, "", formatStopChallenge(stopChallenge), ...rest].join("\n");
}

// The manager is reviewing a stop the techlead requested, instead of doing housekeeping.
export function buildStopReviewPrompt(slug, iteration, stopRequest) {
  return renderTemplate(fs.readFileSync(STOP_REVIEW_PROMPT_TEMPLATE_PATH, "utf8"), {
    EpicSlug: slug,
    Iteration: String(iteration),
    SkillDir: SKILL_DIR,
    StopBlocks: stopRequest.blocks ?? "",
    StopClass: stopRequest.class ?? "",
    StopReason: stopRequest.reason ?? "",
    StopRound: String(stopRequest.round ?? 1),
  });
}

function formatStopChallenge(challenge) {
  return [
    "## Stop Request Challenged",
    "",
    `The manager stop review did not accept your stop request (class ${challenge.class}, round ${challenge.round}).`,
    "",
    `- Your reason: ${challenge.reason}`,
    `- What it blocks: ${challenge.blocks}`,
    "",
    "Manager instruction:",
    "",
    challenge.instruction,
    "",
    "Follow the instruction. If the stop is still required, file the stop request again with new evidence; the manager accepts a repeated request.",
  ].join("\n");
}

export function buildManagerPrompt(slug, iteration, housekeepingReason) {
  const latestManagerReportPath = `.epic-loop/epics/${slug}/${LATEST_MANAGER_REPORT_RELATIVE_PATH}`;

  return renderTemplate(fs.readFileSync(MANAGER_PROMPT_TEMPLATE_PATH, "utf8"), {
    EpicSlug: slug,
    HousekeepingReason: housekeepingReason ?? "implementation-housekeeping",
    Iteration: String(iteration),
    LatestManagerReportPath: latestManagerReportPath,
    SkillDir: SKILL_DIR,
  });
}

export function buildEngineerPrompt(projectRoot, slug, loop, iteration) {
  const promptFile = loop.prompt_file;
  const absolutePromptPath = promptFile ? path.resolve(projectRoot, promptFile) : null;
  const promptText = absolutePromptPath && fs.existsSync(absolutePromptPath) ? fs.readFileSync(absolutePromptPath, "utf8").trim() : "";

  return [
    `Focused implementation task ${iteration}.`,
    "",
    "Execute the task brief below. Keep the work narrow and do not widen the scope.",
    "",
    promptText ? "## Task Brief" : "## Task Brief Missing",
    "",
    promptText || "No task brief was found. Report that the brief is missing and stop.",
    "",
    "## Report",
    "",
    "When finished, reply with a concise factual report:",
    "",
    "- changed files",
    "- implemented behavior",
    "- verification run and results",
    "- blockers, gaps, or follow-up notes",
    "",
    "The loop records your final message as the report. If you end the turn to wait for a background task you started, the loop waits for its notification and you continue this turn.",
    `If you leave a background process running on purpose (e.g. a dev server), run ${completeTurnCommand(slug)} before your final message.`,
  ].join("\n");
}

// Marks the open role turn done, so the loop chains to the next role even while background
// tasks the role started keep running.
export function completeTurnCommand(slug) {
  return `node ${path.join(SKILL_DIR, "scripts", "complete-turn.mjs")} --slug ${slug}`;
}

export function normalizePromptFile(root, slug, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const rawPath = value.trim();
  const relative = path.isAbsolute(rawPath) ? path.relative(root, rawPath) : rawPath;
  const normalized = path.normalize(relative);
  if (normalized.startsWith("..")) {
    throw new Error(`Prompt file must stay inside the project: ${relative}`);
  }

  if (!normalized.startsWith(`.epic-loop${path.sep}epics${path.sep}${slug}${path.sep}`) && !normalized.startsWith(`.epic-loop/epics/${slug}/`)) {
    throw new Error(`Prompt file must be inside .epic-loop/epics/${slug}/.`);
  }

  return normalized;
}

export function appendClaudeManualContinueNote(prompt) {
  return `${prompt.trim()}\n${CLAUDE_MANUAL_CONTINUE_NOTE}`;
}

function renderTemplate(template, values) {
  return Object.entries(values)
    .reduce((result, [key, value]) => result.replaceAll(`-<<*{{${key}}}*>>-`, value), template)
    .trim();
}

// The user aborted this role's previous turn (Esc / Ctrl+C) and was answered in a plain
// user turn; the role runs again from the top, so it must re-check what already landed.
export function prependResumeNote(prompt, role) {
  return [
    `Resuming the ${role} turn that the user interrupted.`,
    "Re-check the current state first (changed files, git status, epic artifacts) and do not redo steps that already landed.",
    "",
    prompt.trim(),
  ].join("\n");
}
