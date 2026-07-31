import { useEffect } from "react";

/** Closes a dialog/panel/popover on Escape — shared by every overlay that already closes on a
 *  backdrop click (`GroupPanel`, `ContactPicker`, `PollComposer`, ...), so the keyboard path
 *  matches the mouse one instead of only half the close affordances working. */
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}
