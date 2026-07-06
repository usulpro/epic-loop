# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| English-only enforcement is too broad and flags code tokens, names, URLs, generated files, or runtime logs. | Validation becomes noisy and developers bypass it. | Start with explicit include/ignore lists, structured allowlists, and line-level evidence in failures. | open |
| Adding Oxfmt formats too much in one task and obscures behavioral changes. | Review becomes harder and task commits lose focus. | Keep configuration/check integration separate from optional repository-wide formatting cleanup. | open |
| oxlint configuration or rule coverage does not match every existing ESM script/test pattern. | Validation blocks on tooling friction or misses a rule the project expects. | Keep the initial oxlint config focused, verify against all maintained source sets, and add repository-owned checks only for gaps that matter. | open |
