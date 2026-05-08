/**
 * Button wrapper that asks for confirmation via `window.confirm`.
 *
 * Used for actions that should be hard to click accidentally (e.g. status changes).
 */

import { Button } from "./Button";

export function ConfirmButton({ confirmText = "Confirm", danger = false, onConfirm, children }) {
  return (
    <Button
      variant={danger ? "danger" : "secondary"}
      onClick={() => {
        if (window.confirm(confirmText)) {
          onConfirm?.();
        }
      }}
    >
      {children}
    </Button>
  );
}