import { guardConfig } from "./config.js";

/** Trips when WAHA returns errors/instability repeatedly, and blocks every WAHA call (reads
 *  included) for a cooldown period rather than letting the backend keep insisting into a
 *  failing or rate-limited session. */
class CircuitBreaker {
  private failureTimestamps: number[] = [];
  private openUntil = 0;

  isOpen(now: number): boolean {
    return now < this.openUntil;
  }

  recordSuccess(_now: number): void {
    // A success doesn't erase failure history (a single lucky call after a wobble shouldn't
    // reset the breaker's memory) — it just doesn't add to it. The failure window naturally
    // ages out failures via recordFailure's pruning.
  }

  recordFailure(now: number): void {
    this.failureTimestamps.push(now);
    const cutoff = now - guardConfig.circuitBreakerWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter((ts) => ts >= cutoff);
    if (this.failureTimestamps.length >= guardConfig.circuitBreakerErrorThreshold) {
      this.openUntil = now + guardConfig.circuitBreakerCooldownMs;
    }
  }

  status(now: number) {
    return {
      open: this.isOpen(now),
      openUntil: this.openUntil || null,
      recentFailures: this.failureTimestamps.length,
    };
  }

  reset(): void {
    this.failureTimestamps = [];
    this.openUntil = 0;
  }
}

export const circuitBreaker = new CircuitBreaker();
