import { useState } from "react";

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

  async function submit(e: React.FormEvent) {
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

  return (
    <form className="command-bar" onSubmit={submit}>
      <input
        className="command-bar-input"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder='Ask AI: "summarize this thread", "draft a friendly reply"…'
      />
      <button type="submit" disabled={loading}>
        {loading ? "Thinking…" : "Ask"}
      </button>
      {error && <div className="command-bar-error">{error}</div>}
    </form>
  );
}
