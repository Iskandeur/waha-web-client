/** Guards against silently binding the HTTP server beyond localhost with no auth in front of
 *  it. Loopback-only is always safe (nothing off-box can reach it). Anything else — most
 *  commonly `0.0.0.0`, to listen on every interface including the public one — is only safe
 *  behind either a PIN (`ACCESS_PIN`, see access-gate.ts) or some other reverse proxy that
 *  itself requires `ACCESS_PIN`. Since we can't detect "there's a proxy in front of me", the
 *  simplest correct rule is: non-loopback bind requires `ACCESS_PIN` to be set, full stop. */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

/** Throws with a clear, actionable message instead of letting the server start wide open. */
export function assertSafeBind(host: string, accessPin: string): void {
  if (isLoopbackHost(host)) return;
  if (accessPin.length > 0) return;
  throw new Error(
    `Refusing to start: HOST="${host}" listens beyond localhost, but ACCESS_PIN is not set. ` +
      `Either leave HOST unset (defaults to 127.0.0.1, put a reverse proxy/tunnel in front) or ` +
      `set ACCESS_PIN so this bind is actually gated.`,
  );
}
