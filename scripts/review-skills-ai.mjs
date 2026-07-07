import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const schemaVersion = 1;
const allowedStatuses = new Set(["pass", "fail", "needs-review"]);
const allowedSeverities = new Set(["error", "warning", "info"]);
const outputDirRelative = ".validation-output/skill-review";
const latestReportRelative = `${outputDirRelative}/latest.json`;

export function reviewOutputPaths(root = process.cwd()) {
  const outputDir = path.resolve(root, outputDirRelative);
  const reportPath = path.resolve(root, latestReportRelative);

  if (!isInsidePath(outputDir, reportPath)) {
    throw new Error(`${latestReportRelative} must stay inside ${outputDirRelative}.`);
  }

  return {
    outputDir,
    reportPath,
  };
}

export function validateSkillReviewReport(report, root = process.cwd()) {
  const errors = [];

  if (!isPlainObject(report)) {
    return ["review report must be a JSON object."];
  }

  if (report.schemaVersion !== schemaVersion) {
    errors.push(`schemaVersion must be ${schemaVersion}.`);
  }
  if (!allowedStatuses.has(report.status)) {
    errors.push('status must be one of "pass", "fail", or "needs-review".');
  }
  if (typeof report.summary !== "string" || report.summary.trim().length === 0) {
    errors.push("summary must be a non-empty string.");
  }
  if (!Array.isArray(report.findings)) {
    errors.push("findings must be an array.");
    return errors;
  }

  for (const [index, finding] of report.findings.entries()) {
    validateFinding(errors, finding, index, root);
  }

  return errors;
}

export function blockingReviewReasons(report) {
  const reasons = [];
  if (report.status === "fail") {
    reasons.push("report status is fail.");
  }

  const errorFindings = Array.isArray(report.findings) ? report.findings.filter((finding) => finding?.severity === "error") : [];
  if (errorFindings.length > 0) {
    reasons.push(`${errorFindings.length} error finding(s) present.`);
  }

  return reasons;
}

export function formatSkillReviewReport(report) {
  const lines = [`AI skill review status: ${report.status}`, `Summary: ${report.summary.trim()}`];

  if (report.findings.length === 0) {
    lines.push("Findings: none.");
    return lines;
  }

  lines.push("Findings:");
  for (const finding of report.findings) {
    const lineSuffix = Number.isInteger(finding.line) && finding.line > 0 ? `:${finding.line}` : "";
    lines.push(`- [${finding.severity}] ${finding.code} ${finding.path}${lineSuffix} - ${finding.message}`);
    lines.push(`  Recommendation: ${finding.recommendation}`);
  }

  return lines;
}

export function buildSkillReviewPrompt(reportPath) {
  const normalizedReportPath = reportPath.split(path.sep).join("/");
  return [
    "You are reviewing the maintained epic-loop Agent Skill package for semantic quality.",
    "",
    "Inspect these repository paths:",
    "- plugins/epic-loop/skills/epic-loop/SKILL.md",
    "- plugins/epic-loop/skills/epic-loop/references/",
    "- plugins/epic-loop/skills/epic-loop/scripts/",
    "- .epic-loop/epics/set-up/docs/linting-and-skill-validation-policy.md",
    "",
    "Review only semantic skill-quality concerns that deterministic scripts cannot prove:",
    "- invocation quality and trigger boundaries",
    "- progressive disclosure",
    "- task-local reference organization",
    "- degree of freedom in instructions",
    "- bundled script and external dependency safety concerns",
    "",
    "Do not edit tracked source files. Write exactly one JSON report to:",
    normalizedReportPath,
    "",
    "The report must match this schema:",
    JSON.stringify(
      {
        findings: [
          {
            code: "skill.description.too-broad",
            line: 2,
            message: "Description can trigger outside epic-loop work.",
            path: "plugins/epic-loop/skills/epic-loop/SKILL.md",
            recommendation: "Narrow the trigger wording to explicit epic-loop workspace operations.",
            severity: "error",
          },
        ],
        schemaVersion,
        status: "pass",
        summary: "Short review summary.",
      },
      null,
      2,
    ),
    "",
    'Allowed status values: "pass", "fail", "needs-review".',
    'Allowed severity values: "error", "warning", "info".',
    'Use "fail" when any error finding is present.',
    "Return a short final message after writing the file.",
  ].join("\n");
}

