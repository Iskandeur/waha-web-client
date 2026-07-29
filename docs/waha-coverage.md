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
| `POST /api/sendImage` | Send an image | **done** | New `waha.sendImage`. |
| `PUT /api/reaction` | React to a message with an emoji | **done** | New `waha.setReaction`. |
| `PUT /api/star` | Star / unstar a message | **done** | New `waha.setStar`. |
| `POST /api/sendFile` | Send an arbitrary file/document | **done** | New `waha.sendFile`. |
| `POST /api/sendVoice` | Send a voice note | todo | Needs an in-browser recorder + `media/convert/voice`; bigger UI lift, deferred. |
| `POST /api/sendVideo` | Send a video | **done** | New `waha.sendVideo`. |
| `POST /api/sendLocation` | Share a location (lat/lng pin) | **done (this job)** | New `waha.sendLocation`; browser Geolocation API ("share my current location"), no map-search picker yet — see below. |
| `POST /api/sendContactVcard` | Share a contact card | **done (this job)** | New `waha.sendContactVcard`; reuses the new contacts picker — see below. |
| `POST /api/sendPoll`, `POST /api/sendPollVote` | Create/vote on a poll | todo | Multi-field composer UI; moderate complexity. |
| `POST /api/sendButtons`, `POST /api/sendList`, `POST send/buttons/reply` | Interactive button/list messages | todo | WhatsApp Business–style messaging; niche for a personal client, low priority. |
| `POST send/link-custom-preview`, `POST /api/sendLinkPreview` | Rich link previews with custom title/image | todo | Nice-to-have polish once basic sending is richer. |
| `POST /api/forwardMessage` | Forward a message to another chat | todo | Needs a chat picker; valuable but not core-MVP. |
| `POST /api/sendSeen` | Mark a specific message as seen | todo | Overlaps with chat-level `messages/read` (below); revisit together. |
| `POST /api/reply` | Deprecated alias for reply-to on send | **out of scope** | WAHA itself marks this deprecated in favor of the `reply_to` field on `sendText`/etc. |
| `GET contacts/check-exists` (`checkNumberStatus`) | Validate a phone number is on WhatsApp | **done (this job)** | New `waha.checkNumberExists`; see below. |
| `GET /{session}/new-message-id` | Pre-generate a message id | **out of scope** | Internal plumbing helper, not user-facing. |

## Chats

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET chats/overview` (+`POST` batch variant) | Chat list (name, avatar, last message) | **done** (GET) / todo (POST batch) | `routes/chats.ts`; the `POST` batch form only matters at very large `ids` lists, low priority. |
| `GET chats` | Raw chat list (session-scoped, no overview enrichment) | **removed (this job)** | `waha.listChats()` was dead code (no route/UI ever called it, fully superseded by `chatsOverview`) — deleted rather than wired up, per the previous job's flag. |
| `GET chats/{chatId}/messages` | Load message history | **done**, transparency added **(this job)** | `routes/chats.ts`; response now wraps the array with `{ limit, truncated }` — see "History transparency" below. |
| `GET chats/{chatId}/picture` | Chat/contact avatar image | **done** | New `waha.getChatPicture`. |
| `DELETE chats/{chatId}` | Delete a whole conversation | **done (this job)** | New `waha.deleteChat`; confirm dialog client-side (`window.confirm`); see below. |
| `DELETE chats/{chatId}/messages` | Clear all messages in a chat | **done (this job)** | New `waha.clearChatMessages`; same confirm-dialog caution as delete; see below. |
| `POST chats/{chatId}/messages/read` | Mark chat as read | **done** | New `waha.markChatRead`. |
| `GET chats/{chatId}/messages/{messageId}` | Get a single message | **superseded** | Redundant with the existing full-history `GET chats/{chatId}/messages` the thread already loads; no standalone value added. |
| `DELETE/PUT chats/{chatId}/messages/{messageId}` | Delete/edit a single message | **done (this job)** | New `waha.deleteMessage`/`waha.editMessage`; see below. |
| `POST .../pin`, `POST .../unpin` | Pin/unpin a message | **done** | New `waha.pinMessage`/`waha.unpinMessage`. |
| `POST chats/{chatId}/archive`, `unarchive` | Inbox management (archive) | **done (this job)** | New `waha.archiveChat`/`waha.unarchiveChat`; see below. |
| `POST chats/{chatId}/unread` | Mark chat as unread | **done** | New `waha.markChatUnread`. |

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
| `GET/POST labels`, `PUT/DELETE labels/{id}`, `GET/PUT labels/chats/{chatId}` | Organize chats with labels (WhatsApp Business feature) | **done**, rename/recolor UI added **(this job)** | `waha.listLabels`/`createLabel`/`updateLabel`/`deleteLabel`/`getChatLabels`/`setChatLabels`; `updateLabel` now has a UI (pencil icon → inline rename + palette) — see below. |
| `GET labels/{id}/chats` | List every chat carrying a given label | **done (this job)** | New `waha.getChatsByLabel` (backend/route ready; no dedicated "filter chat list by label" UI yet — see What's next). |

## Contacts

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET contacts/all` | Contact list | **done**, picker UI added **(this job)** | `waha.listContacts` (`routes/contacts.ts`); now backs a real `ContactPicker` component used both for "start a new chat" and "share a contact" — see below. |
| `GET contacts`, `GET contacts/{id}` (session-scoped) | Single-contact lookup | todo | Only useful once there's a contacts picker UI to call it from. |
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
| `GET presence/{chatId}`, `POST presence/{chatId}/subscribe` | Show peer online/typing/last-seen status | **done** | New `waha.getPresence`/`waha.subscribePresence`. |
| `POST presence`, `GET presence` | Set our own global presence / read all-chats presence in one call | todo | We already emit *typing* presence per-chat via `startTyping`/`stopTyping`; a session-wide online/offline toggle and the batch "all chats" read are secondary to the per-chat presence just added. |

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

