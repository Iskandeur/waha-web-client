export { guardConfig } from "./config.js";
export { circuitBreaker } from "./circuit-breaker.js";
export { auditLog } from "./audit-log.js";
export type { GuardActionKind, GuardDecisionKind, GuardLogEntry } from "./audit-log.js";
export {
  evaluateSend,
  recordSendAttempt,
  typingDurationMs,
  sendGuardStatus,
  __resetSendGuardForTests,
} from "./send-guard.js";
export type { SendGuardDecision } from "./send-guard.js";
