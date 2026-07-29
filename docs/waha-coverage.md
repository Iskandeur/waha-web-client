# WAHA API coverage — feature-gap map

Source: the running WAHA instance's own OpenAPI spec (`openapi: 3.1.0`, 138 paths / 195 schemas),
pulled from its Swagger UI bundle. This is the canonical list of what WhatsApp's HTTP API surface
(via WAHA) can do.

**Ambition (as of the v8 pass):** whatsapp-sharp's goal shifted from "parity with the official
WhatsApp client" to **exploiting as much of WAHA's API surface as is reasonably safe to expose**
— including capabilities the official client doesn't offer at all (fine-grained group admin
controls, invite-link management, programmatic membership actions). "Out of scope" below now
means one of three things, and each row says which: **(a) not exposed by WAHA at all** (nothing
to call), **(b) genuinely too high-risk for a public/self-hosted client** (pairing a real
account, session lifecycle, server-stop), or **(c) a deliberate product-surface boundary**
(Channels/Status/Chatwoot are whole other products, not incremental gaps). Every endpoint that
doesn't fall into one of those three stays a live "todo" candidate rather than a permanent no.

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
| `GET /api/sessions/{session}/me` | Session detail / "who am I" | **done (v9 pass)**, no dedicated UI | `waha.getSessionMe`, `GET /api/sessions/me` — wired for future use, same status as `getGroupsCount`/`refreshGroups` (no natural UI slot without a sessions-detail screen this product doesn't have). |
| `GET /api/sessions/{session}` (session detail by name) | Redundant with `.../me` for the single-session client this product is | **superseded** | Only relevant multi-session; this client is always scoped to one session. |
| `POST/PUT/DELETE /api/sessions*`, `start`, `stop`, `logout`, `restart` | Create/mutate/tear down a session | **out of scope** | Session lifecycle mutation is an operational action with real-world side effects (can log a real device out of WhatsApp). Same risk class as auth/pairing — admin-only, not product UI. |

## Profile (own account)

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET profile`, `PUT profile/name`, `PUT profile/status`, `PUT/DELETE profile/picture` | Settings screen (view/edit my name, about, avatar) | **done (v8 pass)** | `waha.getProfile`/`setProfileName`/`setProfileStatus`/`setProfilePicture`/`deleteProfilePicture`, routed in new `backend/src/routes/profile.ts`. New `SettingsPanel` component (gear icon in the sidebar). Note: WAHA's `MyProfile` schema has no "about" field to read back — `status` is write-only from the API's own perspective, so the Settings screen doesn't pretend to show a current value it can't fetch. |

## Sending messages

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST /api/sendText` (+`GET` variant) | Send text | **done** | `routes/chats.ts`, via `waha.sendText` (typing simulation + full send-guard). |
| `POST /api/sendImage` | Send an image | **done** | New `waha.sendImage`. |
| `PUT /api/reaction` | React to a message with an emoji | **done** | New `waha.setReaction`. |
| `PUT /api/star` | Star / unstar a message | **done** | New `waha.setStar`. |
| `POST /api/sendFile` | Send an arbitrary file/document | **done** | New `waha.sendFile`. |
| `POST /api/sendVoice` | Send a voice note | **done (v9 pass)** | New `waha.sendVoice`; in-browser `MediaRecorder` (hold-to-record on the mic button, mirrors WhatsApp's own press-and-hold), sent as whatever codec the browser produces (webm/opus in Chrome, ogg/opus in Firefox) — no transcoding pipeline through `media/convert/voice` yet, see "Not done this job" below. |
| `POST /api/sendVideo` | Send a video | **done** | New `waha.sendVideo`. |
| `POST /api/sendLocation` | Share a location (lat/lng pin) | **done (v7 pass)**, search picker added **(v9 pass)** | `waha.sendLocation` unchanged since v7; new `LocationPicker` component adds an address/place search (Nominatim/OpenStreetMap geocoding, a browser-side call — same "works identically in demo or real mode" pattern as the Geolocation API) alongside the existing "share my current position" button. This is the "carte" gap: picking an arbitrary searched-for place, not just your own GPS position. |
| `POST /api/sendContactVcard` | Share a contact card | **done (this job)** | New `waha.sendContactVcard`; reuses the new contacts picker — see below. |
| `POST /api/sendPoll`, `POST /api/sendPollVote` | Create/vote on a poll | **done (v9 pass)** | New `waha.sendPoll`/`waha.sendPollVote`; new `PollComposer` modal (question + 2-12 options + multiple-answers toggle) off the composer's new bar-chart button, and a `poll` message type in `MessageBubble` with per-option vote counts and click-to-vote. |
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
| `GET contacts`, `GET contacts/{id}` (session-scoped) | Single-contact lookup | todo | Only useful once there's a contact-detail panel UI to call it from — no such panel exists yet (only the picker list). |
| `GET contacts/about` | Contact's "about" text | **done (v9 pass)**, no dedicated UI | `waha.getContactAbout`, `GET /api/contacts/about?contactId=` — wired for future use; no contact-detail panel to show it in yet (see `GET contacts/{id}` above, same gap). |
| `GET contacts/profile-picture` | Contact avatar (non-chat-scoped variant) | **superseded** | Covered by the chat-scoped `chats/{chatId}/picture` we implemented this job — for a 1:1 DM, `chatId` *is* the contact's JID, so one endpoint serves both. |
| `POST contacts/block`, `POST contacts/unblock` | Block/unblock a contact | **done (v9 pass)** | `waha.blockContact`/`unblockContact`, routed in `contacts.ts`; new "Block contact"/"Unblock contact" entry in `ChatHeader`'s menu (1:1 chats only). **Honesty note**: WAHA exposes no "is this contact blocked" getter, so `Chat.isBlocked` only ever reflects a toggle made from this client this session — it does not reflect real blocked status fetched from WhatsApp, same category of gap as the profile "about" field being write-only. |
| `PUT contacts/{chatId}` | Create/update a contact | todo | Low priority; not core to a messaging-first client. |

## Lids (WhatsApp "linked ID" identity layer)

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `GET lids`, `GET lids/count`, `GET lids/{lid}`, `GET lids/pn/{phoneNumber}` | Resolve WhatsApp's newer privacy-preserving IDs ↔ phone numbers | **out of scope** | Internal identity-resolution plumbing; only matters if we start doing raw phone-number lookups ourselves, which we don't yet. |

## Groups

| Endpoints | Feature | Status | Why |
|---|---|---|---|
| `POST/GET groups`, `join-info`, `join`, `count`, `refresh`, `GET/DELETE groups/{id}`, `leave`, picture get/set/delete, `description`, `subject`, admin-only settings (get/set ×2), invite-code get/revoke, participants (`v2`) get/add/remove, admin promote/demote | Full group management (create, membership, admin controls, invite links, security settings) | **done (v8 pass)** | Every group endpoint WAHA exposes is now wired — see "Added this job (v8 pass)" below. Group *messaging* already worked (WAHA treats a group as just another `chatId`), this closes the *management* gap: create/join/leave/delete a group, edit subject/description/photo, admin-only info/messages toggles, invite-link show/regenerate, and full participant/role management (add, remove, promote, demote) from a new `GroupPanel`. |
| `GET groups` (legacy, non-`v2`) `.../participants` | Legacy participants list | **superseded** | `.../participants/v2` returns richer per-participant data (`role` enum, `@lid`/`pn` id forms) — same relationship as `listChats`→`chatsOverview`, so only `v2` is wired. |
| `GET groups/count` | Count of groups | wired, no dedicated UI | `waha.getGroupsCount`/route exist; not surfaced in the UI (the group list itself, via the existing "Groups" chat-list filter, already answers "how many" visually) — low value to duplicate as a number. |
| `POST groups/refresh` | Force-resync group cache from the server | wired, no dedicated UI | Same reasoning — an operator/debug affordance more than a product one; the route exists (`POST /api/groups/refresh`) for scripted/future use. |

## Communities

WhatsApp Communities (a parent container that groups several sub-groups together) have **no
dedicated endpoints in WAHA's API** — verified directly against the live instance's own OpenAPI
spec (the same one this whole doc is sourced from): no `communit*` path exists anywhere in its
138 paths. WAHA's `groups` endpoints don't expose a community/parent-group relationship either
(no `isCommunity`/`parentGroupId`-style field in `GroupParticipant`/group response schemas
checked). Conclusion: **out of scope, not by product choice but because there's nothing to
call** — this isn't a "todo," it's a hard API ceiling. If WAHA adds community support in a
future version, revisit.

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

## Added this job (v8 pass)

Brief (verbatim, paraphrased): stop targeting parity with the official WhatsApp client and
instead exploit as much of WAHA's API surface as is safe to expose — including admin/power-user
capabilities the official client doesn't have — with groups/communities/account settings as the
priority order, and the anti-detection guard extended (never bypassed) to cover any new bulk
action.

**1. Communities** — investigated first, per the brief. **Not exposed by WAHA at all**: no
`communit*` path anywhere in the live instance's 138-path OpenAPI spec, and no
community/parent-group field on the `groups`/`GroupParticipant` schemas either. Documented as a
hard API ceiling (see "Communities" section above), not a deferred todo — there's nothing to
build against yet.

**2. Groups — full management surface (23 operations, every group endpoint WAHA exposes):**
`waha.listGroups`/`createGroup`/`getGroupsCount`/`refreshGroups`/`getGroupJoinInfo`/`joinGroup`/
`getGroup`/`deleteGroup`/`leaveGroup`/`getGroupPicture`/`setGroupPicture`/`deleteGroupPicture`/
`setGroupSubject`/`setGroupDescription`/`getGroupInfoAdminOnly`/`setGroupInfoAdminOnly`/
`getGroupMessagesAdminOnly`/`setGroupMessagesAdminOnly`/`getGroupInviteCode`/
`revokeGroupInviteCode`/`getGroupParticipants`/`addGroupParticipants`/`removeGroupParticipants`/
`promoteGroupParticipants`/`demoteGroupParticipants` — all in `backend/src/waha-client.ts`, routed
in a new `backend/src/routes/groups.ts` (`/api/groups/*`, 23 endpoints), mirrored in `demoApi`.
Frontend: a new `GroupPanel` (opened from `ChatHeader`'s menu for group chats) covers photo
upload/remove, inline subject/description edit, invite-link show/copy/regenerate, the two
admin-only security toggles, and a participant list with promote/demote/remove per-row plus an
"Add participants" flow (reuses `ContactPicker`, extended with a new multi-select mode). A new
`NewGroupFlow` (multi-select contacts → name → create) and `JoinGroupModal` (paste a link/code,
preview via `join-info`, then join) hang off a new dropdown on the sidebar's "+" button.
**This is explicitly the "beyond the official client" case the brief called out**: per-group
"only admins can edit info" / "only admins can send" toggles and one-click invite-link
regeneration are both real WhatsApp features, but neither has a first-class control in the
official mobile/desktop client the way this panel exposes them.

**3. Anti-detection guard extended to group actions** — `addGroupParticipants`/
`removeGroupParticipants`/`promoteGroupParticipants`/`demoteGroupParticipants` are bulk,
scriptable membership mutations, i.e. the same abuse-detection signature the send-guard exists to
slow down for messages. Rather than let them fire straight through `wahaFetch` uncapped (or,
worse, bypass the guard "to move faster" per this job's explicit instruction not to), added a new
sibling guard (`backend/src/guard/group-guard.ts`, `evaluateGroupAction`/`recordGroupAction`) with
its own ceilings: a per-call participant-count cap (`GUARD_GROUP_MAX_PARTICIPANTS_PER_CALL`,
default 20), a per-group and global per-minute/per-hour rate limit, and the same jittered delay
`send-guard` uses — all env-tunable via `guard/config.ts`, all still gated by the shared circuit
breaker. Wired into `waha-client.ts` via a new `groupActionGuarded` helper (mirrors `sendGuarded`'s
shape) and a new `"group"` `GuardActionKind` in the audit log, so every group call — reads and
mutations alike — is still logged the same way sends/presence calls already were. 7 new tests in
`group-guard.test.ts` cover the cap, both rate limits, and the circuit-breaker interaction.

**4. Profile / account settings** — `waha.getProfile`/`setProfileName`/`setProfileStatus`/
`setProfilePicture`/`deleteProfilePicture`, routed in a new `backend/src/routes/profile.ts`
(`/api/profile*`). Frontend: a new `SettingsPanel` (gear icon in the sidebar) — avatar
upload/remove, inline name edit, an "About" field (write-only per WAHA's own `MyProfile` schema,
so the UI doesn't pretend to show a value it can't fetch), and the read-only WhatsApp number.

All new backend surface: implemented behind `wahaFetch`/routed per the established pattern,
mirrored in `demoApi` (new `DEMO_PROFILE`, `DEMO_GROUP_PARTICIPANTS`/`_DESCRIPTIONS`/`_SETTINGS`/
`_INVITE_CODES` in `demo-data.ts`) so the public demo still makes zero real WAHA calls. New
validators (`isValidGroupName`, `isValidGroupDescription`, `isValidParticipantIds`,
`isValidAdminsOnly`, `isValidInviteCode` in `groups.ts`; `isValidProfileName`/
`isValidProfileStatus` in `profile.ts`) with their own unit tests. **69 backend tests total (was
46)**. VPS deployment re-verified live at the end of this pass (PIN gate still active, no
container/config changes needed — see the job report).

**Not done this job** (still open, not silently skipped — the brief said "don't force finishing
everything at once"): `sendVoice` (in-browser recorder), `sendPoll`/`sendPollVote` (multi-field
composer UI), a location search/map picker, a "filter chat list by label" view, message
pagination/infinite scroll, and the `GET groups/count`/`POST groups/refresh` endpoints, which are
wired backend-side but have no dedicated UI (see the Groups table above for why they're low-value
to surface as their own controls right now).

## Added this job (v9 pass)

Brief (verbatim, paraphrased): close the remaining gap — voice notes, polls, and "carte" (a
location search/map picker, distinct from the current-position-only share already done in v7) —
then keep going down the exploit-the-API-surface list if time allows.

**1. Voice notes** — `waha.sendVoice` → `POST /api/sendVoice` (same `WahaFileInput` shape and
`sendGuarded` path as `sendImage`/`sendFile`), routed as `POST /api/chats/:chatId/voice`. Frontend:
the composer's mic button is now a real **hold-to-record** control (`MediaRecorder`, mirrors
WhatsApp's own press-and-hold — mouse and touch both wired, with a live recording indicator/timer
and a cancel option) instead of the inert icon-swap it was before. `MessageBubble`'s `voice` case
now renders a real `<audio controls>` player when a `mediaUrl` is present (same "real vs.
placeholder" split `image`/`video` already use), replacing the non-functional play-button stub.
**Known limitation, stated plainly**: the recorded clip is sent as whatever codec the browser's
`MediaRecorder` produces (webm/opus in Chrome, ogg/opus in Firefox) with no in-browser transcoding
— WAHA's own `media/convert/voice` endpoint would be the next step if a target client turns out to
need a specific container; that's the "bigger lift" the previous passes' coverage table flagged,
deliberately not built this pass (untestable from here without a live WAHA instance to verify the
accepted format against).

**2. Polls** — `waha.sendPoll`/`waha.sendPollVote` → `POST /api/sendPoll`/`POST
/api/sendPollVote`, routed as `POST /api/chats/:chatId/poll` and `POST
/api/chats/:chatId/messages/:messageId/poll-vote`. New validators `isValidPollName`/
`isValidPollOptions` (WhatsApp's real 2-12 option limit) /`isValidVotes`, each with unit tests.
Frontend: a new `PollComposer` modal (question + dynamic option list, add/remove, multiple-answers
checkbox) off a new bar-chart composer button; a new `poll` message type in `MessageBubble` with
per-option vote counts and click-to-vote. **Honesty note**: WAHA gives vote *events*, not a
server-computed tally, so counting is a client concern (`pollOptions[].votes`, mirrored in
`demoApi`); the UI has no notion of "my own JID" without an extra profile fetch per bubble, so which
options *you personally* selected is tracked as local UI state, not derived from the vote list —
the vote *counts* themselves still reflect real server/demo state after every reload.

**3. Location search/map picker ("carte")** — the gap distinguished in this job's brief from the
existing current-position-only share (done in v7, unchanged). New `LocationPicker` component adds
an address/place search using Nominatim (OpenStreetMap's public geocoding API), called directly
from the browser — same "works identically in demo or real mode" precedent the Geolocation API
already set (neither touches WAHA/the backend, so there's nothing to mock per-mode). Selecting a
result calls the same `waha.sendLocation` unchanged since v7. No API key needed, results capped at
6 per query out of courtesy to the free public service.

**4. Continuing the "exploit the API surface" list** — three more low-risk, single-endpoint gaps
closed while time allowed:
   - `GET sessions/{session}/me` (session detail) — `waha.getSessionMe`, routed, no dedicated UI
     (no natural slot without a sessions-detail screen this single-session client doesn't have —
     same status as `getGroupsCount`/`refreshGroups`).
   - `GET contacts/about` — `waha.getContactAbout`, routed, no dedicated UI (same reasoning: no
     contact-detail panel exists yet to show it in).
   - `POST contacts/block`/`unblock` — `waha.blockContact`/`unblockContact`, routed, **and** wired
     to a real UI control this time (a "Block contact"/"Unblock contact" entry in `ChatHeader`'s
     menu, 1:1 chats only). Honesty note: WAHA exposes no "is this contact blocked" getter, so
     `Chat.isBlocked` only ever reflects a toggle made from this client this session, not a real
     fetched status — same category of gap as the profile "about" field being write-only.

All new backend surface: implemented behind `wahaFetch`/routed per the established pattern,
mirrored in `demoApi`. New validators (`isValidPollName`, `isValidPollOptions`, `isValidVotes`)
have their own unit tests; the block/unblock/about routes reuse the existing `isValidContactId`
rather than duplicating it. **76 backend tests total (was 69)**.

## What's next (highest-value gaps, not done this job)

With voice/poll/map closed this pass, the remaining gaps are smaller and more scattered — no
single "big three" left. In rough priority order: a **contact-detail panel** (the missing UI slot
that would finally give `GET contacts/{id}`/`GET contacts/about` somewhere to render, and let
`isBlocked` show real status if WAHA ever exposes a getter); a "filter chat list by label" view on
top of the already-implemented `getChatsByLabel`; message pagination/infinite scroll (load older
messages past the current 100-message window); voice-note transcoding via `media/convert/voice`
(only matters if a real deployment hits a client that rejects the browser's native webm/ogg
output); `sendButtons`/`sendList` (WhatsApp Business–style interactive messages, niche for a
personal client); `forwardMessage` (needs a chat picker); `sendSeen` (overlaps chat-level
`messages/read`); rich link previews (`sendLinkPreview`/`link-custom-preview`); the batch `POST
chats/overview` variant; `PUT contacts/{chatId}` (create/update a contact); and the
session-wide presence set/batch-read (`POST presence`/`GET presence`, as opposed to the per-chat
presence already implemented). Communities and the various infra/admin-only endpoints
(sessions lifecycle, API keys, Chatwoot, screenshot/debug, server/stop) stay permanently out of
scope for the reasons stated in their own sections above — not a priority-ordering choice.

**Coverage milestone**: as of this pass, every endpoint in WAHA's 138-path OpenAPI spec has been
individually triaged into **done**, **todo** (a real, worth-building gap), or **out of scope**
(with a stated reason: not exposed, too high-risk, or a deliberate product boundary) — nothing is
unaccounted for. The remaining **todo** list above is short and each item is small; there is no
more "undiscovered" surface left to map.
