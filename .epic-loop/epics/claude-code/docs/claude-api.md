# Claude Code — Hooks Reference for the Epic Loop Harness

Reference inputs for reproducing the epic-loop harness on Claude Code. This is
background material only: no spec, no implementation plan. It records how Claude
Code's hook system behaves and how each fact maps to what the current Codex
harness already relies on, so the port can be built on solid ground.

Verified against the current engine in
`plugins/epic-loop/skills/epic-loop/scripts/` and the official Claude Code hooks
documentation (links at the end). Treat version-specific numbers as
"confirm on the targeted CLI version" — hook behavior has shifted between
releases.

---

## 1. The core contract already matches

The heart of the loop — `maybeBuildImplementationContinuation` in
`lib/loop.mjs` — returns exactly:

```json
{ "decision": "block", "reason": "<next prompt>" }
```

Claude Code's `Stop` hook uses the **same** contract to keep a session working:
returning `{"decision":"block","reason":"..."}` feeds `reason` back to the model
and continues the turn instead of ending it. (Equivalently, a hook may exit with
code `2` and write the continuation text to stderr.) This is the single most
important fact for the port: the mechanism that drives the whole loop is
identical on both platforms and does not need to be redesigned.

## 2. Events

Claude Code exposes the three lifecycle events the harness is built on:

- `SessionStart` — fires when a session starts/resumes.
- `UserPromptSubmit` — fires when the user submits a prompt (before the model
  sees it).
- `Stop` — fires when the main agent has finished responding; this is where the
  loop continuation is issued.

These are the same three names in `HOOK_EVENTS`
(`lib/common.mjs`: `["SessionStart", "UserPromptSubmit", "Stop"]`), so the event
wiring is a naming match, not a translation.

Claude Code additionally offers events with no Codex equivalent that are **not
required** by the harness but may be useful later: `PreToolUse`, `PostToolUse`,
`Notification`, `SubagentStop`, `PreCompact`, `SessionEnd`.

## 3. Hook input payload (stdin JSON)

Claude Code delivers the event payload as JSON on **stdin** — same delivery model
as the current `hook.mjs` (`fs.readFileSync(0, "utf8")`). Common fields present
across events:

| Field | Present on CC | Used by engine today | Notes |
|---|---|---|---|
| `hook_event_name` | yes | yes | event dispatch |
| `session_id` | yes | yes | binding key |
| `cwd` | yes | yes | resolves project root |
| `transcript_path` | yes | yes | path to conversation JSONL |
| `stop_hook_active` | yes (Stop) | yes | reentrancy guard, see §5 |
| `turn_id` | **no** | yes (best-effort, `?? null`) | Codex-only; engine already tolerates null |
| `model` | not guaranteed | yes (metadata only) | non-load-bearing |
| `last_assistant_message` | **no** | yes (report capture) | Codex-only; see §4 |

The engine reads all of these defensively (`payload.x ?? null`), so absent
fields degrade gracefully rather than crash — except report capture, which
depends on `last_assistant_message` (next section).

## 4. Report capture — the one real data-shape difference

`appendRoleReportIfPresent` (`lib/loop.mjs:629`) reads the role's report from:

```js
const message = typeof payload.last_assistant_message === "string" ? ... : "";
```

`last_assistant_message` is a **Codex-only** field. Claude Code does not put the
final assistant message in the Stop payload. Instead it provides
`transcript_path`: an absolute path to the session **transcript in JSONL**, one
JSON object per line, covering the full conversation. On Claude Code the
equivalent of "the last assistant message" is obtained by reading that file and
taking the last assistant entry.

Transcript characteristics to rely on:

- JSONL, append-only, one message/event object per line.
- Contains user + assistant turns and tool activity; the assistant text lives in
  the assistant-role entries.
- The engine already tracks `transcript_path` and its mtime (`lib/common.mjs`
  captures `updated_at_ms: getMtimeMs(payload.transcript_path)`), so the file
  location is already threaded through the payload plumbing.

This is the primary adapter surface: **Codex `last_assistant_message` →
Claude Code parse `transcript_path` JSONL, last assistant message.** Nothing else
in report capture changes.

## 5. Loop guard: `stop_hook_active`

`stop_hook_active` is a **per-turn reentrancy flag**, identical in meaning on both
platforms and already read by the engine (`lib/loop.mjs:243`,
`payload.stop_hook_active === true`):

- `false` on the first Stop after a response → the hook may block.
- `true` on any subsequent Stop within the same turn (i.e. after the hook has
  already blocked once) → the hook is expected to allow the stop (do not block
  again blindly).

It is a single-turn guard, not an epic-wide counter. The harness's durable
iteration control lives on disk in `.epic-loop/`, independent of this flag.

## 6. Consecutive-block cap and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`

Claude Code caps the number of **consecutive** `Stop`-hook blocks within a turn.

- Default cap: **8** consecutive blocks. On exceeding it, Claude Code overrides
  the hook, ends the session, and emits a warning.
- Override: environment variable **`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`** raises the
  cap; setting it to **`0`** disables the cap entirely.

