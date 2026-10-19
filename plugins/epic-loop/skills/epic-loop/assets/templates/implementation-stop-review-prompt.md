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

## Stop Report Page

When the human owes the loop something (open human-queue items or unconfirmed agent-made decisions), the report also becomes a review page the human answers; the loop then waits for it instead of going idle, and resumes on its own after the submit (D25). A stop with nothing to answer (for example a class A "phase done") keeps the plain flow: skip this section.

Before `review-stop.mjs`:

1. Have the page builder build a `stop-report` page and, with a second language, translate it, as "Review Pages" in `-<<*{{SkillDir}}*>>-/references/implementation-manager-role.md` says. Put in the brief:
   - a short "where the epic stands" against the epic intent, and why the loop stopped;
   - one card per open H item, with a control named `h<n>` that fits its kind: `human-action` a "done" check, `security-hold` an explicit confirmation check, decisions a choice;
   - one card per unconfirmed agent-made decision, a confirm/reverse choice named `d<n>`;
   - the check `<el-check name="continue-after-submit">Continue the loop after I submit</el-check>`; unanswered counts as on.
2. Register it: `node -<<*{{SkillDir}}*>>-/scripts/gate.mjs open --slug "-<<*{{EpicSlug}}*>>-" --stop-report --review <review-id> --covers <every open H id>`. It refuses a page that misses an open H item, an unconfirmed decision or the switch.
3. Add a line with the page path (`/<slug>/reviews/<review-id>/`) under "What You Need To Do Or Decide" in the English report, then accept with `review-stop.mjs` as above. The loop waits in `awaiting-review`.

Then commit the saved report together with this review's `human-queue.md` and `decision-log.md` changes, in one commit, with the exact `git add …` / `git commit -m "docs(epic): stop report NN (class X)"` command that `review-stop.mjs` prints. Add only those files, never `git add -A`. This is the one commit a manager makes.

Do not use `set-next-role.mjs` in this turn. Run `review-stop.mjs` as your last command, then stop after your final message:

- accepted with a stop report page: one or two lines on why the loop stopped, then the page link (on the running server: `epic-loop serve --status`), in the user's language; the long report lives on the page and in `stop-reports/`;
- accepted without a page: your final chat message is the same report in the user's language (the language the user writes in this session);
- challenged: one or two lines on why the stop was challenged and what the techlead should do.
