# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Adding Oxfmt formats too much in one task and obscures behavioral changes. | Review becomes harder and task commits lose focus. | Keep configuration/check integration separate from optional repository-wide formatting cleanup. | open |
| oxlint configuration or rule coverage does not match every existing ESM script/test pattern. | Validation blocks on tooling friction or misses a rule the project expects. | Keep the initial oxlint config focused, verify against all maintained source sets, and add repository-owned checks only for gaps that matter. Current accepted baseline debt: `loop.mjs` and `hooks.mjs` exceed the accepted `max-lines: 600` source limit and are tracked for Phase 1 refactor before phase verification. | mitigation-planned |
| AI-assisted skill review depends on model behavior, Codex auth/config, and structured output discipline. | CI or local review can become flaky, expensive, or hard to interpret. | Keep the AI review behind a script boundary, require schema-valid JSON output, treat malformed/missing output as failure, write artifacts to an ignored directory, and exclude it from `pnpm run validate` unless explicitly opted in. | open |