This is the key operational lever for the port. The epic-loop harness already
governs its own iteration count via on-disk state, so this cap is purely a
platform safety rail that would otherwise cut the loop short at 8. Raising it
(e.g. a high value, or `0`) lets the existing loop run to the length the harness
itself decides.

Because the harness relies on this variable to function correctly, the
**doctor must verify `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`** is set to an acceptable
value before a run — this is the Claude Code analogue of the Codex doctor's
`[features] hooks = true` precondition check (§8). Confirm the exact variable
name and default on the targeted CLI version before hard-coding either.

## 7. Hook configuration (installer surface)

The Codex harness writes/repairs `.codex/hooks.json` with this shape
(`lib/hooks.mjs`, per-event entries built with `timeout: 30`, `type: "command"`):

```json
{ "hooks": { "<Event>": [ { "hooks": [ { "command": "...", "timeout": 30, "type": "command" } ] } ] } }
```

Claude Code configures hooks differently:

- Location: `.claude/settings.json` (project), `.claude/settings.local.json`
  (personal/untracked), or `~/.claude/settings.json` (user), plus enterprise
  managed settings. Plugins can also ship a bundled `hooks/hooks.json`.
- Shape: hooks are grouped by event, each with a **`matcher`** and a list of hook
  entries of `"type": "command"` with a `"command"` string (and optional
  `timeout`). For events without a tool target (`Stop`, `UserPromptSubmit`,
  `SessionStart`), the matcher is typically empty/`"*"`.
- Plugin-bundled hooks resolve their script path via the **`${CLAUDE_PLUGIN_ROOT}`**
  variable, which expands to the installed plugin directory — the CC equivalent
  of an absolute/relative command path in the Codex config.

Rough Claude Code shape (for orientation, not a spec):

```json
{
  "hooks": {
    "Stop": [
      { "matcher": "", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/.../hook.mjs\"" } ] }
    ]
  }
}
```

## 8. Trust / enablement model (doctor surface)

Codex requires an explicit feature flag the doctor checks:
`hooks = true` (or `codex_hooks = true`) under `[features]` in `.codex/config.toml`
(project or `$HOME/.codex/config.toml`) — see `inspectCodexHooksFeature` in
`lib/hooks.mjs`.

Claude Code has **no such feature flag**. Its enablement/trust model instead:

- Hooks are reviewed and trusted via the `/hooks` interface; configuration
  changes are captured and require review before taking effect (a security
  measure against malicious hook injection).
- There is no boolean to poll equivalent to `[features] hooks`. The doctor's
  Codex feature-flag check has **no direct CC analogue** and should be replaced,
  not ported — the meaningful CC precondition to verify is instead settings
  presence + `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (§6).

## 9. Other limits that can end a long run

Independent of the hook, a long loop can be affected by:

- **Context auto-compaction**: Claude Code compacts (summarizes) the transcript
  as it approaches the context window (~200k tokens). The harness's durability
  design — per-task briefs + durable on-disk state — is what survives this;
  compaction of raw context is expected during long epics, not a failure.
- **Session retention**: sessions persist on disk but are cleaned up after a
  retention window (default ~30 days, `cleanupPeriodDays` configurable).
- **External API limits**: Anthropic account/rate limits apply outside Claude
  Code itself; there is no internal usage cap in the CLI.

## 10. Session detection fallback

Codex has a session fallback the harness uses: it reads
`.codex/tmp/last-hook-capture.json` and scans `$HOME/.codex/sessions` for
`session_meta` records (`lib/common.mjs`, `lib/epics.mjs:199`). Claude Code stores
sessions under its own project history directory and exposes `session_id` +
`transcript_path` directly on every payload, so an equivalent fallback (if
needed at all) would key off `transcript_path` rather than a Codex-style session
directory scan.

---

## Adapter surfaces at a glance

Only these differ between platforms; the loop core, role rotation, briefs, and
disk state are platform-neutral:

1. **Report capture** — `last_assistant_message` → parse `transcript_path` JSONL.
2. **Hook config installer** — `.codex/hooks.json` → `.claude/settings.json` /
   bundled `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}`.
3. **Doctor preconditions** — Codex `[features] hooks=true` → verify CC settings
   presence + `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
4. **Session fallback** — `.codex/tmp` + `$HOME/.codex/sessions` scan →
   `transcript_path`-keyed (if needed).

---

## Documentation links (for professionals)

- Hooks reference (events, payloads, `decision`/`block`, exit codes):
  https://code.claude.com/docs/en/hooks
- Hooks guide (getting started, config in settings, matchers):
  https://code.claude.com/docs/en/hooks-guide
- Settings & precedence (`.claude/settings.json`, user vs project vs managed,
  `cleanupPeriodDays`): https://code.claude.com/docs/en/settings
- Plugins & `${CLAUDE_PLUGIN_ROOT}` / bundled `hooks/hooks.json`:
  https://code.claude.com/docs/en/plugins
- Slash commands incl. `/hooks` trust review:
  https://code.claude.com/docs/en/slash-commands

> Verify version-specific facts (the `8` default cap, the
> `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` name/semantics, exact payload fields) against
> the CLI version being targeted before relying on them in doctor/installer code.
