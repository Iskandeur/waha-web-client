import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUTTONS_MAX,
  isValidButtons,
  isValidContactId,
  isValidFile,
  isValidLatitude,
  isValidListSections,
  isValidLongitude,
  isValidOffset,
  isValidPinDuration,
  isValidPollName,
  isValidPollOptions,
  isValidText,
  isValidVotes,
  PIN_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
} from "./chats.js";

test("isValidFile accepts a remote-URL file (mimetype + url)", () => {
  assert.equal(isValidFile({ mimetype: "image/jpeg", url: "https://example.com/x.jpg" }), true);
});

test("isValidFile accepts an inline base64 file (mimetype + data)", () => {
  assert.equal(isValidFile({ mimetype: "image/png", data: "aGVsbG8=" }), true);
});

test("isValidFile rejects a file with neither url nor data", () => {
  assert.equal(isValidFile({ mimetype: "image/png" }), false);
});

test("isValidFile rejects a file missing mimetype", () => {
  assert.equal(isValidFile({ url: "https://example.com/x.jpg" }), false);
});

test("isValidFile rejects non-object input", () => {
  assert.equal(isValidFile("not-a-file"), false);
  assert.equal(isValidFile(null), false);
  assert.equal(isValidFile(undefined), false);
});

test("isValidFile accepts a generic document mimetype (sendFile reuses the same shape)", () => {
  assert.equal(isValidFile({ mimetype: "application/pdf", url: "https://example.com/x.pdf" }), true);
});

test("isValidFile accepts a video mimetype (sendVideo reuses the same shape)", () => {
  assert.equal(isValidFile({ mimetype: "video/mp4", data: "aGVsbG8=" }), true);
});

test("isValidPinDuration accepts the three WhatsApp-supported durations", () => {
  for (const d of PIN_DURATIONS) {
    assert.equal(isValidPinDuration(d), true);
  }
});

test("isValidPinDuration rejects an arbitrary number of seconds", () => {
  assert.equal(isValidPinDuration(3600), false);
});

test("isValidPinDuration rejects non-number input", () => {
  assert.equal(isValidPinDuration("86400"), false);
  assert.equal(isValidPinDuration(null), false);
  assert.equal(isValidPinDuration(undefined), false);
});

test("isValidText accepts non-empty text (shared by send + edit routes)", () => {
  assert.equal(isValidText("hello"), true);
});

test("isValidText rejects empty or whitespace-only text", () => {
  assert.equal(isValidText(""), false);
  assert.equal(isValidText("   "), false);
});

test("isValidText rejects non-string input", () => {
  assert.equal(isValidText(null), false);
  assert.equal(isValidText(undefined), false);
  assert.equal(isValidText(42), false);
});

test("isValidLatitude accepts values within [-90, 90]", () => {
  assert.equal(isValidLatitude(0), true);
  assert.equal(isValidLatitude(-90), true);
  assert.equal(isValidLatitude(90), true);
  assert.equal(isValidLatitude(38.8937255), true);
});

test("isValidLatitude rejects out-of-range or non-number input", () => {
  assert.equal(isValidLatitude(90.1), false);
  assert.equal(isValidLatitude(-90.1), false);
  assert.equal(isValidLatitude(NaN), false);
  assert.equal(isValidLatitude("38.9"), false);
  assert.equal(isValidLatitude(null), false);
});

test("isValidLongitude accepts values within [-180, 180]", () => {
  assert.equal(isValidLongitude(0), true);
  assert.equal(isValidLongitude(-180), true);
  assert.equal(isValidLongitude(180), true);
  assert.equal(isValidLongitude(-77.0969763), true);
});

test("isValidLongitude rejects out-of-range or non-number input", () => {
  assert.equal(isValidLongitude(180.1), false);
  assert.equal(isValidLongitude(-180.1), false);
  assert.equal(isValidLongitude(Infinity), false);
  assert.equal(isValidLongitude("−77"), false);
});

test("isValidContactId accepts a non-empty chat JID", () => {
  assert.equal(isValidContactId("123456789@c.us"), true);
});

test("isValidContactId rejects empty/whitespace-only or non-string input", () => {
  assert.equal(isValidContactId(""), false);
  assert.equal(isValidContactId("   "), false);
  assert.equal(isValidContactId(null), false);
  assert.equal(isValidContactId(undefined), false);
});

test("isValidPollName accepts non-empty text", () => {
  assert.equal(isValidPollName("Where should we eat?"), true);
});

