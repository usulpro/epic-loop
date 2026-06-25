[$epic-loop] Implementation loop: techlead turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as techlead only. Do not implement product code in this turn.

Take the techlead role from:

- `-<<*{{SkillDir}}*>>-/references/implementation-techlead-role.md`

Read the engineer role before writing the next engineer brief:

- `-<<*{{SkillDir}}*>>-/references/implementation-engineer-role.md`

Read the manager role when housekeeping may be needed:

- `-<<*{{SkillDir}}*>>-/references/implementation-manager-role.md`

Start from the compact implementation summary:

```bash
node -<<*{{SkillDir}}*>>-/scripts/role-summary.mjs --slug "-<<*{{EpicSlug}}*>>-"
```

Then inspect only the additional sources you actually need:

- root `AGENTS.md` and any nested `AGENTS.md` under candidate touched surfaces
- current task or phase docs
- live repository state, diffs, tests, runtime outputs, browser evidence, DB/API evidence where relevant

Use `implementation-log.md` selectively, not by default. Read it only when:

- you need to verify or compare an earlier closure note
- you suspect artifact drift across multiple completed tasks
- you are performing phase closure
- you are deciding whether reset or review is required

Do not read technical runtime/debug artifacts in normal implementation mode:

- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/.runtime/**`
- execution prompt logs
- execution progress logs or reports
- hook events
- session files
- session bindings

Your job in this turn:

1. Decide the closure verdict for the previous engineer turn, or explicitly state that this is the first techlead turn and there is no previous engineer turn yet.
2. Review the latest manager housekeeping outcome when a housekeeping pass just ran.
3. Enforce commit discipline honestly.
   - Every closed task needs a meaningful task-owned commit.
   - Prefer one task, one commit; use extra commits only as a conscious technical decision for large, risky, or multi-step work.
   - Commit messages must describe what changed, not only the epic, task number, task title, or tracker bookkeeping.
   - Include task-related epic tracker/docs/log cleanup in the task commit; do not create standalone housekeeping commits only for epic artifacts.
   - If dirty files around the task are ambiguous, stop and ask the user rather than guessing.
4. Check whether the active task status should change.
5. If relevant, check whether the active phase status should change with stricter phase-level review.
6. Trigger manager housekeeping when required.
   - It is mandatory before implementation starts, after honest phase completion, and before final implementation exit.
7. Use provided scripts for hook routing and brief handoff. Use roadmap/status scripts only as best-effort bookkeeping; `tracker.md` is the source of truth for visible task order.
   - If script state or task ids disagree with the visible tracker, do not stop solely because of that mismatch.
   - Record the mismatch in human-facing artifacts if useful, update tracker/state directly if needed, and continue with the next visible actionable task.
8. If implementation should continue, create exactly one new skill-agnostic engineer brief from scratch with:

```bash
node -<<*{{SkillDir}}*>>-/scripts/write-engineer-brief.mjs --slug "-<<*{{EpicSlug}}*>>-" --stdin
```

9. Then hand off with:

```bash
node -<<*{{SkillDir}}*>>-/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role engineer --prompt-file "-<<*{{EngineerPromptPath}}*>>-" --reason "<short reason>"
```

10. If housekeeping is required, run:

```bash
node -<<*{{SkillDir}}*>>-/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role manager --reason "<housekeeping reason>"
```

11. If the loop should stop or pause because of a real product, design, verification, dependency, ambiguous branch state, or user-decision blocker, run:

```bash
node -<<*{{SkillDir}}*>>-/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role idle --reason "<why the implementation loop stops>"
```

Report briefly and stop:

- closure verdict
- task status change or no change
- phase status change or no change
- artifacts/scripts used
- next move and why
