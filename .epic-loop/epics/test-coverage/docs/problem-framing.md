# Epic Problem Framing

## Problem

Test coverage and eval pipeline for the epic-loop skill engine: add unit tests for deterministic scripts and helpers, create fixture projects for agent eval runs, research Codex-compatible automated eval execution and tracing, define metrics, run real evals, record results, and set up regression pipeline.

## Desired Outcome

`epic-loop` has a practical confidence layer:

- deterministic unit tests cover the engine scripts and reusable functions that can be proven without an LLM;
- three fixture projects exercise realistic multi-phase epic work in agent eval runs;
- the repo has a documented and runnable approach for automated Codex skill evals, trace capture, scoring, and regression checks;
- baseline eval results are recorded so future changes can be compared against a known starting point.

## Scope

- Add unit tests for deterministic behavior in `plugins/epic-loop/skills/epic-loop/scripts/**` and related helper modules.
- Cover basic scripts, helper functions, state transitions, hook routing behavior, tracker rendering, and meaningful edge cases.
- Create three fixture projects for eval runs with multi-phase epic tasks that represent realistic target-project work.
- Research Codex-provided tooling and practical CLI/MCP approaches for automated runs with the skill installed.
- Build or configure the eval runner, trace collection, result storage, scoring, and regression pipeline.
- Run real baseline evals and commit durable evidence in repo-appropriate artifacts.

## Non-Scope

- Do not test static prose wording in generated documents.
- Do not chase exhaustive absence tests or brittle snapshots for every missing file.
- Do not treat agent evals as replacements for deterministic unit tests.
- Do not add sample application code outside fixture projects unless it is needed for eval validity.
- Do not commit local runtime logs, hook captures, prompt logs, or target-project `.epic-loop/.runtime` state.

## Constraints

- Keep this repository shaped as a public plugin and skill package.
- Prefer small deterministic Node.js scripts for mechanical state changes.
- Use the repo's existing package manager, validation flow, and script style.
- Generated artifacts, docs, test fixtures, and Trello content must be written in English.
- Unit tests should be reasonable and behavior-focused, not maximalist.
- Eval tracing must preserve enough evidence for debugging without committing sensitive or noisy runtime transcripts.

## Open Questions

- Which built-in Codex CLI or plugin tooling can run non-interactive agent evals with a local skill installed?
- What trace format is stable enough to keep as evaluation evidence?
- Which eval metrics are objective enough for CI gating, and which should remain report-only?
- How much agent-run variance should the pipeline tolerate before flagging a regression?
