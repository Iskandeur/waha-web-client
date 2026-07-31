import { useEffect, useState } from "react";
import { api, type GuardStatus } from "../api.js";

const POLL_MS = 30_000;

function formatUntil(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Small breathing status dot for the anti-detection guard (`GET /api/guard/status`) — lets a
 *  human glance at "is it safe to send right now" without grepping backend logs. Read-only and
 *  self-polling, same self-contained pattern as `LabelFilter`/`LabelsMenu`. */
export function GuardIndicator() {
  const [status, setStatus] = useState<GuardStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .getGuardStatus()
        .then((s) => !cancelled && setStatus(s))
        .catch(() => undefined);
    }
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!status) return null;

  const dotClass = status.circuitBreaker.open
    ? "guard-dot guard-dot-open"
    : status.warmingUp
      ? "guard-dot guard-dot-warming"
      : "guard-dot";

  const title = status.circuitBreaker.open
    ? "Guard: circuit breaker open"
    : status.warmingUp
      ? "Guard: warming up"
      : "Guard: healthy";

  return (
    <div className="guard-indicator">
      <button
        type="button"
        className="guard-dot-btn"
        aria-label={title}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={dotClass} />
      </button>
      {open && (
        <div className="guard-popover" onClick={(e) => e.stopPropagation()}>
          <div className="guard-popover-title">
            <span className={dotClass} />
            <span>{title}</span>
          </div>
          <div className="guard-popover-body">
            {status.circuitBreaker.open ? (
              <>
                Blocking every WAHA call after {status.circuitBreaker.recentFailures} recent
                failures.
                {status.circuitBreaker.openUntil && (
                  <> Reopens around {formatUntil(status.circuitBreaker.openUntil)}.</>
                )}
              </>
            ) : status.warmingUp ? (
              <>
                Send limits are stricter until {formatUntil(status.warmupEndsAt)} — a freshly
                started session runs slower on purpose.
              </>
            ) : (
              <>Rate limits, jitter and typing simulation are active. Circuit breaker closed.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
