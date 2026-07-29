import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import type { Contact, ListSection, MessageButton, OutgoingFile } from "../api.js";
import { ContactPicker } from "./ContactPicker.js";
import { InteractiveComposer } from "./InteractiveComposer.js";
import { LocationPicker } from "./LocationPicker.js";
import { PollComposer } from "./PollComposer.js";
import {
  BarChartIcon,
  FileIcon,
  ListIcon,
  MapPinIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  StopIcon,
  UserIcon,
} from "./icons.js";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function Composer({
  value,
  onChange,
  onSend,
  onSendImage,
  onSendVideo,
  onSendFile,
  onSendVoice,
  onSendPoll,
  onSendLocation,
  onShareContact,
  onSendButtons,
  onSendList,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onSendImage: (file: OutgoingFile) => void;
  onSendVideo: (file: OutgoingFile) => void;
  onSendFile: (file: OutgoingFile) => void;
  onSendVoice: (file: OutgoingFile) => void;
  onSendPoll: (name: string, options: string[], multipleAnswers: boolean) => void;
  onSendLocation: (latitude: number, longitude: number, name?: string) => void;
  onShareContact: (contact: Contact) => void;
  onSendButtons: (body: string, buttons: MessageButton[], footer?: string) => void;
  onSendList: (body: string, buttonText: string, sections: ListSection[], footer?: string) => void;
}) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [interactiveComposerOpen, setInteractiveComposerOpen] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
  }

  // One picker for image + video, dispatched by mimetype — same upload UX WhatsApp itself
  // uses ("Photos & videos" is a single option in its attach menu).
  async function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await blobToBase64(file);
    const outgoing: OutgoingFile = { mimetype: file.type || "image/jpeg", filename: file.name, data };
    if (file.type.startsWith("video/")) onSendVideo(outgoing);
    else onSendImage(outgoing);
  }

  async function handleDocChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await blobToBase64(file);
    onSendFile({ mimetype: file.type || "application/octet-stream", filename: file.name, data });
  }

  // Hold-to-record, release-to-send — mirrors WhatsApp's own mic button. WAHA's `sendVoice`
  // takes a plain mimetype+data file (same `WahaFileInput` shape as sendImage/sendFile), so
  // whatever codec the browser's MediaRecorder produces (webm/opus in Chrome, ogg/opus in
  // Firefox) is sent as-is — no in-browser transcoding pipeline (that's the "bigger lift" the
  // coverage doc flagged; WAHA's own `media/convert/voice` endpoint would be the next step if a
  // target's client turns out to need a specific container).
  async function startRecording() {
    if (recording || !navigator.mediaDevices?.getUserMedia) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setRecordError("Voice recording isn't available in this browser");
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordError(null);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }

  function stopRecording(send: boolean) {
    const recorder = mediaRecorderRef.current;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (!recorder) {
      setRecording(false);
      return;
    }
    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (send && chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const data = await blobToBase64(blob);
        onSendVoice({ mimetype: blob.type || "audio/webm", filename: "voice-message.webm", data });
      }
    };
    recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  if (recording) {
    return (
      <form className="composer composer-recording" onSubmit={(e) => e.preventDefault()}>
        <span className="composer-recording-dot" />
        <span className="composer-recording-time">
          {String(Math.floor(recordSeconds / 60)).padStart(1, "0")}:
          {String(recordSeconds % 60).padStart(2, "0")}
        </span>
        <span className="composer-recording-hint">Recording voice message…</span>
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Cancel recording"
          title="Cancel"
          onClick={() => stopRecording(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="composer-send-btn"
          aria-label="Stop and send"
          title="Stop and send"
          onClick={() => stopRecording(true)}
        >
          <StopIcon size={18} />
        </button>
      </form>
    );
  }

  return (
    <>
      {recordError && <div className="composer-location-error">{recordError}</div>}
      <form className="composer" onSubmit={submit}>
        <button type="button" className="composer-icon-btn" aria-label="Emoji" title="Emoji">
          <SmileIcon size={22} />
        </button>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="composer-file-input"
          onChange={handleMediaChange}
        />
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Attach photo or video"
          title="Attach photo or video"
          onClick={() => mediaInputRef.current?.click()}
        >
          <PaperclipIcon size={21} />
        </button>
        <input
          ref={docInputRef}
          type="file"
          className="composer-file-input"
          onChange={handleDocChange}
        />
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Attach document"
          title="Attach document"
          onClick={() => docInputRef.current?.click()}
        >
          <FileIcon size={19} />
        </button>
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Share your location"
          title="Share your location"
          onClick={() => setLocationPickerOpen(true)}
        >
          <MapPinIcon size={20} />
        </button>
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Create a poll"
          title="Create a poll"
          onClick={() => setPollComposerOpen(true)}
        >
          <BarChartIcon size={20} />
        </button>
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Share a contact"
          title="Share a contact"
          onClick={() => setContactPickerOpen(true)}
        >
          <UserIcon size={20} />
        </button>
        <button
          type="button"
          className="composer-icon-btn"
          aria-label="Send an interactive message"
          title="Send buttons or a list"
          onClick={() => setInteractiveComposerOpen(true)}
        >
          <ListIcon size={20} />
        </button>
        {contactPickerOpen && (
          <ContactPicker
            title="Share a contact"
            onSelect={(contact) => {
              onShareContact(contact);
              setContactPickerOpen(false);
            }}
            onClose={() => setContactPickerOpen(false)}
          />
        )}
        {locationPickerOpen && (
          <LocationPicker
            onSelect={onSendLocation}
            onClose={() => setLocationPickerOpen(false)}
          />
        )}
        {pollComposerOpen && (
          <PollComposer onSubmit={onSendPoll} onClose={() => setPollComposerOpen(false)} />
        )}
        {interactiveComposerOpen && (
          <InteractiveComposer
            onSendButtons={onSendButtons}
            onSendList={onSendList}
            onClose={() => setInteractiveComposerOpen(false)}
          />
        )}
        <input
          className="composer-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type a message"
        />
        <button
          type={value.trim() ? "submit" : "button"}
          className="composer-send-btn"
          aria-label={value.trim() ? "Send" : "Record voice message"}
          title={value.trim() ? "Send" : "Hold to record a voice message"}
          onMouseDown={value.trim() ? undefined : startRecording}
          onMouseUp={value.trim() ? undefined : () => stopRecording(true)}
          onTouchStart={
            value.trim()
              ? undefined
              : (e) => {
                  e.preventDefault();
                  startRecording();
                }
          }
          onTouchEnd={
            value.trim()
              ? undefined
              : (e) => {
                  e.preventDefault();
                  stopRecording(true);
                }
          }
        >
          {value.trim() ? <SendIcon size={20} /> : <MicIcon size={20} />}
        </button>
      </form>
    </>
  );
}
