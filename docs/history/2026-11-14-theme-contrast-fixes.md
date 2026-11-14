---
type: History Entry
title: "2026-11-14 — Theme contrast fixes: warning, success and input borders"
description: "Light-mode warning and success text and white-on-status buttons fell to 3.2–3.8:1, and input borders were 1.1–1.3:1 in both themes; darkened those tokens and added a test that checks every text and boundary pair in both themes against the real globals.css."
date: 2026-11-14
tags: [ui, accessibility, theming]
---

# 2026-11-14 — Theme contrast fixes

A general UI and contrast check of the theme tokens in `app/globals.css` found that several
colour pairs fell below WCAG thresholds. The shadscan score was unchanged (90/100), because
shadscan does not measure rendered contrast, so this was found by checking the tokens directly.

## What was wrong

Ratios computed from the HSL tokens (WCAG 2.x relative luminance):

| Pair | Light before | Needed |
|------|--------------|--------|
| `--warning` text on background | 3.18:1 | 4.5:1 (text) |
| `--success` text on background | 3.74:1 | 4.5:1 (text) |
| `--warning-foreground` on `--warning` | 3.33:1 | 4.5:1 |
| `--success-foreground` on `--success` | 3.75:1 | 4.5:1 |
| `text-warning` on `bg-warning/10` | 2.87:1 | 4.5:1 |
| `text-success` on `bg-success/10` | 3.33:1 | 4.5:1 |
| `--input` border on background | 1.27:1 | 3:1 (WCAG 1.4.11) |

The input border is the one that matters most. `Input` uses `bg-background`, which is the page
colour, so the border is the only thing that shows where a field is. In both themes it was
1.1–1.3:1.

Dark mode was already fine for text and status colours (10:1 and above). Only its input border
(1.12–1.18:1) failed.

## What changed

- `app/globals.css`, light `:root`:
  - `--warning` `38 90% 40%` → `38 90% 30%`
  - `--success` `133 61% 36%` → `133 61% 28%`
  - `--input` `214 20% 88%` → `214 20% 55%`
- `app/globals.css`, `.dark`:
  - `--input` `222 30% 13%` → `222 20% 45%`

`--border` is unchanged. It is used for decorative dividers, not for control boundaries, so the
1.3:1 divider contrast is intentional.

Values after the change (light / dark):

- Warning text 5.22:1 on background, 4.57:1 on the 10% tint. White on warning 5.46:1. Dark theme was already above 10:1.
- Success text 5.67:1 on background, 4.93:1 on the tint. White on success 5.68:1.
- Input border 3.41:1 (light) and 3.63:1 (dark) on the background, both above 3:1.

## Visible effects

- **Light mode warnings and successes are darker.** Warning and success text, the warning
  timeline bars (`bg-warning/60`), and the verdict pill all shift darker. This is the intended
  trade-off, but it needs a look in the rendered app.
- **Input borders are clearly visible in both themes.** In dark mode a field used to be almost
  invisible; now it has a visible grey-teal edge.
- `--chart-3` (light `133 47% 68%`, 1.77:1 on card) fails the 3:1 graphic threshold too. It is
  not referenced by any component in `components/`, `app/` or `lib/`, so it was left alone. Fix it
  if it gets used for a series.

## Regression test

`lib/utils/contrast.test.ts` reads `app/globals.css` and checks, for both themes:

- 17 text pairs against 4.5:1 (foreground, primary, muted, destructive, warning and success on
  each surface, and each `*-foreground` on its status colour).
- 2 input-boundary pairs against 3:1.
- The `bg-warning/10` and `bg-success/10` tinted surfaces, which are composited with `blend()`
  before the ratio is taken.

The contrast maths lives in `lib/utils/contrast.ts`, a small helper module with its own unit
tests. Before the token change, 14 of the 55 checks failed, matching the table above. After it,
all 55 pass.

## Verification

- `npx vp test run lib/utils/contrast.test.ts`: 55/55 (14 failing before the token change).
- `npm run test`: 83 files, 1,463 tests pass.
- `npm run check`: 0 errors, 79 warnings. None are in the files touched here.
- `npm run typecheck`: clean.
- `npm run build` (with placeholder Supabase env vars, per the build memory note): clean.
- `npm run shadscan`: 90/100, unchanged, with the same three documented waivers.
- `npm run docs:check`: ok.

Not checked: a rendered visual pass in a browser. The token maths is verified, but how the
darker colours look on the real pages still needs a human look.
