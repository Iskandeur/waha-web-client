# WhatsApp#

> Name note: repo/slug is `whatsapp-sharp`, stylized **WhatsApp#** (à la C#/F#).

A self-hosted WhatsApp web client: a small Node/TypeScript backend that talks to a
[WAHA](https://waha.devlike.pro/) (WhatsApp HTTP API) instance, and a React SPA on top —
with one powerfeature: a **natural-language AI command bar** driven by the
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
├── backend/    Fastify + TypeScript. Wraps the WAHA REST API and exposes a small
│               JSON API to the frontend: sessions, chats, messages, send, and the
│               AI command endpoint (which shells out to `claude -p`).
├── frontend/   Vite + React + TypeScript SPA: chat list, message thread, composer,
│               and the AI command bar.
└── docker-compose.yml   A disposable WAHA instance for local dev/testing.
```

The backend never talks to WhatsApp directly — it only ever talks to a WAHA HTTP API
(local or remote), which owns the actual WhatsApp Web session.

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

## Status / checkpoint

This is a first working scaffold, not a finished v1:

- Backend and frontend are structurally complete (routes, WAHA client wrapper, AI command
  endpoint, chat list/thread/composer/command-bar UI) but have **not yet been exercised
  end-to-end against a live WAHA instance** in this pass — expect rough edges in response
  shapes (WAHA's exact JSON fields for chats/messages may need small adapter tweaks once
  tested against a real instance).
- No tests yet.
- No auth/session management in the frontend (single hardcoded WAHA session for now).

## Roadmap

1. Verify end-to-end against a real disposable WAHA instance; fix response-shape mismatches.
2. Add a lightweight test suite (backend route tests at minimum).
3. Multi-session support in the UI (switch between linked WhatsApp accounts).
4. More AI command bar actions: natural-language search across chats, quick-reply
   suggestions surfaced proactively (still draft-only, never auto-send).
5. Basic message pagination/infinite scroll (currently fetches a fixed recent-message window).

## License

MIT — see [LICENSE](LICENSE).
