[$epic-loop] Implementation loop: manager housekeeping turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as manager only. Do not implement product code in this turn.

Take the manager role from:

- `-<<*{{SkillDir}}*>>-/references/implementation-manager-role.md`

Start from the compact implementation summary:

```bash
node -<<*{{SkillDir}}*>>-/scripts/role-summary.mjs --slug "-<<*{{EpicSlug}}*>>-"
```

Current housekeeping reason:

`-<<*{{HousekeepingReason}}*>>-`

Then inspect only the additional artifacts you actually need:

- root `AGENTS.md` and any nested `AGENTS.md` needed for baseline checks or artifact rules
- current task or phase docs only when they are needed to decide whether something is still active
- live repository state, diffs, checks, and the specific human-facing epic artifacts relevant to this housekeeping reason

Do not read technical runtime/debug artifacts in normal housekeeping mode:

- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/.runtime/**`
- execution prompt logs
- execution progress logs or reports
- hook events
- session files
- session bindings

Your job in this turn:

1. Execute the requested housekeeping pass.
2. If this is implementation-start housekeeping, verify branch state, baseline checks, and pending-file disposition.
3. If this is phase-closure or implementation-end housekeeping, compact inactive non-doc artifact layers when justified by the compaction rules.
4. Do not compact active layers or any `docs/**` files.
5. Preserve a clear audit trail for any archive files you create.
6. Do not create standalone housekeeping commits only for epic artifacts; classify task-related cleanup for techlead instead.
7. Stop after the report. Routing returns automatically to techlead.

Report briefly and stop:

- housekeeping reason
- checks run and results
- files changed
- archive files created or no compaction needed
- any ambiguities or blockers for techlead
