import { guardConfig } from "./config.js";

export type GuardActionKind = "read" | "send" | "presence";
export type GuardDecisionKind = "allowed" | "delayed" | "blocked";

export interface GuardLogEntry {
  ts: number;
  kind: GuardActionKind;
  session: string;
  chatId?: string;
  decision: GuardDecisionKind;
  reason: string;
  delayMs?: number;
}

/** Every decision the guard makes — allow, delay, or block, and why — lands here, so the
 *  guard's behavior is auditable after the fact instead of only visible in the moment. */
class AuditLog {
  private entries: GuardLogEntry[] = [];

  push(entry: GuardLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > guardConfig.auditLogMaxEntries) {
      this.entries.splice(0, this.entries.length - guardConfig.auditLogMaxEntries);
    }
  }

  recent(limit = 100): GuardLogEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }
}

export const auditLog = new AuditLog();
