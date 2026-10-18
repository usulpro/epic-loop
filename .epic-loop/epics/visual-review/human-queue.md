# Human Queue

What the implementation loop needs from the human without stopping for it. Written by `scripts/human-queue.mjs`; ids `H<n>` are stable and never reused.

## Open

- **H1**
  - Kind: human-action
  - Ask: Approve the Codex sandbox run of the Phase 1 stop-gate verification with -s danger-full-access -a never (sandbox-test D-7), and confirm Codex quota is available
  - Why: Codex keeps .git read-only under workspace-write, so loop commits fail; D-7 requires explicit approval per run
  - Default: none
  - Blocks: the Codex half of 'Prove the stop gate end to end in sandbox runs on Claude Code and Codex'
  - Raised: 2026-10-18

## Resolved

- None.
