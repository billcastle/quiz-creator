---
title: "GUIDE: Adding a new visual theme"
audience: "Developers and designers"
status: "Current"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["guide", "design-system", "theming"]
---

# GUIDE: Adding a new visual theme

## Audience

Developers or designers who want to add a new visual theme to Questify. No knowledge of the ThemeToggle implementation or the Vite build system is required. The entire operation is contained in a single new file.

## Prerequisites

- `npm install` run from the repo root
- A palette of at least 17 color values (see token table below)

## Step 1 — Copy an existing theme file

```bash
cp packages/ui/src/themes/dusk.ts packages/ui/src/themes/ocean.ts
```

## Step 2 — Update identity fields

| Field | What to set |
|---|---|
| `id` | Unique kebab-case string. Must not match `default`, `dark`, or `dusk`. Example: `"ocean"` |
| `name` | Human-readable display name. Example: `"Ocean"` |
| `swatches` | Array of 5 hex colors representing the palette. Shown as dots in `ThemeToggle`. |

## Step 3 — Replace all 17 token values

| Token | Role |
|---|---|
| `--color-bg-base` | Page background |
| `--color-bg-surface` | Card and panel background |
| `--color-bg-subtle` | Sidebar / input fill |
| `--color-border` | Default border |
| `--color-border-focus` | Focused input ring |
| `--color-text-primary` | Main body text |
| `--color-text-secondary` | Subdued / helper text |
| `--color-text-disabled` | Placeholder and disabled text |
| `--color-accent` | Primary action color |
| `--color-accent-hover` | Accent on hover |
| `--color-accent-fg` | Text on accent background |
| `--color-destructive` | Error / danger state |
| `--color-success` | Correct / pass state |
| `--color-warning` | Warning / flagged state |
| `--color-quiz` | Quiz badge background |
| `--color-survey` | Survey badge background |
| `--color-exam` | Exam badge background |

All values must be valid CSS color strings (hex, `rgb()`, `hsl()`, or CSS named colors).

## Step 4 — Verify in the dev server

```bash
npm run dev:web
```

Open `http://localhost:5173/design-system`. Your new theme appears in the `ThemeToggle` at the top right. Select it and check:

- [ ] Page background matches `--color-bg-base`
- [ ] Cards and panels use `--color-bg-surface`
- [ ] Accent buttons are visible and readable
- [ ] Body text is readable (≥4.5:1 contrast ratio recommended)
- [ ] All 15 gallery sections render without missing or wrong colors
- [ ] Badge variants (quiz, survey, exam) are distinguishable
- [ ] `RichTextEditor` toolbar is usable
- [ ] Timer warning/danger states are visible

Adjust token values and save — the dev server hot-reloads.

## Step 5 — Run typecheck

```bash
npm run typecheck
```

The `satisfies Theme` assertion on your theme object will surface any missing or misnamed tokens as compile errors.

## Step 6 — Commit

```bash
git add packages/ui/src/themes/ocean.ts
git commit -m "feat(design-system): add Ocean theme"
```

The diff should contain **exactly one new file**. If `ThemeToggle.tsx`, `index.ts`, or any CSS file appears, something went wrong.

## Troubleshooting

**Theme does not appear in the toggle**
Confirm the file is directly in `packages/ui/src/themes/` (not a subdirectory) with a `.ts` extension. The glob picks up only `*.ts` files in that directory.

**TypeScript error: Property X is missing**
Your `tokens` map is missing one of the 17 required properties. Compare against `dusk.ts` to find the gap.

**Colors do not change on theme switch**
Some component is using a hardcoded color value. See [STANDARD-design-token-styling](STANDARD-design-token-styling.md).

**Dev server not picking up the new file**
Stop and restart `npm run dev:web`. Vite's `import.meta.glob` is resolved at startup and may not detect newly added files via HMR.

## References

- [ADR-006-file-based-theme-engine.md](ADR-006-file-based-theme-engine.md) — the decision behind this system.
- [PATTERN-file-based-theme.md](PATTERN-file-based-theme.md) — concise pattern reference with full code example.
- [STANDARD-design-token-styling.md](STANDARD-design-token-styling.md) — why token-only styling is required.
