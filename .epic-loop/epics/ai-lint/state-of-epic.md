# State Of Epic

Epic: Focused AI Skill Review Checks
Slug: `ai-lint`
Created: 2026-07-08T11:25:43+00:00
Active phase: Phase 1 - Shape The Epic
Active task: Phase 1 Task 2 - Review the fixed semantic check catalog

## Current State

- This epic follows the completed `set-up` epic and owns the next iteration of `pnpm run review:skills:ai`.
- Maintainer discussion established that the current AI review is too broad and unstable for lint-like drift detection.
- The desired direction is to keep one AI review command, but convert it from an open-ended semantic review into a focused semantic lint with fixed checks.
- The fixed checks should cover instruction drift and degradation that ordinary deterministic linters cannot catch.

## Blockers

- None recorded.

## Next Action

- Review `docs/problem-framing.md` and `docs/semantic-lint-contract.md`, then refine or approve the roadmap before implementation starts.
