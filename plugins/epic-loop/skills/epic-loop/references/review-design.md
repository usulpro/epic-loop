# Review Page Design

The design language for the epic-loop app and the review pages that agents write. Styles live in the npm CLI under `src/review/runtime/` (`tokens.css`, `base.css`); `specimen.html` there shows every token and component in both themes. The full component catalog for page builders comes with the page runtime.

## Principles

- **Calm and dense.** Information first, no decoration. A page is read once, decided, and closed.
- **Ink on paper, phosphor on slate.** Warm neutrals; one green accent for action, selection and focus; amber only for the recommended option; red only for errors.
- **Crisp rules, not shadows.** 1px borders and small radii (2–4px). No gradients, no glass, no glow, no emoji.
- **Monospace for machine things.** Ids, keys, timestamps, counts, labels and status lines use `--font-mono`; prose uses `--font-sans`.
- **Never colour alone.** Recommended options carry a tag; errors carry a message; selected state changes the border and the fill.
- **Themes follow the OS.** Dark and light come from `prefers-color-scheme`; `<html data-theme="light|dark">` overrides. Contrast is WCAG AA in both and checked by a test.

## Tokens

Use tokens, never raw values.

| Group | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--color-bg`, `--color-surface`, `--color-raised`, `--color-sunken` | page, cards, controls and panels, insets and table headers |
| Rules | `--color-rule`, `--color-rule-strong` | dividers and card borders; control borders (3:1) |
| Text | `--color-text`, `--color-text-muted`, `--color-text-faint` | body; secondary; metadata only |
| Action | `--color-accent`, `--color-accent-fg`, `--color-accent-tint`, `--color-focus` | primary button, links, selection, focus ring |
| Meaning | `--color-recommended(-tint)`, `--color-danger(-tint)`, `--color-info` | recommended option; errors; neutral notices |
| Overlay | `--color-scrim`, `--color-on-scrim` | lightbox backdrop and text on it |
| Type | `--font-sans`, `--font-mono`, `--fs-xs` … `--fs-2xl`, `--lh-*`, `--fw-*` | 12, 13, 15 (body), 18, 22, 28 px |
| Space | `--space-1` … `--space-9` | 2, 4, 8, 12, 16, 24, 32, 48, 64 px |
| Shape | `--radius-1`, `--radius-2`, `--rule-width`, `--focus-width` | controls, cards, borders, focus |
| Motion | `--dur-fast`, `--dur-base`, `--dur-slow`, `--ease-standard` | 80 / 140 / 220 ms; zero under reduced motion |

## Components

| Class | What it is |
| --- | --- |
| `el-shell`, `el-header`, `el-brand`, `el-nav`, `el-main` | app shell: header with breadcrumb, main column |
| `el-section`, `el-section__head` | a titled group with a rule under the heading |
| `el-card`, `el-card__head`, `el-card__foot` | one decision per card |
| `el-choice-group`, `el-choice`, `el-choice--recommended` | radio options as rows; recommended gets `el-tag--recommended` |
| `el-check` | checkbox row |
| `el-field`, `el-field__label`, `el-field__hint`, `el-field__error` | label, control, hint, error message |
| `el-select`, `el-input`, `el-comment` | select, text input, comment textarea |
| `el-btn`, `--primary`, `--ghost`, `--danger` | buttons; one primary per view |
| `el-submitbar`, `el-progress` (`--value: 0..1`), `el-save[data-state]` | sticky status line: progress, save state (`saving`, `saved`, `error`), submit |
| `el-notice` (`--action`, `--recommended`, `--danger`), `el-badge` | notifications and counts |
| `el-table-wrap`, `el-table` (`.num` cells) | tables; the wrapper scrolls on small screens |
| `el-seg` with `button[aria-pressed]` | segmented control: compare modes, widths, theme |
| `el-compare`, `el-compare__pane`, `el-compare--overlay` | before/after frame; overlay uses `--overlay-opacity` |
| `el-lightbox`, `el-lightbox__stage`, `el-lightbox__panel` | full-screen image with the card's caption and controls in a side panel |
| `el-id`, `el-label`, `el-meta`, `el-muted`, `el-kbd`, `el-tag` | `[D34]`-style ids, mono labels and metadata, muted prose, key hints, tags |

States use real pseudo-classes. Static pages can force one with `.is-hover`, `.is-focus`, `.is-disabled`, `.is-error`; inputs use `disabled` and `aria-invalid="true"`.

## Do

- Put the evidence on the card: a screenshot, a table, a diff.
- Say what each option leads to, in the option's note.
- Mark exactly one option as recommended, and name the rule it follows.
- Give every control a visible label; pair every error with a message.
- Keep page CSS to layout; take colour, type and space from tokens.

## Don't

- Don't invent colours, shadows, gradients or fonts. Don't load anything from the network.
- Don't use mono for paragraphs, or `--color-text-faint` for anything a person must read.
- Don't stack cards inside cards, or put more than one decision on a card.
- Don't signal state with colour alone.
- Don't hide the submit bar or the "something is wrong with this page" button.