## Added in previous jobs

Four features (send image, message reactions, star/unstar, chat/contact avatar) — see git
history (`docs: map every WAHA endpoint...` and the commit right after it) for details. All
implemented behind `wahaFetch`, routed in `backend/src/routes/chats.ts`, and mirrored in
`demoApi` (`frontend/src/demo-data.ts`).

## Added this job (v4 pass)

Eight endpoints — the full "highest-value gaps" list from the previous job's report, chosen
because every one of them is a low-risk read or a lightweight mutation (no destructive or
session-lifecycle calls), and all reuse the existing `wahaFetch`/send-guard/demo-parity
patterns without needing new architecture:

1. **Mark chat read / unread** — `waha.markChatRead` → `POST .../messages/read`,
   `waha.markChatUnread` → `POST .../unread`. Wired into `App.tsx`: opening a chat now sends a
   real read receipt (best-effort, never blocks the UI); the chat list gained a hover "mark
   unread" toggle (new `MailIcon`) so unread badges are round-trippable both ways, not just
   reset-on-open.
2. **Peer presence** — `waha.getPresence` → `GET presence/{chatId}`, `waha.subscribePresence` →
   `POST presence/{chatId}/subscribe` (WAHA requires subscribing before presence updates flow
   for a chat). `ChatHeader` now subscribes on chat-open and renders the live
   online/typing/recording/last-seen text (`formatPresence` in `format.ts`) in place of the
   static demo placeholder, for 1:1 chats (group chats keep the "who's in it" text — presence is
   inherently a peer concept).
