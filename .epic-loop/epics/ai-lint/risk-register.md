# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Model output remains unstable even with fixed checks. | The command stays noisy and cannot support reliable maintainer triage. | Restrict check ids, severities, target files, and output schema; verify with repeated live runs. | open |
| Check catalog becomes too broad and recreates a general review. | The command drifts back into subjective review findings. | Keep the initial catalog small and reject free-form model-created codes. | open |
| Fixed checks miss real script safety bugs. | AI review may appear more reliable than it is. | Keep script safety in deterministic tests where possible; use AI only for semantic instruction contracts. | open |
| Installed skill availability differs across maintainer environments. | Review behavior becomes environment-dependent. | Do not require `skill-creator` or other installed skills inside `codex exec`; bake needed guidance into repo-owned prompt/checks. | open |