export function runSkillReview(options = {}) {
  const root = options.root ?? process.cwd();
  const codexCommand = options.codexCommand ?? "codex";
  const mockReportPath = options.mockReportPath ?? null;
  const { outputDir, reportPath } = reviewOutputPaths(root);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(reportPath, { force: true });

  if (mockReportPath) {
    fs.copyFileSync(path.resolve(root, mockReportPath), reportPath);
  } else {
    const codexResult = spawnSync(codexCommand, ["exec", "--ephemeral", "--cd", root, "--sandbox", "workspace-write", "-"], {
      cwd: root,
      encoding: "utf8",
      input: buildSkillReviewPrompt(path.relative(root, reportPath)),
      maxBuffer: 10 * 1024 * 1024,
    });
    if (codexResult.status !== 0) {
      return {
        exitCode: 1,
        lines: [
          `codex exec failed with exit code ${codexResult.status ?? "unknown"}.`,
          ...firstOutputLines("stderr", codexResult.stderr),
          ...firstOutputLines("stdout", codexResult.stdout),
        ],
      };
    }
  }

  const reportResult = readReport(reportPath);
  if (!reportResult.ok) {
    return {
      exitCode: 1,
      lines: [reportResult.error],
    };
  }

  const schemaErrors = validateSkillReviewReport(reportResult.report, root);
  if (schemaErrors.length > 0) {
    return {
      exitCode: 1,
      lines: schemaErrors.map((error) => `Invalid review report: ${error}`),
    };
  }

  const blockingReasons = blockingReviewReasons(reportResult.report);
  return {
    exitCode: blockingReasons.length > 0 ? 1 : 0,
    lines: [...formatSkillReviewReport(reportResult.report), ...blockingReasons.map((reason) => `Blocking: ${reason}`)],
  };
}

function validateFinding(errors, finding, index, root) {
  const label = `findings[${index}]`;
  if (!isPlainObject(finding)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!allowedSeverities.has(finding.severity)) {
    errors.push(`${label}.severity must be one of "error", "warning", or "info".`);
  }
  for (const field of ["code", "path", "message", "recommendation"]) {
    if (typeof finding[field] !== "string" || finding[field].trim().length === 0) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }
  if (finding.line !== undefined && finding.line !== null && (!Number.isInteger(finding.line) || finding.line <= 0)) {
    errors.push(`${label}.line must be a positive integer when present.`);
  }
  if (typeof finding.path === "string" && !isRepositoryRelativePath(finding.path, root)) {
    errors.push(`${label}.path must be a repository-relative path.`);
  }
}

function readReport(reportPath) {
  let content;
  try {
    content = fs.readFileSync(reportPath, "utf8");
  } catch (error) {
    return {
      error: `Missing review report: ${path.relative(process.cwd(), reportPath)} (${error instanceof Error ? error.message : String(error)})`,
      ok: false,
    };
  }

  try {
    return {
      ok: true,
      report: JSON.parse(content),
    };
  } catch (error) {
    return {
      error: `Malformed review report JSON: ${error instanceof Error ? error.message : String(error)}`,
      ok: false,
    };
  }
}

function firstOutputLines(label, value) {
  const lines = String(value ?? "")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .slice(0, 10);
  return lines.map((line) => `${label}: ${line}`);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInsidePath(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function isRepositoryRelativePath(value, root) {
  if (value.includes("\\") || path.isAbsolute(value) || value.includes("\0")) {
    return false;
  }
  const absolutePath = path.resolve(root, value);
  return isInsidePath(root, absolutePath);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--mock-report") {
      index += 1;
      if (!args[index]) {
        throw new Error("--mock-report requires a file path.");
      }
      options.mockReportPath = args[index];
      continue;
    }
    if (arg === "--codex-command") {
      index += 1;
      if (!args[index]) {
        throw new Error("--codex-command requires a command.");
      }
      options.codexCommand = args[index];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function runCli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const result = runSkillReview(options);
  const output = result.lines.join("\n");
  if (result.exitCode === 0) {
    console.log(output);
  } else {
    console.error(output);
  }
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