test("isValidPollName rejects empty/whitespace-only or non-string input", () => {
  assert.equal(isValidPollName(""), false);
  assert.equal(isValidPollName("   "), false);
  assert.equal(isValidPollName(null), false);
  assert.equal(isValidPollName(undefined), false);
});

test("isValidPollOptions accepts an array within the 2-12 WhatsApp option limit", () => {
  assert.equal(isValidPollOptions(["Ramen", "Pizza"]), true);
  assert.equal(isValidPollOptions(Array.from({ length: POLL_MAX_OPTIONS }, (_, i) => `opt${i}`)), true);
});

test("isValidPollOptions rejects too few, too many, or non-string entries", () => {
  assert.equal(isValidPollOptions(["Only one"]), false);
  assert.equal(
    isValidPollOptions(Array.from({ length: POLL_MAX_OPTIONS + 1 }, (_, i) => `opt${i}`)),
    false,
  );
  assert.equal(isValidPollOptions(["Ramen", ""]), false);
  assert.equal(isValidPollOptions(["Ramen", 42]), false);
  assert.equal(isValidPollOptions("not-an-array"), false);
  assert.equal(isValidPollOptions(null), false);
});

test("isValidPollOptions boundary: exactly POLL_MIN_OPTIONS/POLL_MAX_OPTIONS", () => {
  assert.equal(POLL_MIN_OPTIONS, 2);
  assert.equal(POLL_MAX_OPTIONS, 12);
});

test("isValidVotes accepts an array of option strings, including empty (retract)", () => {
  assert.equal(isValidVotes([]), true);
  assert.equal(isValidVotes(["Ramen"]), true);
});

test("isValidVotes rejects non-array or non-string entries", () => {
  assert.equal(isValidVotes("Ramen"), false);
  assert.equal(isValidVotes([42]), false);
  assert.equal(isValidVotes(null), false);
  assert.equal(isValidVotes(undefined), false);
});

test("isValidOffset accepts zero and positive integers", () => {
  assert.equal(isValidOffset(0), true);
  assert.equal(isValidOffset(100), true);
  assert.equal(isValidOffset(1), true);
});

test("isValidOffset rejects negative, non-integer, or non-number input", () => {
  assert.equal(isValidOffset(-1), false);
  assert.equal(isValidOffset(1.5), false);
  assert.equal(isValidOffset(NaN), false);
  assert.equal(isValidOffset("100"), false);
  assert.equal(isValidOffset(null), false);
  assert.equal(isValidOffset(undefined), false);
});

test("isValidButtons accepts 1-3 buttons with a non-empty id and text", () => {
  assert.equal(isValidButtons([{ id: "yes", text: "Yes" }]), true);
  assert.equal(
    isValidButtons([
      { id: "yes", text: "Yes" },
      { id: "no", text: "No" },
      { id: "maybe", text: "Maybe" },
    ]),
    true,
  );
  assert.equal(BUTTONS_MAX, 3);
});

test("isValidButtons rejects too few, too many, or malformed entries", () => {
  assert.equal(isValidButtons([]), false);
  assert.equal(
    isValidButtons([
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
      { id: "d", text: "D" },
    ]),
    false,
  );
  assert.equal(isValidButtons([{ id: "", text: "Yes" }]), false);
  assert.equal(isValidButtons([{ id: "yes", text: "" }]), false);
  assert.equal(isValidButtons([{ text: "Yes" }]), false);
  assert.equal(isValidButtons("not-an-array"), false);
  assert.equal(isValidButtons(null), false);
});

test("isValidListSections accepts a non-empty section with a non-empty row", () => {
  assert.equal(
    isValidListSections([{ title: "Options", rows: [{ rowId: "a", title: "Option A" }] }]),
    true,
  );
  assert.equal(
    isValidListSections([
      { title: "Options", rows: [{ rowId: "a", title: "Option A", description: "desc" }] },
    ]),
    true,
  );
});

test("isValidListSections rejects empty sections/rows or malformed entries", () => {
  assert.equal(isValidListSections([]), false);
  assert.equal(isValidListSections([{ title: "Options", rows: [] }]), false);
  assert.equal(isValidListSections([{ title: "", rows: [{ rowId: "a", title: "A" }] }]), false);
  assert.equal(isValidListSections([{ title: "Options", rows: [{ title: "A" }] }]), false);
  assert.equal(isValidListSections("not-an-array"), false);
  assert.equal(isValidListSections(null), false);
});
