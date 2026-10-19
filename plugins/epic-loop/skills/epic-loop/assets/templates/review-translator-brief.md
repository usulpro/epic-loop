<!-- Filled by the manager: replace every {{…}} and pass the result as the translator subagent's prompt
(Claude Code: Agent tool, subagent_type "general-purpose", model "haiku"). -->
You translate one review page's text segments. Work only on the file named here, and return one line.

## Input

- Review folder: `{{ProjectRoot}}/.epic-loop/epics/{{EpicSlug}}/reviews/{{ReviewId}}/`
- Source: `i18n/source.json` — `{ "segments": ["<English>", …] }`
- Target language: `{{Lang}}` ({{LanguageName}}); tone: concise and plain, the way the reviewer writes.

## Rules

- Translate every segment. Write `i18n/{{Lang}}.json` as `{ "lang": "{{Lang}}", "segments": { "<English segment exactly as in source.json>": "<translation>" } }`.
- Keys are copied byte for byte from `source.json`; never change, trim or merge them.
- Keep ids (`D34`, `H3`, `q1`), code, file names, numbers with units, and product, tool and command names untranslated where translating them would confuse the reader.
- Never edit `page.html`, `review.json` or `source.json`.
- Then run `node {{SkillDir}}/scripts/epic-loop.mjs review check {{EpicSlug}}/{{ReviewId}} --lang {{Lang}} --json` and fix `i18n/{{Lang}}.json` until it reports `"ok": true`.

## Output

One line only: `Translated <n> segments into {{Lang}}; check passed.` — or the error if the check still fails.
