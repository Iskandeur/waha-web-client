# WAHA API coverage — feature-gap map

Source: the running WAHA instance's own OpenAPI spec (`openapi: 3.1.0`, 138 paths / 195 schemas),
pulled from its Swagger UI bundle. This is the canonical list of what WhatsApp's HTTP API surface
(via WAHA) can do; whatsapp-sharp is a thin, deliberately-scoped product on top of it, not a 1:1
client for the whole surface.

Status legend:
- **done** — implemented behind `wahaFetch` (backend `src/waha-client.ts`) with a route and, where
  user-facing, a frontend surface.
- **done (this job)** — added in this pass (see "Added this job" below for details).
- **todo** — real product gap, worth building; not yet scheduled.
- **out of scope** — deliberately excluded, with why (risk, admin/infra-only, or off-product).

Grouped by WAHA's own module boundaries. Endpoint paths are session-scoped
(`/api/{session}/...`) unless noted.

## Auth / pairing

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET auth/qr`, `POST auth/request-code`, `GET/POST auth/passkey*` | Connect a real WhatsApp account (QR / phone code / passkey pairing) | **out of scope** | Highest blast-radius action in the whole API — pairing a real account risks a real ban. The public demo is 100% mock and stays that way by design (see README); this would only ever be an admin/operator task run outside the product UI, never a button in the client. |

## API keys

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET/POST /api/keys`, `POST keys/media`, `POST keys/control`, `PUT/DELETE keys/{id}` | Issue/scope/revoke WAHA API keys | **out of scope** | Infra/ops concern (managing credentials to WAHA itself), not a chat-client feature. |

## Sessions

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET /api/sessions` | List sessions | **done** | `routes/sessions.ts` |
| `GET /api/sessions/{session}`, `.../me` | Session detail / "who am I" | todo | Small, low-risk read; natural companion to the list view. |
| `POST/PUT/DELETE /api/sessions*`, `start`, `stop`, `logout`, `restart` | Create/mutate/tear down a session | **out of scope** | Session lifecycle mutation is an operational action with real-world side effects (can log a real device out of WhatsApp). Same risk class as auth/pairing — admin-only, not product UI. |

## Profile (own account)

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET profile`, `PUT profile/name`, `PUT profile/status`, `PUT/DELETE profile/picture` | Settings page (view/edit my name, about, avatar) | todo | Reasonable future "Settings" screen; secondary to core messaging, deferred. |

