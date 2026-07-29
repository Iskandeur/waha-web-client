# WhatsApp#

> Name note: repo/slug is `whatsapp-sharp`, stylized **WhatsApp#** (à la C#/F#).

A self-hosted WhatsApp web client: a small Node/TypeScript backend that talks to a
[WAHA](https://waha.devlike.pro/) (WhatsApp HTTP API) instance, and a React SPA on top. It started
feature-parity-first with the official client (chat list, threads, read receipts, media) and has
since gone past that baseline on purpose — the goal is to expose as much of WAHA's API surface as
is reasonably safe to, including group-admin/account controls (per-group "info/messages admin
only" toggles, invite-link regeneration, bulk membership actions) that the official WhatsApp
client doesn't offer at all. See [`docs/waha-coverage.md`](docs/waha-coverage.md) for the full
endpoint-by-endpoint map. Two things sit on top of that: a real **[anti-detection
guard](#anti-detection-guard)** between every backend call and WAHA (rate limits, jitter, typing
simulation, burst/duplicate-content detection, a circuit breaker — extended to cover bulk group
actions too, never bypassed), and a **natural-language AI command bar** driven by the
[Claude Code CLI](https://docs.claude.com/en/docs/claude-code) (`claude -p`), for things like
"summarize this thread" or "draft a friendly reply" without leaving the keyboard.

## Why this exists / why WAHA

WhatsApp has no public, sanctioned API for personal accounts. WAHA drives the WhatsApp Web
protocol the same way the official web/desktop clients do (via `whatsapp-web.js`/NOWEB
engines) — which means **this stack is outside WhatsApp's Terms of Service**, same as any
personal-account automation (`whatsapp-web.js`, Baileys, etc.).

This is a **research / portfolio project**: an exploration of what a powerbar-driven,
AI-augmented messaging client could look like, built on top of an already-common
unofficial-API pattern. It is published openly and with that trade-off stated up front, not
hidden.

**Not for spam, not for mass messaging, not for automating outreach to people who didn't
ask for it.** WhatsApp bans numbers aggressively and permanently for exactly that kind of
behavior — see [Safety](#safety) below for what that looks like in practice.

## Architecture

```
whatsapp-sharp/
├── backend/
│   └── src/
│       ├── waha-client.ts   Wraps the WAHA REST API. `wahaFetch` is the single function
│       │                    that performs HTTP calls to WAHA — every entry point (read,
│       │                    send, presence) funnels through it, so the guard below has
│       │                    exactly one choke point to sit behind, not a checklist to
│       │                    remember to apply per call site.
│       ├── guard/           Anti-detection guard — see below.
│       ├── routes/          sessions, chats, ai, guard (status/log introspection).
│       └── ai/              The AI command bar's `claude -p` runner.
├── frontend/   Vite + React + TypeScript SPA, feature-parity-oriented: chat list with
│               search/filters/avatars/unread, threaded chat view with read receipts,
│               date separators and grouped bubbles, media placeholders (image/file/
│               voice), and the AI command bar. No UI kit dependency — a dozen
│               hand-rolled SVG icon components instead.
└── docker-compose.yml   A disposable WAHA instance for local dev/testing.
```

The backend never talks to WhatsApp directly — it only ever talks to a WAHA HTTP API
(local or remote), which owns the actual WhatsApp Web session.

## Anti-detection guard

**This is the part that matters most.** Unofficial WhatsApp automation (this project
included) gets banned for looking automated — too fast, too regular, too broad. The guard
in `backend/src/guard/` is a real gate, not a README checklist: `waha-client.ts`'s
`wahaFetch` is the *only* function in the codebase that performs an HTTP call to WAHA, and
it refuses to run at all while the circuit breaker is open. `waha.sendText` — the only
send path exposed, there is no unguarded lower-level alternative — layers a further,
send-specific gate on top before it ever reaches `wahaFetch`.

What it actually checks, in order, for every send (`backend/src/guard/send-guard.ts`):

1. **Circuit breaker** (`circuit-breaker.ts`) — if WAHA has returned enough errors
   recently (any call, reads included — instability is instability), every WAHA call is
   blocked for a cooldown period. No insisting into a failing session.
2. **Per-chat and global rate limits** (`rate-limiter.ts`, sliding windows) — messages per
   minute and per hour, both per chat and across the whole session. Defaults are
   deliberately conservative (3/min/chat, 20/hour/chat, 8/min global, 80/hour global) —
   "too slow" is the safe failure mode, not "fast enough."
3. **Burst-to-many-chats detection** — messaging more than a handful of distinct chats
   within a short window is refused outright; that fan-out pattern is a spam signature
   independent of content or rate.
4. **Duplicate-content detection** — sending near-identical text to a different chat
   shortly after is refused; broadcasting the same message to multiple people is one of
   the strongest abuse signals WhatsApp looks for.
5. **Warm-up** — for a configurable period after the backend boots (proxy for "session
   just (re)started"), all the above limits are divided down further and jitter is
   doubled. A freshly linked session should ease in, not open with a burst.
6. **Jitter** — every allowed send still waits a randomized delay first, so cadence never
   looks perfectly periodic even when well under the rate limits.
7. **Typing simulation** — `waha.sendText` calls `startTyping`, waits a duration
   proportional to the message length (clamped to a sane range), then `stopTyping`,
   *before* the actual send. No message goes out without a typing indicator having shown
   first — same as a human typing it.

A sibling guard, `group-guard.ts`, applies the same philosophy to **bulk group-membership
actions** (add/remove/promote/demote participants) added in a later pass: a per-call
participant-count cap, per-group and global rate limits, and the same jittered delay — because
scripted mass membership changes are exactly the kind of abuse signature this guard exists to
slow down, and "it's not technically a message send" is not a reason to skip it. Every group
route funnels through it the same non-optional way `sendText` funnels through `send-guard.ts`.

Every decision — allowed, delayed, or blocked, and why — is written to an in-memory,
size-capped audit log (`audit-log.ts`), inspectable via `GET /api/guard/status` (circuit
breaker state, warm-up status) and `GET /api/guard/log` (recent decisions). A blocked send
surfaces to the frontend as an HTTP 429 with the reason, not a silent failure or a 500.

All thresholds are env-tunable (see `.env.example`) but ship with safe defaults — this was
built by someone with [a documented, permanent number ban](#safety) from being too
aggressive, so the defaults err hard toward "slow."

**Tested in mock** (`backend/src/guard/send-guard.test.ts`, `node --test` via `tsx`,
`npm test --workspace backend`): rate limits (per-chat and global, minute and hour),
warm-up making limits stricter and jitter larger, burst-across-chats blocking, duplicate-
content blocking (and *not* false-flagging the same recipient), circuit breaker
opening/clearing, and typing-duration bounds. It has **not** been exercised against a real
WAHA instance yet — see [Status](#status--checkpoint). Activating this against a real,
valued WhatsApp session remains a deliberate decision for whoever runs it, not something
this codebase does on its own; the public demo deployment never touches WAHA at all (see
below).

## The AI command bar

Type an instruction instead of a message — "summarize this thread", "draft a reply in a
friendly tone", "what did they say about the trip?" — and the backend builds a prompt from
the last ~50 messages of the open chat and runs it through `claude -p` (`backend/src/ai/commands.ts`).
The result is shown as a **suggestion only**: it lands in the composer for you to edit and
send, it is never sent automatically. This was the one AI feature built end-to-end for this
first checkpoint, deliberately, rather than several shallower ones (natural-language search,
auto-drafted quick replies, etc. are listed under [Roadmap](#roadmap)).

It shells out to the official `claude` CLI binary (OAuth-authenticated on the host), not a
raw Anthropic API key — same auth surface as the rest of the machine running it.

## Getting started

Requires Node.js ≥ 22, and a WAHA instance to point at (see below).

```bash
# 1. Start a disposable WAHA instance for local testing (see Safety below —
#    do NOT link this to a real/valued WhatsApp number)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure the backend
cp .env.example .env
# edit .env: WAHA_BASE_URL, WAHA_API_KEY, WAHA_SESSION

# 4. Run backend and frontend (two terminals)
npm run dev:backend
npm run dev:frontend

# Backend guard unit tests (no WAHA instance needed)
npm test --workspace backend
```

Then open the frontend (Vite prints the local URL, typically `http://localhost:5173`) and
scan the WAHA session's QR code as usual to link a WhatsApp account to the test session.

## Safety

**This is the part that matters most if you fork this.**

- **Never point this at a WhatsApp number you value.** Use a disposable/test number and a
  throwaway WAHA session. Unofficial-API automation gets numbers banned, sometimes
  permanently, and appeals rarely succeed.
- **Never send bulk/near-identical messages, and never message first-contacts in bulk.**
  Both are the strongest spam signals WhatsApp's abuse detection looks for.
- **Space out programmatic sends.** Rapid-fire messages (several per second, or scripted
  loops) are a second strong signal, independent of content.
- The AI command bar is designed so its output is always a *draft*, never an auto-send —
  keep it that way if you extend it. A human should be the one hitting send.

This project was built by someone who maintains an always-on WhatsApp automation agent for
personal use, and who has a documented, permanent number ban from ignoring exactly the
rules above. That lesson is the reason this list exists.

## Live demo

**https://iskandeur.github.io/whatsapp-sharp/**

A static, frontend-only build published via GitHub Pages (GitHub Actions workflow:
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)), with **mock data —
no backend, no WAHA, no real WhatsApp connection of any kind**. This exists purely so the UI can
be seen without standing up infrastructure. The demo banner in the UI says so explicitly.

Demo mode is the **default** for the frontend build (`VITE_DEMO_MODE` unset or anything other
than `"false"`) — a safety choice, not just a deployment detail: it means an accidental deploy
of this frontend can never reach a real backend/WAHA instance unless someone deliberately opts
out. For real usage (self-hosted, against your own disposable WAHA instance), set
`VITE_DEMO_MODE=false` in `frontend/.env` before building/running.

## Self-hosted deployment (single container + PIN gate)

The [`Dockerfile`](Dockerfile) builds one image: the Fastify backend serves both its own API
routes *and* the built frontend (`frontend/dist`) — no separate web server needed. By default
(no `VITE_DEMO_MODE=false` at build time, matching the GitHub Pages build) this still ships the
demo — mock data, no WAHA, no real WhatsApp connection — just running from your own container
instead of GitHub Pages.

```bash
docker build -t whatsapp-sharp .
docker run -p 127.0.0.1:8788:8787 \
  -e ACCESS_PIN=<pin> -e ACCESS_SESSION_SECRET=$(openssl rand -hex 32) \
  whatsapp-sharp
```

An optional **PIN gate** (`backend/src/access-gate.ts`) sits in front of every route when
`ACCESS_PIN` is set: a single login page (`/login`), a stateless signed session cookie (30-day
TTL, HMAC'd with `ACCESS_SESSION_SECRET`), everything else 401s/redirects until it's presented.
Leave `ACCESS_PIN` unset and the gate is a no-op — fine when you're the only one who can reach
the port. **Never commit real PIN/secret values** — they're read from the environment only.

[`deploy/docker-compose.yml`](deploy/docker-compose.yml) + [`deploy/.env.example`](deploy/.env.example)
wire this up bound to `127.0.0.1` only, on an external Docker network shared with a reverse-proxy/
tunnel container (so it's reachable through that, not by publishing the port publicly) —
copy `deploy/.env.example` to `deploy/.env` (git-ignored), fill in real values, then:

```bash
cd deploy && docker compose up -d --build
```

## Status / checkpoint

Second pass, pivoted after feedback that the first checkpoint's UI was too bare-bones: the
priority order for this pass was (1) a feature-parity, cleaner UI, (2) a real anti-detection
guard, (3) extra features only if time allowed — in that order, and quality over quantity.

Done this pass:

- **Anti-detection guard** (`backend/src/guard/`): rate limits, jitter, typing simulation,
  burst/duplicate-content detection, circuit breaker, audit log — see above. Unit-tested
  (12 cases, `npm test --workspace backend`), **not yet exercised against a real WAHA
  instance** (no disposable WAHA instance was stood up in this pass — see below).
- **Frontend rebuild**: search + filter tabs, avatars, unread badges, pinned chats, read
  receipts (✓/✓✓/blue ✓✓), date separators, grouped consecutive bubbles, sender names in
  groups, image/file/voice message placeholders, a WhatsApp-style composer (emoji/attach/
  send-or-mic icons). Also fixed a real bug found while rewriting `Composer`: the AI
  command bar's suggestion never actually reached the composer input before (uncontrolled
  component that only read its initial prop value) — it's a controlled component now.
- No UI kit dependency added — a dozen hand-rolled inline SVG icon components instead.

Still open / not done in this pass (honest gaps, not silently skipped):

- **Not exercised end-to-end against a live WAHA instance** — neither the UI's assumed
  response shapes nor the guard's behavior under real WAHA errors/rate-limiting have been
  verified against the real API, only against the mock demo data and unit tests. Expect
  adapter tweaks once someone runs this against an actual WAHA instance.
- The guard's "warm-up" signal is a proxy (time since backend process boot), not a real
  read of the WAHA session's actual link time — accurate enough to be conservative, but
  worth tightening if WAHA exposes session-start metadata.
- No media upload/download pipeline — the UI renders image/file/voice message *shapes*
  from demo data; there's no real attach-a-file flow yet (attach/mic buttons are present
  but decorative).
- No AI command bar work this pass (still the single "ask about this thread" action from
  the first checkpoint).
- No auth/session management in the frontend (single hardcoded WAHA session for now).
- No message pagination/infinite scroll (fixed recent-message window).

## Roadmap

1. Verify end-to-end against a real disposable WAHA instance — both the UI's response-shape
   assumptions and the guard's behavior under real WAHA errors/rate-limit responses.
2. Real media upload/download (currently placeholder shapes only).
3. Multi-session support in the UI (switch between linked WhatsApp accounts).
4. More AI command bar actions: natural-language search across chats, quick-reply
   suggestions surfaced proactively (still draft-only, never auto-send).
5. Message pagination/infinite scroll.
6. Tighten the guard's warm-up detection to a real session-start signal instead of backend
   process boot time, once WAHA's session metadata is verified against a live instance.

## License

MIT — see [LICENSE](LICENSE).
