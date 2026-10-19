# Sandbox run: review page builder and translator subagents on Codex (2026-10-20)

Run 14 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Q10: how does a Codex manager start a subagent, and can it put the translator on a cheaper model?
- [FEATURE] Does a Codex 0.162 manager session, following "Review Pages" in the manager role, produce a page that passes the check, plus a Russian translation, through two subagents, while keeping only their summaries?
- [SANDBOX] A minimal Codex run (D-14) under the default sandbox.

Layout:

- Sandbox (disposable): `<workspace>/sandbox-subagents-codex/`.
  - It uses the same fixture as run 13: the `demo` epic and two header SVGs in `evidence/`.
  - The skill is installed from this worktree's source (`cli.mjs install --platform codex`) with `[features] hooks = true`.
  - `EPIC_LOOP_CLI` is passed with `-c shell_environment_policy.set={…}`.
- Heavy artifacts: `<workspace>/sandbox-logs/2026-10-20-review-subagents-codex/artifacts/`
- Driver: `driver/run.sh`, `driver/prompt.txt` (the run 13 prompt with the Codex delegation line), and the fixture SVGs. Screenshots use run 13's `shots.mjs`.

## Journal

### 0. Research, with no model calls

The answers come from a run 11 rollout's developer message, `codex debug models --bundled`, `codex features list`, and the binary's strings.

- [FEATURE] **The tools.** A Codex session is `/root` in a team of agents. Its collaboration tools are `spawn_agent`, `wait_agent`, `followup_task`, `send_message`, `interrupt_agent` and `list_agents`.
  - `spawn_agent` takes `task_name`, the task `message`, `fork_turns` (`"none"` for a fresh agent), and optionally `model` and `reasoning_effort`.
  - Rules: setting `model` or `reasoning_effort` requires `fork_turns: "none"`. A model may be set only when the user, `AGENTS.md`, or **skill instructions** ask for it.
  - A session-level `<multi_agent_mode>` note forbids spawning unless the user or a skill asks for it. The skill's "Review Pages" section asks.
- [FEATURE] **The models.** `codex debug models --bundled` lists `gpt-6-luna` as "Fast and affordable model for easier tasks", the cheap tier. The default model here is `gpt-5.6-sol`.
- [FEATURE] **The feature flag.** `multi_agent` is stable and on by default, including with `--ignore-user-config`. No project or global config is needed.
- [SANDBOX] Expected size, stated before launch: about 0.9 M tokens (manager about 0.3 M, builder about 0.4 M, translator about 0.15 M), under the 1.5 M budget.

### 1. Session

The session was `codex exec --ignore-user-config -m gpt-5.6-sol -c model_reasoning_effort=low -s workspace-write -c approval_policy=never` with inline trust, a 15-minute timeout, and no `danger-full-access`.

- [FEATURE] PASS: per-call delegation, from the main rollout.
  - Builder: `spawn_agent {"task_name":"review_page_builder","fork_turns":"none","message":<brief>}`, then `wait_agent`.
  - Translator: `spawn_agent {"task_name":"review_page_translator","fork_turns":"none","model":"gpt-6-luna","reasoning_effort":"low","message":<brief>}`, then `wait_agent`.
- [FEATURE] PASS: models.
  - The child rollouts carry `session_meta.source.subagent.thread_spawn` with the parent thread id and `agent_path` (`/root/review_page_builder`, `/root/review_page_translator`).
  - Their `turn_context` records the builder on `gpt-5.6-sol/low` (inherited) and the translator on **`gpt-6-luna/low`**.
- [FEATURE] PASS: what the main thread saw.
  - The tool outputs of `spawn_agent` and `wait_agent` were 41–47 characters each (the task path and "Wait completed").
  - The subagents' final answers arrived as collaboration messages.
  - The main thread read the skill, the "Review Pages" section and the templates, and no page HTML or translation.
  - Its final message was the two summaries:
    - `Review 2026-10-20-header-layout: Choose the site header layout / URL: server not running: run epic-loop serve --detach / Asks: Choose compact or stacked mobile header layout, with an optional comment. / Why: The layout must be decided before the landing page is built. / Controls: 2 (1 required); languages: en, ru / Check: passed (W_TRANSLATION_MISSING: 16 Russian segments)`
    - `Translated 16 segments into ru; check passed.`
- [FEATURE] PASS: the page and the check.
  - The builder used the run 13 skeleton fix (a full document with `<main class="el-main">` and a page head) and an `el-compare` at 375 px, with both SVGs copied into `assets/`.
  - It has a choice with consequences in each `note`, `recommended="compact"` with a short rule, and an optional comment.
  - `review check … --lang ru --json` returned `ok: true` with 16 segments, 0 missing and 0 stale. The `rule` segment, added in run 13, is translated.
  - The served page in Russian is `artifacts/page-ru.png`: h1 "Выберите компоновку шапки сайта", and the rule reads "mobile first: без лишней высоты в первом экране". English is `artifacts/page-en.png`.
- [FEATURE] **FINDING: the server cannot start inside Codex's sandbox.** The manager tried `epic-loop serve --detach` inside its sandbox and got `listen EPERM: operation not permitted 127.0.0.1`. `workspace-write` blocks a command from listening on a port.
  - The manager role now says to give the human the `serve` command on Codex instead.
  - R5 is updated.
  - For Phase 4: on Codex the server must be started outside the sandbox, from a hook or by the human.
- [SANDBOX] Size: 100 s and **761,056 tokens** in total, mostly cached input:
  - manager 374,710 (351,872 cached);
  - builder 259,503;
  - translator 127,843.
- [FEATURE] Q4: the subagents ran under the same sandbox policy, and `node …/epic-loop.mjs review check` worked inside it (the builder's and translator's checks passed).

### 2. Archive and cleanup

- [SANDBOX] Archived to `artifacts/`:
  - a git bundle of the sandbox after the session, restore-tested;
  - the `.epic-loop/` tree;
  - the three rollouts in `08-rollouts/`;
  - the exec event stream, the check output and the screenshots.
- [SANDBOX] Removed the sandbox. No server or Chrome processes remain. `~/.codex/config.toml` has no sandbox entries. The rollouts stay in `~/.codex/sessions/2026/10/20/` as history.

## Summary

- [FEATURE] **Q10 is answered.**
  - Codex delegates with `spawn_agent` (`fork_turns: "none"`) plus `wait_agent`.
  - The model is chosen per call when skill instructions ask for it: the translator ran on `gpt-6-luna` at low effort.
  - The main thread kept only the summaries, and the page passed the strict check and renders in Russian.
  - **Finding:** Codex's sandbox prevents starting the review server from a command.
- [SANDBOX] A minimal Codex run answered the question with 0.76 M tokens and no workaround. The exec `--json` stream shows only `wait` collaboration items; the evidence of spawns and models is in the rollouts (`function_call` `spawn_agent`, the child `session_meta` and `turn_context`).
