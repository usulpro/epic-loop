[$epic-loop] Implementation loop: manager ingest turn -<<*{{Iteration}}*>>- for `-<<*{{EpicSlug}}*>>-`.

Act as manager only. Do not implement product code and do not plan in this turn.

The human answered a review page or wrote to the epic inbox. Record that input into the epic artifacts (D23: the manager records, the techlead plans). Take the manager role from:

- `-<<*{{SkillDir}}*>>-/references/implementation-manager-role.md` (section "Ingest")

## Input To Ingest

-<<*{{IngestItems}}*>>-

## What To Do

1. Read each answers file and the page it belongs to, so every answer is read against its question.
2. Record the human's decisions in `.epic-loop/epics/-<<*{{EpicSlug}}*>>-/decision-log.md` (a human decision, with the review id as its source).
3. Resolve each answered human-queue item:
   `-<<*{{HumanQueueResolve}}*>>-`
4. Confirm or reverse each agent-made decision the human answered (`--reversed` reverses it):
   `-<<*{{AgentDecision}}*>>-`
5. Record each inbox request where it belongs (a decision, a constraint, or a note in `state-of-epic.md`), quoting it.
6. Close each gate whose questions are all answered:
   `-<<*{{GateClose}}*>>-`
7. Do not add tasks, reorder, set task statuses or write briefs: that is the techlead's job after this turn.

## Hold Kinds

- `security-hold`: resolve only when the page has an explicit confirmation control answered true. Pass the confirming answer: `human-queue.mjs resolve ... --confirmation "<the answer, quoted>"`. A plain submit does not resolve it.
- `human-action`: resolve on its "done" control. The techlead verifies the effect before relying on it.
- `external-wait`: never resolve it here; the techlead rechecks the condition.
- `checkpoint`, `costly-decision`, `product-decision`: resolve from the answers.
- An unanswered or unclear item stays open; say so in the report.

## Report

End with a short "what changed" report for the techlead, and stop:

- decisions recorded (ids)
- human-queue items resolved, and any left open with the reason
- agent-made decisions confirmed or reversed
- inbox requests and where they were recorded
- gates closed or still open

Routing returns to the techlead automatically; the loop marks this input ingested when the turn ends.
