import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { validateEpicLoopPackage } from "../../scripts/validate-epic-loop-package.mjs";
import { makeTempRoot, repoRoot } from "./test-utils.mjs";

const validatorScript = path.join(repoRoot, "scripts", "validate-epic-loop-package.mjs");

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function validSkillMarkdown(overrides = {}) {
  const name = overrides.name ?? "epic-loop";
  const description = overrides.description ?? "Use this skill when working with epic-loop workspaces, implementation routing, and durable epic artifacts.";
  const bodyLines = overrides.bodyLines ?? [
    "# Epic Loop",
    "",
    "Use `<skill-dir>` commands for runtime operations.",
    "",
    "Document project-local `.claude/settings.json` for Claude Code hooks.",
    "",
    "Read [Guide](references/guide.md) for details.",
  ];

  return [`---`, `name: ${name}`, `description: ${description}`, `---`, ...bodyLines].join("\n");
}

function validFixture(root) {
  writeJson(root, ".agents/plugins/marketplace.json", {
    interface: {
      description: "Codex or Claude Code hooks for epic-loop workspace automation.",
    },
    name: "epic-loop",
    plugins: [
      {
        name: "epic-loop",
        policy: {
          authentication: "ON_INSTALL",
          installation: "AVAILABLE",
        },
        source: {
          path: "./plugins/epic-loop",
          source: "local",
        },
      },
    ],
  });
  writeJson(root, "plugins/epic-loop/.codex-plugin/plugin.json", {
    description: "Codex or Claude Code hooks for epic-loop workspace automation.",
    interface: {
      longDescription: "Codex or Claude Code hooks for durable epic-loop workspace automation.",
    },
    name: "epic-loop",
    skills: "./skills/",
    version: "1.0.0",
  });
  writeFile(root, "plugins/epic-loop/skills/epic-loop/SKILL.md", `${validSkillMarkdown()}\n`);
  writeFile(root, "plugins/epic-loop/skills/epic-loop/agents/openai.yaml", "name: epic-loop\n");
  writeFile(root, "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-manager-prompt.md", "Manager template.\n");
  writeFile(root, "plugins/epic-loop/skills/epic-loop/assets/templates/implementation-techlead-prompt.md", "Techlead template.\n");
  writeFile(root, "plugins/epic-loop/skills/epic-loop/references/guide.md", "# Guide\n\nShort reference.\n");
  writeFile(root, "plugins/epic-loop/skills/epic-loop/scripts/ok.mjs", "console.log('ok');\n");
}

function withFixture(testName, callback) {
  const root = makeTempRoot(`skill-validation-${testName}-`);
  try {
    validFixture(root);
    callback(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

function assertValidationError(root, expectedPattern) {
  const errors = validateEpicLoopPackage({ root });
  assert.match(errors.join("\n"), expectedPattern);
}

test("skill package validator accepts the maintained repository package and CLI success output", () => {
  assert.deepEqual(validateEpicLoopPackage({ root: repoRoot }), []);

  const result = spawnSync(process.execPath, [validatorScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "epic-loop package validation passed.");
});

test("skill package validator rejects invalid skill names and directory-name mismatches", () => {
  withFixture("name", (root) => {
    writeFile(
      root,
      "plugins/epic-loop/skills/epic-loop/SKILL.md",
      `${validSkillMarkdown({
        name: "InvalidName",
      })}\n`,
    );

    assertValidationError(root, /SKILL\.md frontmatter name must be 1-64 characters of lowercase kebab-case/u);
    assertValidationError(root, /SKILL\.md frontmatter name must match skill directory "epic-loop"/u);
  });
});

test("skill package validator rejects missing descriptions", () => {
  withFixture("description", (root) => {
    writeFile(
      root,
      "plugins/epic-loop/skills/epic-loop/SKILL.md",
      `${validSkillMarkdown({
        description: "",
      })}\n`,
    );

    assertValidationError(root, /SKILL\.md frontmatter must include a non-empty description/u);
  });
});

test("skill package validator rejects over-budget entrypoint bodies", () => {
  withFixture("line-budget", (root) => {
    const bodyLines = [
      "# Epic Loop",
      "Use `<skill-dir>` commands for runtime operations.",
      "Document project-local `.claude/settings.json` for Claude Code hooks.",
      "Read [Guide](references/guide.md) for details.",
      ...Array.from({ length: 501 }, (_, index) => `Instruction line ${index + 1}.`),
    ];
    writeFile(root, "plugins/epic-loop/skills/epic-loop/SKILL.md", `${validSkillMarkdown({ bodyLines })}\n`);

    assertValidationError(root, /SKILL\.md body must stay at or below 500 lines/u);
  });
});

test("skill package validator rejects long references without a table of contents", () => {
  withFixture("toc", (root) => {
    writeFile(
      root,
      "plugins/epic-loop/skills/epic-loop/references/guide.md",
      ["# Guide", "", ...Array.from({ length: 105 }, (_, index) => `Reference line ${index + 1}.`)].join("\n"),
    );

    assertValidationError(root, /references\/guide\.md is \d+ lines and must include a table of contents near the top/u);
  });
});

test("skill package validator rejects backslash markdown link targets", () => {
  withFixture("backslash-link", (root) => {
    writeFile(
      root,
      "plugins/epic-loop/skills/epic-loop/SKILL.md",
      `${validSkillMarkdown({
        bodyLines: [
          "# Epic Loop",
          "Use `<skill-dir>` commands for runtime operations.",
          "Document project-local `.claude/settings.json` for Claude Code hooks.",
          "Read [Guide](references\\guide.md) for details.",
        ],
      })}\n`,
    );

    assertValidationError(root, /SKILL\.md markdown link target must use forward slashes: references\\guide\.md/u);
  });
});

test("skill package validator rejects runtime artifacts in the skill package", () => {
  withFixture("runtime-artifact", (root) => {
    writeFile(root, "plugins/epic-loop/skills/epic-loop/.runtime/prompt-log.md", "debug trace\n");

    assertValidationError(root, /\.runtime looks like a runtime\/debug artifact/u);
  });
});

test("skill package validator CLI prints actionable path diagnostics on failure", () => {
  withFixture("cli-failure", (root) => {
    writeFile(root, "plugins/epic-loop/skills/epic-loop/.runtime/prompt-log.md", "debug trace\n");

    const result = spawnSync(process.execPath, [validatorScript], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /^- plugins\/epic-loop\/skills\/epic-loop\/\.runtime looks like a runtime\/debug artifact/mu);
  });
});
