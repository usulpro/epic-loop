# Epic Intent — Claude Code Harness

## Goal

Reproduce the exact same loop and the exact same operating modes as the current
Codex harness, changing only the technical implementation so it runs on Claude
Code. Behavior, lifecycle, roles, and artifacts stay identical; only the
platform binding differs.

## Non-goals

Not a redesign, not new features, not a behavioral change. The loop logic, role
rotation (manager → techlead → engineer), per-task briefs, and on-disk state
model are preserved as-is.

## Guiding principle: maximally DRY

Reuse the existing scripts and libraries as the single source of truth. The
platform-neutral core — the loop, continuation, role rotation, brief generation,
and durable `.epic-loop/` state — must be shared, not duplicated. Claude Code
support should be added as a thin platform adapter over that shared core, not as
a fork or a parallel copy of the engine.

The only code that may diverge is the small set of platform-specific surfaces
(report capture, hook-config installer, doctor preconditions, session fallback).
Everything else is common. Codex remains the primary target; the Claude Code
version is additive.

See `claude-api.md` in this folder for the reference inputs.
