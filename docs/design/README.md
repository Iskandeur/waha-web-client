# Design source files

`organic-redesign/` is the Claude Design export the current frontend theme
(`frontend/src/styles.css` and the component markup it styles) was implemented from —
the "Organic" system: cream/terracotta/sage palette, Caprasimo + Figtree type, 16px
radii growing into pills, soft circular accents.

- `organic-redesign/WhatsApp Sharp - 1a Warm.dc.html` — the full app mockup ("Warm
  parity") that the current UI matches screen-for-screen: sidebar, thread, composer,
  contact/group panels, settings.
- `organic-redesign/WhatsApp Sharp - Redesign.dc.html` — earlier direction options
  (1a/1b/1c) plus a token spec sheet, kept for context on paths not taken.
- `organic-redesign/WhatsApp Sharp - Current UI.dc.html` — a snapshot of the prior
  (dark) UI, for before/after reference.
- `organic-redesign/_ds/organic-*/` — the design system itself: `styles.css` (the
  token source `:root` values in `frontend/src/styles.css` were ported from) and
  `readme.md` (the system's usage guide — color ramps, type scale, component
  conventions).

These are static exports (open the `.dc.html` files directly in a browser); they're
not wired into the build. Keep them around for future design iterations rather than
re-deriving the palette/tokens from scratch.
