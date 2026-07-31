import { useEffect, useState, type FormEvent } from "react";
import { useEscapeToClose } from "../useEscapeToClose.js";

/** The AI powerbar: free-text instructions ("summarize this thread", "draft a
 *  friendly reply", "what did they say about the trip?") run through the
 *  backend's /api/ai/command (claude -p). The result is always a suggestion —
 *  it's rendered for the user to copy into the composer, never auto-sent. */
export function CommandBar({
  onResult,
  run,
}: {
  onResult: (suggestion: string) => void;
  run: (instruction: string) => Promise<{ suggestion: string }>;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // "/" opens the bar from anywhere except when it would swallow a "/" the user is actually
  // typing somewhere else (any focused input/textarea) or when it's already open.
  useEffect(() => {
    if (open) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEscapeToClose(() => setOpen(false));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { suggestion } = await run(instruction);
      onResult(suggestion);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="command-bar-toggle" onClick={() => setOpen(true)}>
        <span className="command-bar-mark">#</span> Ask AI about this chat
      </button>
    );
  }

  return (
    <form className="command-bar" onSubmit={submit}>
      <span className="command-bar-icon command-bar-mark">#</span>
      <input
        autoFocus
        className="command-bar-input"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder='"summarize this thread", "draft a friendly reply"…'
        onBlur={() => !instruction && setOpen(false)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Thinking…" : "Ask"}
      </button>
      {error && <div className="command-bar-error">{error}</div>}
    </form>
  );
}
