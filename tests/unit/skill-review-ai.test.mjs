import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { blockingReviewReasons, formatSkillReviewReport, reviewOutputPaths, validateSkillReviewReport } from "../../scripts/review-skills-ai.mjs";
import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const runnerScript = path.join(repoRoot, "scripts", "review-skills-ai.mjs");

function validReport(overrides = {}) {
  return {
    findings: [],
    schemaVersion: 1,
    status: "pass",
    summary: "Skill review passed.",
    ...overrides,
  };
}

function writeReport(root, relativePath, report) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function withTempRoot(prefix, callback) {
  const root = makeTempRoot(prefix);
  try {
    callback(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

test("AI skill review report schema accepts a valid pass report", () => {
  assert.deepEqual(validateSkillReviewReport(validReport(), repoRoot), []);
});

test("AI skill review report schema rejects invalid top-level and finding fields", () => {
  const errors = validateSkillReviewReport(
    validReport({
      findings: [
        {
          code: "",
          line: 0,
          message: "",
          path: "../outside.md",
          recommendation: "",
          severity: "blocker",
        },
      ],
      schemaVersion: 2,
      status: "unknown",
      summary: "",
    }),
    repoRoot,
  );

  assert.match(errors.join("\n"), /schemaVersion must be 1/u);
  assert.match(errors.join("\n"), /status must be one of/u);
  assert.match(errors.join("\n"), /summary must be a non-empty string/u);
  assert.match(errors.join("\n"), /findings\[0\]\.severity/u);
  assert.match(errors.join("\n"), /findings\[0\]\.code/u);
  assert.match(errors.join("\n"), /findings\[0\]\.line/u);
  assert.match(errors.join("\n"), /findings\[0\]\.path must be a repository-relative path/u);
});

test("AI skill review output formatting is stable and path-oriented", () => {
  const lines = formatSkillReviewReport(
    validReport({
      findings: [
        {
          code: "skill.progressive-disclosure.too-broad",
          line: 12,
          message: "Entrypoint carries too much conditional detail.",
          path: "plugins/epic-loop/skills/epic-loop/SKILL.md",
          recommendation: "Move conditional detail into a direct reference.",
          severity: "warning",
        },
      ],
      status: "needs-review",
      summary: "One warning found.",
    }),
  );

  assert.deepEqual(lines, [
    "AI skill review status: needs-review",
    "Summary: One warning found.",
    "Findings:",
    "- [warning] skill.progressive-disclosure.too-broad plugins/epic-loop/skills/epic-loop/SKILL.md:12 - Entrypoint carries too much conditional detail.",
    "  Recommendation: Move conditional detail into a direct reference.",
  ]);
});

test("AI skill review blocking policy treats fail status and error findings as non-zero", () => {
  assert.deepEqual(blockingReviewReasons(validReport()), []);
  assert.deepEqual(blockingReviewReasons(validReport({ status: "fail" })), ["report status is fail."]);
  assert.deepEqual(
    blockingReviewReasons(
      validReport({
        findings: [
          {
            code: "skill.description.too-broad",
            message: "Description can trigger outside this package.",
            path: "plugins/epic-loop/skills/epic-loop/SKILL.md",
            recommendation: "Narrow the description.",
            severity: "error",
          },
        ],
      }),
    ),
    ["1 error finding(s) present."],
  );
});

test("AI skill review CLI accepts a mocked valid report and writes under ignored output", () => {
  withTempRoot("skill-review-pass-", (root) => {
    writeReport(root, "mock-pass.json", validReport());

    const result = spawnSync(process.execPath, [runnerScript, "--mock-report", "mock-pass.json"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AI skill review status: pass/u);
    assert.equal(fs.existsSync(reviewOutputPaths(root).reportPath), true);
  });
});

test("AI skill review CLI rejects a mocked report with error findings", () => {
  withTempRoot("skill-review-fail-", (root) => {
    writeReport(
      root,
      "mock-fail.json",
      validReport({
        findings: [
          {
            code: "skill.description.too-broad",
            message: "Description can trigger outside this package.",
            path: "plugins/epic-loop/skills/epic-loop/SKILL.md",
            recommendation: "Narrow the description.",
            severity: "error",
          },
        ],
      }),
    );

    const result = spawnSync(process.execPath, [runnerScript, "--mock-report", "mock-fail.json"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Blocking: 1 error finding\(s\) present\./u);
  });
});