## Sending messages

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST /api/sendText` (+`GET` variant) | Send text | **done** | `routes/chats.ts`, via `waha.sendText` (typing simulation + full send-guard). |
| `POST /api/sendImage` | Send an image | **done (this job)** | New `waha.sendImage`; see below. |
| `PUT /api/reaction` | React to a message with an emoji | **done (this job)** | New `waha.setReaction`; see below. |
| `PUT /api/star` | Star / unstar a message | **done (this job)** | New `waha.setStar`; see below. |
| `POST /api/sendFile` | Send an arbitrary file/document | todo | Natural next step after image — same upload UX, generic MIME handling. |
| `POST /api/sendVoice` | Send a voice note | todo | Needs an in-browser recorder + `media/convert/voice`; bigger UI lift, deferred. |
| `POST /api/sendVideo` | Send a video | todo | Same shape as image/file, deferred behind those. |
| `POST /api/sendLocation` | Share a location (lat/lng pin) | todo | Needs a map picker; moderate UI cost. |
| `POST /api/sendContactVcard` | Share a contact card | todo | Needs a contact picker UI. |
| `POST /api/sendPoll`, `POST /api/sendPollVote` | Create/vote on a poll | todo | Multi-field composer UI; moderate complexity. |
| `POST /api/sendButtons`, `POST /api/sendList`, `POST send/buttons/reply` | Interactive button/list messages | todo | WhatsApp Business–style messaging; niche for a personal client, low priority. |
| `POST send/link-custom-preview`, `POST /api/sendLinkPreview` | Rich link previews with custom title/image | todo | Nice-to-have polish once basic sending is richer. |
| `POST /api/forwardMessage` | Forward a message to another chat | todo | Needs a chat picker; valuable but not core-MVP. |
| `POST /api/sendSeen` | Mark a specific message as seen | todo | Overlaps with chat-level `messages/read` (below); revisit together. |
| `POST /api/reply` | Deprecated alias for reply-to on send | **out of scope** | WAHA itself marks this deprecated in favor of the `reply_to` field on `sendText`/etc. |
| `GET /api/checkNumberStatus` | Validate a phone number is on WhatsApp | todo | Needed for a real "start new chat by number" flow. |
| `GET /{session}/new-message-id` | Pre-generate a message id | **out of scope** | Internal plumbing helper, not user-facing. |

## Chats

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET chats/overview` (+`POST` batch variant) | Chat list (name, avatar, last message) | **done** (GET) / todo (POST batch) | `routes/chats.ts`; the `POST` batch form only matters at very large `ids` lists, low priority. |
| `GET chats` | Raw chat list (session-scoped, no overview enrichment) | dead code | `waha.listChats()` exists in `waha-client.ts` but no route/UI calls it — either wire it to something or remove; flagged for a follow-up cleanup, not a feature gap. |
| `GET chats/{chatId}/messages` | Load message history | **done** | `routes/chats.ts` |
| `GET chats/{chatId}/picture` | Chat/contact avatar image | **done (this job)** | New `waha.getChatPicture`; see below. |
| `DELETE chats/{chatId}` | Delete a whole conversation | todo | Destructive, needs a confirm dialog; deferred. |
| `DELETE chats/{chatId}/messages` | Clear all messages in a chat | todo | Same destructive-action caution as above. |
| `POST chats/{chatId}/messages/read` | Mark chat as read | todo | High UX value (unread badges become meaningful); good candidate for the *next* pass. |
| `GET/DELETE/PUT chats/{chatId}/messages/{messageId}` | Get/delete/edit a single message | todo | Message-level moderation UI; moderate complexity. |
| `POST .../pin`, `POST .../unpin` | Pin/unpin a message | todo | Small, self-contained; good future quick win. |
| `POST chats/{chatId}/archive`, `unarchive`, `unread` | Inbox management (archive, mark unread) | todo | Valuable inbox triage feature, deferred with the read/unread work above. |

## Calls

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST calls/reject` | Reject an incoming call | **out of scope** | whatsapp-sharp has no calling UI at all (no ringing screen, no call log); rejecting a call is meaningless without that surrounding surface. |

## Channels (WhatsApp Channels/broadcast)

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET/POST/DELETE channels`, `follow/unfollow`, `mute/unmute`, `search/*` (9 endpoints) | Follow/browse/manage WhatsApp Channels | **out of scope (for now)** | Channels are a distinct product surface (one-to-many broadcast, not 1:1/group chat) — a whole future chantier, not an incremental gap in the current chat UI. |

## Status ("Stories")

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST status/text`, `image`, `voice`, `video`, `POST status/delete`, `GET status/new-message-id` | Post/delete a WhatsApp Status update | **out of scope (for now)** | Sizable standalone feature (audience/privacy lists, viewer receipts); deferred as its own future chantier rather than bolted on. |

## Labels

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET/POST labels`, `PUT/DELETE labels/{id}`, `GET/PUT labels/chats/{chatId}`, `GET labels/{id}/chats` | Organize chats with labels (WhatsApp Business feature) | todo | Valuable for power users, secondary to core messaging richness. |

## Contacts

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET contacts/all`, `GET contacts`, `GET contacts/{id}` (session-scoped) | Contact list / lookup | todo | Needed for a real "start new chat" flow (pairs with `checkNumberStatus` above). |
| `GET contacts/about` | Contact's "about" text | todo | Small profile-panel addition. |
| `GET contacts/profile-picture` | Contact avatar (non-chat-scoped variant) | **superseded** | Covered by the chat-scoped `chats/{chatId}/picture` we implemented this job — for a 1:1 DM, `chatId` *is* the contact's JID, so one endpoint serves both. |
| `POST contacts/block`, `POST contacts/unblock` | Block/unblock a contact | todo | Needs a confirm dialog; moderate priority. |
| `PUT contacts/{chatId}` | Create/update a contact | todo | Low priority; not core to a messaging-first client. |

## Lids (WhatsApp "linked ID" identity layer)

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET lids`, `GET lids/count`, `GET lids/{lid}`, `GET lids/pn/{phoneNumber}` | Resolve WhatsApp's newer privacy-preserving IDs ↔ phone numbers | **out of scope** | Internal identity-resolution plumbing; only matters if we start doing raw phone-number lookups ourselves, which we don't yet. |

