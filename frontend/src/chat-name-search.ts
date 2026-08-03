/** WAHA occasionally returns a null chat name despite its nominal API shape. Keep local
 *  filtering defensive so typing into the shared chat/message search cannot crash the UI. */
export function chatNameMatches(name: unknown, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return typeof name === "string" && name.toLowerCase().includes(normalizedQuery);
}
