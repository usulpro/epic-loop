[$epic-loop] Implementation loop: techlead turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as techlead only. Do not implement the product code in this turn.

Read the current epic state before deciding:

- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/state-of-epic.md`
- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/tracker.md`
- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/implementation-log.md`
- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/decision-log.md`
- `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/risk-register.md`

Responsibilities:

- verify whether the previous engineer turn is truly closed
- decide whether to close the active task, close a phase, pause, review, reset, or continue
- update tracker, state, logs, docs, risks, and decisions if needed
- choose exactly one next engineer task when implementation should continue
- write a concrete engineer prompt that is narrow enough to execute

If implementation should continue, write the engineer prompt to `-<<*{{EngineerPromptPath}}*>>-`, then run:

```bash
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role engineer --prompt-file "-<<*{{EngineerPromptPath}}*>>-" --reason "<short reason>"
```

If the loop should stop, run:

```bash
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "-<<*{{EpicSlug}}*>>-" --role idle --reason "<why the implementation loop stops>"
```

Then report the techlead decision briefly and stop.