3. **Send file / send video** — `waha.sendFile` → `POST /api/sendFile`, `waha.sendVideo` →
   `POST /api/sendVideo`. Same `sendGuarded` path as `sendImage` (a file/video send is exactly
   as visible to WhatsApp's abuse detection as any other send). The composer's attach button now
   accepts image *or* video and dispatches by mimetype (mirrors WhatsApp's own "Photos & videos"
   picker); a second new button (document icon) attaches an arbitrary file via `sendFile`.
   `MessageBubble` gained a `video` message type (inline `<video>` player) alongside the
   existing `image`/`file`/`voice` types.
4. **Pin / unpin a message** — `waha.pinMessage` → `POST .../pin` (WhatsApp requires a
   `duration`: 24h/7d/30d — the UI always pins for 24h, matching the "quick win" scope),
   `waha.unpinMessage` → `POST .../unpin`. New pin toggle in the message hover toolbar
   (`MessageActions`, next to react/star) and a "📌 Pinned" badge on pinned bubbles.

All eight: implemented in `backend/src/waha-client.ts` behind `wahaFetch`, routed in
`backend/src/routes/chats.ts` (with `isValidPinDuration` guarding the one endpoint that takes a
constrained body field), and mirrored in `demoApi` so the public demo keeps working with zero
real WAHA calls — including `getPresence`, which derives a plausible online/offline+lastSeen
value from the existing canned `Chat.presence` text rather than being a hardcoded stub.

## Added this job (v5 pass)

Eight endpoints, continuing straight down the previous job's "what's next" list in priority
order — start-new-chat-by-number first (highest product value), then message/chat
moderation, then inbox triage:

1. **Start a new chat by phone number** — `waha.checkNumberExists` → `GET
   contacts/check-exists` (WAHA's real path; the coverage doc used to call this
   `checkNumberStatus`, which doesn't exist as a route — corrected here), `waha.listContacts` →
   `GET contacts/all` (routed, no picker UI yet). Wired into the chat list: typing a
   phone-number-shaped query with no matching chat shows a "Start chat with …" button that
   validates the number and either jumps to the existing chat or seeds a fresh message-less one
   (the first real send is what actually creates it on WAHA's side).
2. **Delete / edit a single message** — `waha.deleteMessage` → `DELETE
   .../messages/{messageId}`, `waha.editMessage` → `PUT .../messages/{messageId}` (WhatsApp's
   own "delete for everyone" / edit-message limits — own messages only, edit is text-only — are
   mirrored client-side as a UX guard; WAHA/WhatsApp still enforce the real constraint
   server-side). New edit/delete buttons in the message hover toolbar (`fromMe` messages only,
   edit only for `type: "text"`); edit opens an inline input in place of the bubble, delete asks
   `window.confirm` first.
3. **Archive / unarchive a chat** — `waha.archiveChat` → `POST .../archive`,
   `waha.unarchiveChat` → `POST .../unarchive`. New "Archived" filter tab in the chat list
   (archived chats are hidden from All/Unread/Groups, same as WhatsApp's own inbox behavior);
   toggle lives in a new dropdown menu on `ChatHeader`'s previously-decorative "more" button.
4. **Delete a chat / clear its messages** — `waha.deleteChat` → `DELETE chats/{chatId}`,
   `waha.clearChatMessages` → `DELETE chats/{chatId}/messages`. Same `ChatHeader` dropdown menu,
   both behind `window.confirm` (no existing modal-dialog component in this codebase, and
   building one just for two confirm prompts would be its own scope creep).

All eight: implemented in `backend/src/waha-client.ts` behind `wahaFetch`, routed in
`backend/src/routes/chats.ts` and a new `backend/src/routes/contacts.ts`, and mirrored in
`demoApi` so the public demo keeps working with zero real WAHA calls. Extracted two shared
validators while touching this code — `isValidText` (send/edit routes) and `isValidPhone`
(contacts route) — with their own unit tests, matching the existing `isValidFile`/
`isValidPinDuration` pattern. 9 new backend tests (31 total, was 22).

## Added this job (v6 pass)

Also moved this pass: **VPS deployment + PIN gate** (single Dockerfile, `deploy/docker-compose.yml`,
`backend/src/access-gate.ts`) — see the README's "Self-hosted deployment" section, not a WAHA
endpoint so it isn't in the table above.

On the feature-gap list, this pass focused on **labels** (top of the previous job's priority
order after the contacts-picker UI, which is deferred again below — see why):

1. **Labels** — `waha.listLabels`/`createLabel`/`updateLabel`/`deleteLabel`/`getChatLabels`/
   `setChatLabels`/`getChatsByLabel`, routed in a new `backend/src/routes/labels.ts`
   (`GET/POST /api/labels`, `PUT/DELETE /api/labels/:id`, `GET /api/labels/:id/chats`,
   `GET/PUT /api/chats/:chatId/labels`). New `LabelsMenu` component (a popover off `ChatHeader`'s
   menu, new "Labels" entry): lists every label with a checkbox to toggle it on the open chat,
   an inline "+ new label" quick-add (name only — `updateLabel`/custom colors have no UI yet,
   see below), and a per-label delete. Mirrored in `demoApi` (`DEMO_LABELS` + a
   chat→label-ids map) so the public demo works with zero real WAHA calls.
2. **Dead code removed** — `waha.listChats()` (the raw, non-overview chat list) had no route/UI
   calling it, flagged as a cleanup in the previous job's report; deleted rather than wired up
   (`chatsOverview` already covers the chat-list product surface).

Implemented behind `wahaFetch` per the established pattern; two new validators
(`isValidLabelName`, `isValidLabelIds`) with their own unit tests. 40 backend tests total (was 31).

**Contacts-picker UI deferred again**: with labels done, this is now the single highest-value
remaining gap (the backend/route — `waha.listContacts`/`GET /api/contacts` — has been ready
since v5). Skipped this pass for the same reason as v5: this job's time went to the VPS+PIN
deployment first (see README), leaving less room for a second UI-heavy feature; better to ship
labels solidly than two features half-done.

## Added this job (v7 pass)

Three things, per this job's brief: verify the VPS deployment isn't still carrying GitHub-Pages
–era shortcuts, add a real-data-backed transparency indicator for message history, and continue
the feature-gap list prioritized by product impact.

**1. Architecture check (VPS vs GitHub Pages)** — audited `Dockerfile`, `backend/src/server.ts`,
`frontend/vite.config.ts`, and `.github/workflows/deploy-pages.yml` end to end. Finding: **no
leftover Pages-era shortcuts**, nothing to fix. Specifically — the backend already serves the SPA
fallback itself (`server.ts`'s `setNotFoundHandler` → `index.html`), which is *better* than the
common GitHub Pages `404.html`-redirect hack (no such file exists in this repo) and only works
*because* it's a real dynamic server; `vite.config.ts`'s `base` path already defaults to `/` and is
only overridden to `/whatsapp-sharp/` inside the Pages workflow's env, so the Docker/VPS build is
unaffected; demo-mode-by-default (`Dockerfile`'s comment, `frontend/src/api.ts`'s `DEMO_MODE`) is a
deliberate safety default carried over on purpose (a stray deploy can never reach a real WAHA
instance), not a technical constraint inherited from Pages — and per this job's own guardrails it
stays that way. Conclusion: the VPS container already is a genuine dynamic backend (Fastify serving
real `/api/*` routes, capable of running against real WAHA if `VITE_DEMO_MODE=false` were ever set),
it's just deliberately running in mock mode.

**2. Message-history transparency** — pulled the *live* WAHA instance's own OpenAPI spec (dashboard
Swagger UI at `/`, not the docs site) to check what `GET /api/{session}/chats/{chatId}/messages`
actually returns: a bare `WAMessage[]` array, no total-count/has-more field of any kind — confirmed
directly from the running instance's schema, not assumed. So the only real (non-guessed) pagination
signal available is "did the count we got back hit the `limit` we asked for." Backend
(`routes/chats.ts`): `GET /api/chats/:chatId/messages` now returns
`{ messages, limit: 100, truncated }`, where `truncated = messages.length >= limit`. Frontend: a
small notice at the top of `ChatThread` — when truncated, "Showing the most recent N messages
loaded from this session — older history exists but wasn't fetched here"; otherwise "N messages
loaded from this session — may not match the full history on your phone" (WAHA/WhatsApp Web
sessions don't always sync full pre-link history, a separate completeness axis from pagination that
a `truncated: false` can't rule out either — the copy says so honestly rather than overclaiming
completeness). Wired through `demoApi` too (`truncated: false` always, since canned threads are
short — an honest reflection of demo data, not a hardcoded claim).

**3. Feature-gap list, by product impact:**

1. **Contacts-picker UI** (highest priority, deferred three passes running) — new `ContactPicker`
   component (self-contained, fetches `waha.listContacts`/`GET /api/contacts`, search-filterable),
   used in two places: the chat list's new "+" button ("New chat" — pick a contact instead of typing
   a raw number; jumps to the existing chat if one exists, matching `handleStartNewChat`'s existing
   number-entry flow, which stays as a fallback), and the composer's new "share a contact" button.
   `DEMO_CONTACTS` added to `demo-data.ts` (mix of contacts that already have a chat and ones that
   don't, so both picker paths are exercised in the demo).
2. **Share a location** — `waha.sendLocation` → `POST /api/sendLocation` (new route
   `POST /api/chats/:chatId/location`, `isValidLatitude`/`isValidLongitude` guard real-world
   coordinate ranges). UI: a composer button using the browser's Geolocation API ("share my current
   location") — no map-search picker yet (that's a bigger UI lift, noted below). New `location`
   message type, rendered as a pin + name linking to OpenStreetMap.
3. **Share a contact card** — `waha.sendContactVcard` → `POST /api/sendContactVcard` (new route
   `POST /api/chats/:chatId/contact`, reuses `ContactPicker` in "share" mode). New `contact` message
   type, rendered as a name/number card.
4. **Label rename/recolor UI** — `updateLabel` was implemented backend-side since the labels pass
   but had no UI. `LabelsMenu` gained an inline edit mode (pencil icon → name input + an 8-swatch
   color palette, save/cancel) — create/assign/delete/rename/recolor are all covered now.

All four: implemented behind `wahaFetch`/routed per the established pattern, mirrored in `demoApi`,
new validators (`isValidLatitude`, `isValidLongitude`, `isValidContactId`) with their own unit
tests. 46 backend tests total (was 40).

**Not done this job** (explicitly out of scope per the brief, not silently skipped): the "Claude
design" pass for a polished UI, and the dynamic/prompt-driven-UI idea — both noted for a future
pass, not yet specified. Also still deferred: `sendVoice` (needs an in-browser recorder — bigger
lift than the other gaps), `sendPoll`/`sendPollVote` (multi-field composer UI), group management UI,
and a Settings screen for profile.

## What's next (highest-value gaps, not done this job)

In rough priority order for a future pass: `sendVoice` (needs an in-browser recorder — the one
remaining "send" gap with real UI weight); a location **search/map picker** (current location-share
only offers "my current position," not "search for an address" — `sendLocation` itself is done, this
is a UI upgrade); `sendPoll`/`sendPollVote` (multi-field composer UI, vote-rendering in
`MessageBubble`); a "filter chat list by label" view on top of the already-implemented
`getChatsByLabel`; group *management* UI (group messaging already works — it's just another
`chatId`); a Settings screen for profile (name/about/avatar); message pagination/infinite scroll
(load older messages past the current 100-message window — would also let a `truncated: true` chat
become "actually complete" on demand instead of just being flagged).
