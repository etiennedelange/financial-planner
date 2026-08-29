# PWA icon: safe-zone padding, maskable manifest entries, and a single icon route

Date: 2026-08-29

## What

`app/icon.tsx`, `app/icon1.tsx`, `app/icon2.tsx`, and `app/apple-icon.tsx` were
all live routes, wired in automatically by Next's file-convention metadata
system (verified in the rendered `<head>`: four `<link rel="icon"|"apple-touch-icon">`
tags at 32/192/512/180, plus `/icon1` and `/icon2` referenced explicitly from
`app/manifest.ts`). None were unused, so none were deleted outright — but
`icon.tsx`/`icon1.tsx`/`icon2.tsx` were three near-identical files that only
differed by a `size` export, and Next's `generateImageMetadata()` API exists
precisely to collapse that into one file. Consolidated them into a single
`app/icon.tsx` that returns all three sizes (`generateImageMetadata` → ids
`"32"`/`"192"`/`"512"`); the routes it produces are `/icon/32`, `/icon/192`,
`/icon/512` (confirmed in the build output). `app/apple-icon.tsx` stays a
separate file — `apple-icon` is a distinct Next convention (different
`<link rel="apple-touch-icon">` tag, only one size needed), not part of the
numbered `icon` family, so it can't fold into the same file.

Separately, the shared `PwaIconArtwork` (`lib/pwa/icon-artwork.tsx`) drew its
bars/trend-line/dot edge-to-edge across the full 32×32 canvas — the
`maskable-icon` advisory left open by the PWA installable work
(`docs/history/2026-08-29-pwa-installable.md`). OS-level icon masks (Windows
11 taskbar/Start pinning, Android adaptive icons, iOS auto-rounding) crop
whatever shape they want on top of a manifest icon; content that reaches the
edge gets clipped, so the icon looked inconsistent once pinned versus how it
renders in a browser tab. Fix: the background rect stays full-bleed (masks
need edge-to-edge fill to crop into their own shape), but the foreground
chart glyph is now wrapped in `<g transform="translate(2.3 2.14) scale(0.83)">`,
inset ~15-20% from every edge — comfortably inside the standard maskable
"safe zone". `app/manifest.ts` now also declares `purpose: "maskable"`
variants of the `/icon/192` and `/icon/512` entries alongside the plain ones.

## Why

The user asked (1) to confirm `icon.tsx`/`icon1.tsx`/`icon2.tsx` weren't dead
code and remove them if so, and (2) to make the icon consistent everywhere,
explicitly calling out Windows taskbar pinning. Investigation showed they
were all load-bearing, so a follow-up question — "why are there still so many
icon.tsx files, is it not possible to use a single icon for everything" — led
to the `generateImageMetadata` consolidation: three files down to one for the
`icon` family (apple-icon necessarily stays separate). The real consistency
gap was the un-padded artwork getting clipped by whatever mask an OS applies
on pin/install — exactly the gap the original PWA work had already flagged
and deferred.

## Verification

- `npm run typecheck` — clean
- `npm run test` — 1003/1003 passed (4 new tests: `lib/pwa/icon-artwork.test.tsx`
  asserting the background stays full-bleed, the foreground sits in a `<g>`
  with a `scale(...) < 1` inset, and `rounded` only affects corner radius, not
  glyph position; 2 new `app/manifest.test.ts` assertions for the maskable
  entries at their new `/icon/192` and `/icon/512` paths)
- `npm run lint` — 0 errors (9 pre-existing warnings, unrelated)
- `npm run build` — clean; route list now shows a single
  `/icon/[__metadata_id__]` generating `/icon/32`, `/icon/192`, `/icon/512`
  as static routes, plus `/apple-icon`
- `npm run shadscan` — 93/100 (A), unchanged
- Live dev server: `<head>` renders `<link rel="icon">` at all three sizes
  pointing at `/icon/32`, `/icon/192`, `/icon/512`; `/manifest.webmanifest`
  reflects the new paths with both plain and maskable entries; rendered
  `/icon/512` and `/apple-icon` and visually confirmed the chart glyph sits
  with clear margin on every side at both sizes

## Notes / tradeoffs

- Did not attempt to verify the actual Windows taskbar pin visually (no
  Windows host available in this environment) — the fix is verified against
  the documented maskable safe-zone spec (content inside the center ~70-80%),
  which is what Windows 11, Android, and iOS icon masking all key off.
- `icon.tsx`'s 32×32 favicon (`rounded`) shares the same inset artwork as the
  OS-facing sizes for visual consistency, even though a browser tab favicon
  isn't itself OS-masked.
- The consolidated route path changed from `/icon1`/`/icon2` to `/icon/192`/
  `/icon/512` — no other code referenced the old paths (checked `public/sw.js`
  and the full repo for `icon1`/`icon2` references beyond docs/specs).
