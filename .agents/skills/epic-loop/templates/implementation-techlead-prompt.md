[$epic-loop] Implementation loop: techlead turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as techlead only. Do not implement product code in this turn.

Take the techlead role from:

- `.agents/skills/epic-loop/references/implementation-techlead-role.md`

Read the engineer role before writing the next engineer brief:

- `.agents/skills/epic-loop/references/implementation-engineer-role.md`

Start from the compact implementation summary:

```bash
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "-<<*{{EpicSlug}}*>>-"
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
2. Check whether the active task status should change.
3. If relevant, check whether the active phase status should change with stricter phase-level review.
4. Use the provided scripts for mechanical state updates and logging instead of hand-editing technical runtime artifacts.
5. Keep momentum on safe local cleanup and ordinary non-dangerous blockers.
6. If implementation should continue, create exactly one new skill-agnostic engineer brief from scratch with:

```bash
node .agents/skills/epic-loop/scripts/write-engineer-brief.mjs --slug "-<<*{{EpicSlug}}*>>-" --stdin
```

7. Then hand off with:

```bash
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role engineer --prompt-file "-<<*{{EngineerPromptPath}}*>>-" --reason "<short reason>"
```

8. If the loop should stop or pause, run:

```bash
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role idle --reason "<why the implementation loop stops>"
```

Report briefly and stop:

- closure verdict
- task status change or no change
- phase status change or no change
- artifacts/scripts used
- next move and why
