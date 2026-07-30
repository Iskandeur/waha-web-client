# Backlog — accepted, deliberately deferred

Items Iskandeur has asked for explicitly but scheduled as *not now*. The README's
[Roadmap](../README.md#roadmap) covers what's next; this file exists so a deferred ask doesn't
get lost between passes.

---

## Token-budget slider + billing section

**Asked for:** 2026-07-30 — *"il faudra une sorte de curseur dans les paramètres, qui dira à quel
point l'utilisateur est prêt à cramer des tokens. Ça sera un drawback entre features et nombre de
tokens utilisés. Mais pas maintenant. Et il faudra aussi une section billing pour surveiller les
dépenses. Et il faudra que ça soit compatible Claude -p et codex cli."*

**Status:** deferred by the requester. Do not start without a go-ahead.

### 1. Token-budget slider (settings)

A user-facing control expressing **how many tokens the user is willing to burn**, understood as an
explicit trade-off: more budget → richer AI features; less budget → fewer/cheaper ones. Not a hard
cap bolted on after the fact, but a setting the AI features *read* and adapt to.

Design notes for whoever picks this up:

- The trade-off has to be **legible**: the user should see what a given position on the slider
  buys or costs them (e.g. "thread summaries use the last ~50 messages" vs "~200"; proactive
  quick-reply suggestions on/off; whether a cheaper model is used for trivial asks).
- Natural levers already present or planned in this codebase: size of the context window built for
  the AI command bar (`backend/src/ai/commands.ts` currently hardcodes ~50 messages), model
  selection per request, and whether *proactive* AI features (quick-reply suggestions — Roadmap
  item 4) fire at all versus on-demand only.
- Settings need a home first: there is no settings UI today (the frontend has no auth/session
  management either — see README "Status"). This likely lands alongside, or after, that.

### 2. Billing / spend monitoring section

A view to **watch what the AI features actually cost**, not just configure them. Pairs with the
slider: the slider sets intent, this shows the consequence.

Design notes:

- What's measurable depends on the engine (see below) — token counts per request, cumulative
  usage over a period, and cost where the engine reports it. Be honest in the UI about anything
  that's an estimate rather than a billed figure.
- Beware the trap already documented elsewhere in this stack: don't present a number as
  authoritative if the underlying API doesn't actually report it. Better an explicit "not
  available from this engine" than a plausible-looking invention.

### 3. Must work with BOTH `claude -p` and Codex CLI

Both the slider and the billing view have to be **engine-agnostic**: the AI command bar currently
shells out to the official `claude` CLI (`backend/src/ai/commands.ts`), but the requirement is
that this also works with OpenAI's Codex CLI (`codex exec`).

Constraints to know before designing this:

- The two CLIs are both headless and subscription-OAuth-authenticated (no per-call API key), but
  they do **not** report usage identically. Whatever abstraction gets built must degrade honestly
  when an engine exposes less than the other, rather than pretending to parity.
- This mirrors an abstraction being built in the operator's own agent harness (a common `Engine`
  interface over `claude -p` and `codex exec`, with a manual switch and, later, quota-driven
  fallback). Worth looking at that prior art before designing a second, divergent abstraction —
  ask the operator for a pointer rather than guessing.
