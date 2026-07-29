/** Sliding-window hit counter, keyed by an arbitrary string so one instance can track several
 *  independent windows (e.g. "per chat" and "per hour") at once. */
export class SlidingWindowCounter {
  private hits = new Map<string, number[]>();

  record(key: string, now: number): void {
    const arr = this.hits.get(key);
    if (arr) arr.push(now);
    else this.hits.set(key, [now]);
  }

  /** Counts hits within `windowMs` of `now`, pruning older entries for this key as a side effect. */
  count(key: string, now: number, windowMs: number): number {
    const arr = this.hits.get(key);
    if (!arr) return 0;
    const cutoff = now - windowMs;
    let start = 0;
    while (start < arr.length && arr[start] < cutoff) start++;
    if (start > 0) arr.splice(0, start);
    return arr.length;
  }

  clear(): void {
    this.hits.clear();
  }
}
