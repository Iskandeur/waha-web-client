import type { MessageStatus } from "../api.js";
import { CheckCheckIcon, CheckIcon } from "./icons.js";

export function StatusTicks({ status }: { status?: MessageStatus }) {
  if (!status || status === "sent") return <CheckIcon size={16} className="ticks" />;
  if (status === "delivered") return <CheckCheckIcon size={16} className="ticks" />;
  return <CheckCheckIcon size={16} className="ticks ticks-read" />;
}
