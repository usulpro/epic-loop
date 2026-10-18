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

Apply the stop-review rules in the manager role reference, then resolve the request with exactly one command:

```bash
# accept: the loop goes idle; your final message is the stop report
node -<<*{{SkillDir}}*>>-/scripts/review-stop.mjs --slug "-<<*{{EpicSlug}}*>>-" --outcome accepted

# challenge: the techlead resumes with your instruction in its prompt
node -<<*{{SkillDir}}*>>-/scripts/review-stop.mjs --slug "-<<*{{EpicSlug}}*>>-" --outcome challenged --instruction "<concrete instruction for the techlead>"
```

Do not use `set-next-role.mjs` in this turn. Run `review-stop.mjs` as your last command, then stop after your final message:

- accepted: the stop report for the human;
- challenged: one or two lines on why the stop was challenged and what the techlead should do.
