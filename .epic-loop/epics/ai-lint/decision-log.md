# Decision Log

## Active Decisions

- Keep one command named `review:skills:ai`; do not split broad review and focused lint into separate package scripts.
- Convert the command behavior toward fixed semantic lint checks instead of open-ended model review.
- Do not rely on installed `skill-creator` or other local skills at runtime. Use their principles as design input, then encode the relevant rules in repo-owned prompts/check definitions.
- Treat deterministic checks as the CI-style validation path. AI review remains a maintainer workflow command outside `pnpm run validate`.

## Historical Decisions

- None recorded yet.
