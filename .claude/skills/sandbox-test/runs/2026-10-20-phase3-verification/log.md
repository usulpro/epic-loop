# Sandbox run: Phase 3 verification of the review engine on Claude Code and Codex (2026-10-20)

Run 15 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Does a manager session on each host build three representative review pages through three page builder subagents and three translator subagents on the cheap model, while keeping only their summaries?
- [FEATURE] Do those pages pass `review check --lang ru`? Are they served by `epic-loop serve`? Can a person answer them in a real browser? This covers both languages, the lightbox, compare modes, submit, the problem form, and a reload. Do the answers land on disk?
- [FEATURE] How do the pages hold up against the content rules in `references/review-pages.md`?
- [SANDBOX] A schema-driven browser verifier that runs outside the agent sessions.

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-phase3-claude/` and `<workspace>/sandbox-phase3-codex/`.
  - Both use the same fixture (`driver/fixture/`): a `demo` epic stopped on class B, with `state-of-epic.md`, `human-queue.md` (H1 human-action, H2 product decision) and `decision-log.md` (D2 human rule, D7 agent-made).
  - The evidence files in `evidence/`: three pricing layout SVGs, the live prototype `pricing-toggle.html`, and two footer renders.
  - The skill is installed from this worktree's source (`cli.mjs install`), and `EPIC_LOOP_CLI` points at the local CLI.
- Heavy artifacts: `<workspace>/sandbox-logs/2026-10-20-phase3-verification/{claude,codex}/`:
  - `artifacts/`: the session stream, transcripts or rollouts, the `.epic-loop/` tree, and the git bundle;
  - `verify/`: per page `check-ru.json`, `en.png`, `ru.png`, `lightbox.png` or `compare-*.png`, `answers.json`, `problem.jsonl`, plus `summary.json`.
- Driver:
  - `driver/run.sh claude|codex`: fixture, install and one manager session.
  - `driver/prompt-{claude,codex}.txt`: the same three requests, with the host's delegation line.
  - `driver/verify.mjs <sandbox> <out>`: the browser verifier. It is built on the new shared `packages/cli/scripts/cdp.mjs`, whose helpers were extracted from `browser-check.mjs`.

The verifier (`verify.mjs`):

- For each page it runs `review check demo/<id> --lang ru --json`, starts `serve --detach`, and reads the schema from `review.json`.
- It answers every control: the first non-recommended option for choices, a checked box for checks, the first option for selects, and a text for comments.
- It opens the lightbox when the page has grouped shots, and steps through the compare modes and width presets when the page has a compare.
- It takes a full-page screenshot in English and in Russian, then submits.
- It sends the injected problem form with a text, reloads, and checks that the values and the submitted state come back.
- It asserts `answers.json` (every control at the expected value, and `submittedAt`), `problems.jsonl`, no external request, and no page error. Then it stops the server.

## Journal

### 1. Claude Code

- [SANDBOX] Attempt 1 failed because Bash was denied to all three builders (`claude/attempt1-bash-denied/`, about $0.49).
  - The allowlist had prefix rules (`Bash(node:*)`, `Bash(cp:*)`, …).
  - The builders wrote compound commands (`cd …; D=…; mkdir -p … && cp …`). They do not see the prompt's one-command rule, which only the manager receives.
  - One builder then wrote an unchecked page with the Write tool.
  - The manager stopped correctly: it did not write pages itself, did not start the translators without `i18n/source.json`, and reported the gap.
  - DECISION: rerun with `Bash` allowed in full. The sandbox is disposable and nothing is committed.
- [FEATURE] PASS: delegation, from the stream and the transcript.
  - The main thread made six Agent calls, all `general-purpose`:
    - the three builders on the default model (briefs of 2,843, 2,540 and 1,801 characters), launched together as background agents;
    - then the three translators with `model: "haiku"` (about 1,240 characters each), started after all builders had finished.
  - `subagents/*.meta.json` confirms it: the builders ran on `claude-sonnet-5-5` and the translators on `claude-haiku-5-5`, with `requestShape: background`.
  - The main thread's tool results were the skill reference, the two templates, the three epic files, three `find`s and the "async agent launched" acknowledgements. It saw no page HTML and no translation.
  - The final message was the six summaries (three gate summaries and three "Translated N segments into ru; check passed.").
- [SANDBOX] Cost and time:
  - 80 s of wall time;
  - $0.51 for the rerun (Sonnet $0.50 for the main thread plus builders, Haiku $0.013 for the translators), about $1.00 with attempt 1.
  - Well under the $4 budget.

### 2. Codex

- [SANDBOX] Expected size, stated before launch: about 1.8 M tokens (manager about 0.6 M, three builders about 0.26 M each, three translators about 0.13 M each), under the 2 M budget.
  - The prompt asked for one subagent at a time (the parallel-stall entry in LEARNINGS).
  - `codex exec --ignore-user-config`, `gpt-5.6-sol` at low effort, `workspace-write`, 30-minute timeout, no `danger-full-access`.
- [FEATURE] PASS: delegation, from the rollouts in `artifacts/08-rollouts/`.
  - The main rollout has six `spawn_agent` calls, each followed by `wait_agent`:
    - the builders with `fork_turns: "none"` and no model (briefs of 4,600, 3,980 and 3,300 characters);
    - the translators with `fork_turns: "none"`, `model: "gpt-6-luna"` and `reasoning_effort: "low"` (1,828 characters each).
  - The child rollouts' `turn_context` shows the builders on `gpt-5.6-sol/low` and the translators on `gpt-6-luna/low`.
  - The main thread's `spawn_agent` and `wait_agent` outputs were at most 47 characters. It read the skill, the templates and the epic files, and no page HTML.
  - The final message was the six summaries.
- [SANDBOX] Size and time: 4 min and **1,631,799 tokens** in total, mostly cached input. One session, no stall, no retry.
  - manager 707,269 (675,200 cached);
  - builders 238,535, 200,239 and 216,468;
  - translators 105,453, 94,841 and 68,994.
- [SANDBOX] OBSERVATION: the manager's progress messages were in Russian and addressed the user by name. `--ignore-user-config` does not skip the global `~/.codex/AGENTS.md`, which the main rollout carries as user instructions. The pages stayed English-only.

### 3. Browser verification (both platforms)

`verify.mjs` returned "all passed" on both sandboxes, with no page errors and no request leaving 127.0.0.1.

Claude Code:

| Page | Check (`--lang ru`) | Controls answered | `submittedAt` | Problem | Reload | Screenshots |
| --- | --- | --- | --- | --- | --- | --- |
| stop-report | ok, 38 segments, 0 missing, 0 stale, 0 warnings | 4/4 (3 required) | 2026-10-19T19:21:17Z | in `problems.jsonl` | restored, submitted | en, ru |
| pricing-layout | ok, 20 segments, 0/0/0 | 2/2 (1 required) | 2026-10-19T19:21:21Z | in `problems.jsonl` | restored, submitted | en, ru, lightbox (1 / 3) |
| footer-result | ok, 14 segments, 0/0/0 | 2/2 (1 required) | 2026-10-19T19:21:27Z | in `problems.jsonl` | restored, submitted | en, ru, compare overlay and flip |

Codex:

| Page | Check (`--lang ru`) | Controls answered | `submittedAt` | Problem | Reload | Screenshots |
| --- | --- | --- | --- | --- | --- | --- |
| stop-report | ok, 57 segments, 0 missing, 0 stale, 0 warnings | 3/3 | 2026-10-19T19:26:31Z | in `problems.jsonl` | restored, submitted | en, ru |
| pricing-layout | ok, 36 segments, 0/0/0 | 1/1 | 2026-10-19T19:26:36Z | in `problems.jsonl` | restored, submitted | en, ru, lightbox (1 / 3) |
| footer-result | ok, 15 segments, 0/0/0 | 2/2 (1 required) | 2026-10-19T19:26:41Z | in `problems.jsonl` | restored, submitted | en, ru, compare overlay and flip |

- [FEATURE] The live `el-iframe` of `assets/pricing-toggle.html` was served with `sandbox="allow-scripts"` on both pricing pages and rendered the prototype.
- [FEATURE] Compare: overlay, flip and side all applied, and the width presets 375 and 1280 constrained the panes.
- [FEATURE] The language switch translated every page text, and the verifier found no English text left in `main`. The runtime's own UI text ("Optional.", "answered", "Submit answers") stays in English, which is the known limit from slice A.
- [SANDBOX] FINDING (driver): `Page.captureScreenshot` with `captureBeyondViewport` painted the fixed submit bar mid-page and left the sandboxed (out-of-process) iframe blank below the fold.
  - `verify.mjs` now sets a viewport as tall as the page for each screenshot.
  - It is not a product defect: the live page renders correctly at any scroll position.

### 4. Content critique

Against the rules in `review-pages.md`.

- [FEATURE] **One decision per card:** kept on both hosts. Each H item and D7 got its own card, and the pricing and footer pages have one decision each.
- [FEATURE] **Consequences on the options:** every option on both hosts has a `note` with its consequence. Codex also repeated the consequences in a table on every card, which is accurate but doubles the reading.
- [FEATURE] **Evidence on the card:**
  - Claude Code put the pricing shots and the live prototype inside the decision card. On the footer page, though, it put the compare in one card and the confirmation in a second card, so the evidence is not on the decision's card.
  - Codex kept the evidence on the card, but added lines like "Evidence: `.epic-loop/epics/demo/human-queue.md`" to four cards. That is a repo path the human cannot see on the page.
  - FIX (reference): the content rule now says never to cite a repo path as evidence.
- [FEATURE] **A recommendation with its rule:**
  - Both hosts recommended `usd-only` and `cards` by D2.
  - For D7, Claude Code wrote `rule="D7 already applied"`, which names the decision itself rather than a rule. Codex used D2.
  - FIX (reference): a new rule for agent-made decisions: options `confirm` and `reverse`, a `reverse` note with the cost of reversing, and a `rule` naming the rule the decision followed.
- [FEATURE] **`created`:**
  - Claude Code's pricing builder again invented a time (`2026-10-20T12:00:00Z`), as in run 13. The other two Claude pages and all Codex pages have real times.
  - FIX (reference): get it from `date -u +%Y-%m-%dT%H:%M:%SZ`.
- [FEATURE] OBSERVATION: `languages` is `["en", "ru"]` on the Claude pages and `["ru"]` on the Codex pages. The check and the runtime both drop `en`, so both work.
- [FEATURE] OBSERVATION: the Claude card titles repeat the card id ("[h1] H1: …").
- [FEATURE] OBSERVATION: the gpt-6-luna translations left a few English words ("epic", "hero", "footer") and use the informal imperative.
- [FEATURE] OBSERVATION: the compare pane labels ("before", "after") sit over the top-left corner of the image.

## Defects

- [FEATURE] No product defect. All checks, the server, the runtime and the answer store behaved as specified on both hosts.
- [FEATURE] Three reference gaps were fixed in `references/review-pages.md`: repo paths as evidence, the agent-made decision pattern, and the source of `created`.

## Archive and cleanup

- [SANDBOX] Archived per platform in `sandbox-logs/2026-10-20-phase3-verification/<platform>/artifacts/`:
  - a git bundle of the sandbox after the session and the verification, restore-tested;
  - the `.epic-loop/` tree;
  - the Claude transcript with `subagents/` (for attempt 1 as well), or the seven Codex rollouts;
  - the session stream.
- [SANDBOX] Removed both sandboxes and `~/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-phase3-claude`.
  - No server or Chrome process remains.
  - `~/.claude.json` and `~/.codex/config.toml` have no sandbox entries.
  - The Codex rollouts stay in `~/.codex/sessions/2026/10/20/` as history.

## Summary

- [FEATURE] **Phase 3 works end to end on both hosts.**
  - On each host, one manager session delegated three pages and three translations; the translators ran on Haiku and gpt-6-luna, and the main threads kept only summaries.
  - All six pages passed the strict Russian check, were served, and were answered in a real browser in both languages.
  - Submit, the problem report and a reload all worked, and the answers are on disk.
- [FEATURE] Content quality is good on both hosts. Three reference gaps were fixed.
- [SANDBOX] Cost and size:
  - Claude Code: about $1.00, including a failed first attempt from prefix-rule denials in subagents.
  - Codex: 1.63 M tokens in one session, with sequential subagents and no stall.
  - The schema-driven verifier is reusable for any review page.
