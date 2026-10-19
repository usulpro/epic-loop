# Human Queue

What the implementation loop needs from the human without stopping for it. Written by `scripts/human-queue.mjs`; ids `H<n>` are stable and never reused.

## Open

- **H3**
  - Kind: human-action
  - Ask: Approve one Codex sandbox run of the doorbell end-to-end loop check with -s danger-full-access -a never (sandbox-test D-7), and confirm Codex quota for about 2-4 M tokens
  - Why: epic-loop loop commits fail under Codex workspace-write; writable_roots does not lift the .git protection (run 11)
  - Default: none
  - Blocks: the Codex end-to-end doorbell check (queued message during a running loop) and the Codex mechanism choice in Phase 2
  - Raised: 2026-10-19

## Resolved

- **H1**
  - Kind: human-action
  - Ask: Approve the Codex sandbox run of the Phase 1 stop-gate verification with -s danger-full-access -a never (sandbox-test D-7), and confirm Codex quota is available
  - Why: Codex keeps .git read-only under workspace-write, so loop commits fail; D-7 requires explicit approval per run
  - Default: none
  - Blocks: the Codex half of 'Prove the stop gate end to end in sandbox runs on Claude Code and Codex'
  - Raised: 2026-10-18
  - Resolved: 2026-10-18
  - Resolution: Approved by Oleg on 2026-10-18: run the Codex sandbox scenario with -s danger-full-access -a never (sandbox-test D-7). Codex quota is available and the account is logged in.
- **H2**
  - Kind: external-wait
  - Ask: Nothing to do: the Codex usage limit resets around 2026-10-19 01:35 local time; then the Codex sandbox run (run 7 driver, unchanged) is repeated
  - Why: Run 7 stopped on the Codex usage limit after 17 turns (11.3 M tokens); checks 2-4 on Codex were not reached
  - Default: rerun after the reset
  - Blocks: the Codex half of 'Prove the stop gate end to end in sandbox runs on Claude Code and Codex', then the Phase 1 pull request
  - Raised: 2026-10-18
  - Resolved: 2026-10-18
  - Resolution: Oleg reset the Codex limit on 2026-10-18; minimal Codex run 8 passed (D33).
