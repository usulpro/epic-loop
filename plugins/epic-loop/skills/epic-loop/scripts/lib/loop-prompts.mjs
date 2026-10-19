import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STOP_REPORT_HEADINGS, latestStopReportPath } from "./stop-reports.mjs";

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

export function buildTechleadPrompt(slug, iteration, stopChallenge = null, ingestNote = null) {
  const promptPath = `.epic-loop/epics/${slug}/.runtime/current-engineer-prompt.md`;
  const latestEngineerReportPath = `.epic-loop/epics/${slug}/${LATEST_ENGINEER_REPORT_RELATIVE_PATH}`;

  const prompt = renderTemplate(fs.readFileSync(TECHLEAD_PROMPT_TEMPLATE_PATH, "utf8"), {
    EngineerPromptPath: promptPath,
    EpicSlug: slug,
    Iteration: String(iteration),
    LatestEngineerReportPath: latestEngineerReportPath,
    SkillDir: SKILL_DIR,
  });

  // One-time notes go right under the header line, so they frame the whole turn.
  const notes = [ingestNote, stopChallenge ? formatStopChallenge(stopChallenge) : null].filter(Boolean);
  if (notes.length === 0) {
    return prompt;
  }

  const [header, ...rest] = prompt.split("\n");
  return [header, ...notes.flatMap((note) => ["", note]), ...rest].join("\n");
}

// Stop-review rules by class (D16): what the manager does with each kind of stop request.
// The manager queues what needs the human; the techlead records agent-made decisions, sets
// on-hold and reorders (D23). The manager role reference restates these rules.
export const STOP_CLASS_RULES = {
  A: ["Class A, done: a phase or the epic is complete.", "- Accept. Never challenge a class A stop."],
  B: [
    "Class B, needs the human's hands or authority (publish, release, an upgrade outside the repo, sign-in, an attended session, explicit authorization).",
    "- Never override the need itself; only check whether independent work is left.",
    "- Independent work left: queue the item, then challenge with the H id, the task to put on-hold, and the independent task to continue with.",
    "- Queue it with kind `human-action`, or `security-hold` when a guard stopped a dangerous operation:",
    '  `<HumanQueueAdd> --kind human-action --ask "<what the human must do>" --why "<why>" --blocks "<needed before task ...>"`',
    "- In the challenge, give the techlead the exact on-hold command, with the task's position id from `tracker.md` (`phase-N-task-k`) when you can tell it:",
    "  `<SetTaskStatus> --task-id <phase-N-task-k> --status on-hold --hold-kind human-action --hold-item H<n>`",
    "- Nothing independent left: accept.",
  ],
  C: [
    "Class C, a decision with a reasonable default.",
    '- Challenge with: "take the default <X>, record it with `agent-decision.mjs add` (agent-made), continue with <task>."',
    "- If the default is expensive to reverse, treat it like class B with kind `costly-decision`:",
    '  `<HumanQueueAdd> --kind costly-decision --ask "<the decision>" --why "<why it is costly>" --blocks "<needed before task ...>" --default "<X>"`',
  ],
  D: [
    "Class D, environment friction (a busy port, foreign resources, a flaky tool).",
    "- Challenge with a concrete workaround (another port, a disposable resource, a retry), or with deferring the affected verification to the phase verification task and continuing.",
    "- Accept only when nothing else is left.",
  ],
  E: ["Class E, ordering or bookkeeping.", '- Never a stop. Challenge with: "reorder / fix the bookkeeping, then continue with <task>."'],
  F: [
    "Class F, a product decision with no default.",
    "- Never override the need itself; only check whether independent work is left.",
    "- Independent work left: queue the decision, then challenge with the H id, the task to put on-hold, and the independent task to continue with:",
    '  `<HumanQueueAdd> --kind product-decision --ask "<the decision>" --why "<why it has no default>" --blocks "<needed before task ...>"`',
    "- In the challenge, give the techlead the exact on-hold command, with the task's position id from `tracker.md` (`phase-N-task-k`) when you can tell it:",
    "  `<SetTaskStatus> --task-id <phase-N-task-k> --status on-hold --hold-kind product-decision --hold-item H<n>`",
    "- Nothing independent left: accept.",
  ],
};
export const REPEATED_STOP_RULE = "This is a repeated request after a challenge: accept it. There is only one challenge round.";

// The manager is reviewing a stop the techlead requested, instead of doing housekeeping.
export function buildStopReviewPrompt(projectRoot, slug, iteration, stopRequest) {
  return renderTemplate(fs.readFileSync(STOP_REVIEW_PROMPT_TEMPLATE_PATH, "utf8"), {
    EpicSlug: slug,
    Iteration: String(iteration),
    PreviousStopReport: latestStopReportPath(projectRoot, slug) ?? "none",
    ResumeCommand: `node ${path.join(SKILL_DIR, "scripts", "bind-session.mjs")} --current --slug ${slug} --mode implementation`,
    StopReportHeadings: STOP_REPORT_HEADINGS.join("\n"),
    SkillDir: SKILL_DIR,
    StopClassRule: formatStopClassRule(slug, stopRequest),
    StopBlocks: stopRequest.blocks ?? "",
    StopClass: stopRequest.class ?? "",
    StopReason: stopRequest.reason ?? "",
    StopRound: String(stopRequest.round ?? 1),
  });
}

function formatStopClassRule(slug, stopRequest) {
  const humanQueueAdd = `node ${path.join(SKILL_DIR, "scripts", "human-queue.mjs")} add --slug "${slug}"`;
  const setTaskStatus = `node ${path.join(SKILL_DIR, "scripts", "set-task-status.mjs")} --slug "${slug}"`;
  const rule = (STOP_CLASS_RULES[stopRequest.class] ?? []).map((line) => line.replace("<HumanQueueAdd>", humanQueueAdd).replace("<SetTaskStatus>", setTaskStatus));
  return (stopRequest.round ?? 1) >= 2 ? [REPEATED_STOP_RULE, "", ...rule].join("\n") : rule.join("\n");
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
    `What to do for each class: see "After A Challenge" in ${path.join(SKILL_DIR, "references", "implementation-techlead-role.md")}.`,
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

export function renderTemplate(template, values) {
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
