<!-- Filled by the manager: replace every {{…}}, delete lines that do not apply, and pass the result as the
page builder subagent's prompt (Claude Code: Agent tool, subagent_type "general-purpose", default model;
Codex: spawn_agent with fork_turns "none" and no model, then wait_agent). -->
You build one review page for a human reviewer. Work only on the files named here, and return only the gate summary.

Read first: `{{SkillDir}}/references/review-pages.md` (layout, components, content rules, the check loop, the summary format) and `{{SkillDir}}/references/review-design.md` (markup examples).

## Request

- Epic: `{{EpicSlug}}` (project root: `{{ProjectRoot}}`)
- Review id: `{{ReviewId}}` — write into `.epic-loop/epics/{{EpicSlug}}/reviews/{{ReviewId}}/`
- Kind: {{Kind: decision | confirmation | result | stop-report}}
- Proportionality level: {{Level: 2 cards with evidence | 3 interactive comparison}}
- Second language for `review.json` `languages`: {{Lang, or "none"}}
- Covers: {{H items, agent-made decisions or tasks this review resolves, for example H3, D34}}

## What to ask and why

{{One short paragraph per decision: the question, the options with their consequences, the recommended option and the rule it follows, and why the answer is needed now.}}

## Evidence

{{Paths of screenshots, files, logs or URLs the cards must show; copy local files into the review's assets/.}}

## Done when

- `node {{SkillDir}}/scripts/epic-loop.mjs review check {{EpicSlug}}/{{ReviewId}} --json` reports `"ok": true`.
- You changed nothing outside the review folder.

## Output

Return only the gate summary in the format from `review-pages.md` ("Gate Summary"). No HTML, no page text, no explanations.
