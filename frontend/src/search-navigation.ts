/** Search navigation may request a target before its chat history has arrived. The visual
 *  highlight lifecycle must not start until the target is actually in the loaded page. */
export function containsMessageId(
  messages: ReadonlyArray<{ id: string }>,
  targetId?: string | null,
): boolean {
  return Boolean(targetId) && messages.some((message) => message.id === targetId);
}
