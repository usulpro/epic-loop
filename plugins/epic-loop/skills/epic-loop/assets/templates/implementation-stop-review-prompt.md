[$epic-loop] Implementation loop: manager stop review turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as manager only. Do not implement product code in this turn.

The techlead asked to stop the implementation loop. You decide whether the stop is accepted or challenged.

Take the manager role, section "Stop Review", from:

- `-<<*{{SkillDir}}*>>-/references/implementation-manager-role.md`

Stop request:

- Class: `-<<*{{StopClass}}*>>-`
- Reason: -<<*{{StopReason}}*>>-
- What it blocks: -<<*{{StopBlocks}}*>>-
- Round: -<<*{{StopRound}}*>>- (round 2 or later is a repeated request after a challenge)

Start from the compact implementation summary:

```bash
node -<<*{{SkillDir}}*>>-/scripts/role-summary.mjs --slug "-<<*{{EpicSlug}}*>>-"
```

Then read only the human-facing epic artifacts and repository state needed to judge the request. Do not read `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/.runtime/**`.

Rule for this request (full table: "Rules By Class" in the manager role reference):

-<<*{{StopClassRule}}*>>-

Independent work: read `tracker.md` and pick a not-done task that does not need the item, preferring the active phase, then later phases when the roadmap order allows.

The challenge instruction must be concrete: the task to continue with, any H id you created, and the command the techlead should run. You queue human items; the techlead records agent-made decisions, sets `on-hold` and reorders.

Then resolve the request with exactly one command:

```bash
# challenge: the techlead resumes with your instruction in its prompt
node -<<*{{SkillDir}}*>>-/scripts/review-stop.mjs --slug "-<<*{{EpicSlug}}*>>-" --outcome challenged --instruction "<concrete instruction for the techlead>"

# accept: the loop goes idle; the English stop report on stdin is required (see Stop Report)
node -<<*{{SkillDir}}*>>-/scripts/review-stop.mjs --slug "-<<*{{EpicSlug}}*>>-" --outcome accepted --stdin <<'EOF'
<the English stop report>
EOF
```

## Stop Report

When you accept, write a report for the human, measured against the epic's intent (`docs/problem-framing.md`, the phases in `tracker.md`), not against the code. Use exactly these headings:

```text
-<<*{{StopReportHeadings}}*>>-
```

- Where The Epic Stands: goals vs. state.
- Achieved Since The Last Report: outcomes, not files. Previous stop report: `-<<*{{PreviousStopReport}}*>>-` (if none, since the loop started).
- Why The Loop Stopped: one or two lines, with the stop class in plain words.
- What You Need To Do Or Decide: the open human-queue items with their defaults and what each blocks, or "Nothing."
- Agent-Made Decisions To Confirm: the unconfirmed agent-made decisions, each with how to confirm or reverse, or "None."
- Next And How To Resume: what happens next, and the resume command: `-<<*{{ResumeCommand}}*>>-`

Take the human-queue items and agent-made decisions from `role-summary.mjs`. The copy you pass on stdin is always English; `review-stop.mjs` saves it under `stop-reports/` and refuses a report that misses a heading.

Do not use `set-next-role.mjs` in this turn. Run `review-stop.mjs` as your last command, then stop after your final message:

- accepted: your final chat message is the same report in the user's language (the language the user writes in this session);
- challenged: one or two lines on why the stop was challenged and what the techlead should do.