## Groups

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST/GET groups`, `join-info`, `join`, `count`, `refresh`, `GET/DELETE groups/{id}`, `leave`, picture get/set/delete, `description`, `subject`, admin-only settings (get/set ×2), invite-code get/revoke, participants get/add/remove, admin promote/demote (21 endpoints) | Full group management (create, membership, admin controls) | todo | A whole product area on its own. Group *messaging* already works today (WAHA treats a group as just another `chatId`, so existing send/read routes work unmodified against a group chat) — what's missing is group *management* UI. Sequenced after the core messaging-richness gaps above. |

## Presence

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST presence`, `GET presence`, `GET presence/{chatId}`, `POST presence/{chatId}/subscribe` | Show peer online/typing/last-seen status | todo | We already *emit* our own typing presence when sending (via `startTyping`/`stopTyping` inside `waha.sendText`), but never *read* the peer's. High UX value — strong candidate for the next pass. |

## Screenshot / debug

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET screenshot`, `GET server/debug/cpu`, `GET server/debug/heapsnapshot`, `GET server/debug/browser/trace/{session}` | Live screenshot / profiler dumps of the underlying browser session | **out of scope** | Pure operator debugging tools; exposing a live screenshot of the session's browser publicly would itself be a privacy/security leak, never a product feature. |

## Events

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST {session}/events` | Send a calendar-style event invite message | todo | Niche WhatsApp feature; low priority. |

## Server / health

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET /ping`, `GET /health`, `GET server/version`, `server/environment`, `server/status`, `GET /api/version` | Server health/version introspection | **out of scope** | Ops/infra endpoints for the WAHA server itself, not client-product features. |
| `POST server/stop` | Stop (and restart) the WAHA server | **out of scope** | Destructive infra action; must never be reachable from product code. |

## Media conversion

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST media/convert/voice`, `POST media/convert/video` | Pre-convert recorded audio/video to WhatsApp's expected codec | **out of scope (for now)** | Only relevant once we build our own voice/video recording pipeline (see `sendVoice`/`sendVideo` above) — bundle with that future work rather than build standalone. |

## Apps / integrations

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET/POST apps`, `GET/PUT/DELETE apps/{id}`, `POST webhooks/chatwoot/*`, `GET apps/chatwoot/locales` | Third-party helpdesk integration (Chatwoot) | **out of scope** | Unrelated to this product's scope (a lightweight personal WhatsApp client); admin/infra concern. |

## MCP

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST /mcp` | Expose WAHA itself as an MCP server | **out of scope** | Meta/infra capability (lets an LLM agent drive WAHA directly), not a chat-client feature. |

---

## Added this job

Four features, chosen for high visible impact, low risk (no destructive/session-mutating calls),
and clean fit with the existing `wahaFetch` guard + demo-parity pattern:

1. **Send image** — `waha.sendImage` → `POST /api/sendImage`, wired through the same send-guard
   path as text (rate-limit, jitter, typing simulation).
2. **Message reactions** — `waha.setReaction` → `PUT /api/reaction`.
3. **Star / unstar a message** — `waha.setStar` → `PUT /api/star`.
4. **Chat/contact avatar** — `waha.getChatPicture` → `GET /api/{session}/chats/{chatId}/picture`,
   used by the chat list and thread header.

All four: implemented in `backend/src/waha-client.ts` behind `wahaFetch` (never a bare `fetch`),
routed in `backend/src/routes/chats.ts`, and mirrored in the frontend's `demoApi` (`demo-data.ts`)
so the public demo keeps working with zero real WAHA calls.

## What's next (highest-value gaps, not done this job)

In rough priority order for a future pass: chat-level read/unread (`messages/read`,
`chats/{id}/unread`) to make the unread badges real; peer presence (typing/online/last-seen)
since we already emit our own; `sendFile`/`sendVideo` to round out media sending; message pin;
`checkNumberStatus` + contacts list for a real "start new chat" flow.
