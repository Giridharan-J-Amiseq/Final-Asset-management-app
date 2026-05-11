/**
 * Button wrapper that opens a custom confirmation dialog.
 */

import { useId, useState } from "react";

import { Button } from "./Button";

export function ConfirmButton({ confirmText = "Confirm", danger = false, onConfirm, children }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const closeDialog = () => setOpen(false);
  const handleConfirm = () => {
    closeDialog();
    onConfirm?.();
  };

  return (
    <>
      <Button variant={danger ? "danger" : "secondary"} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeDialog} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div id={titleId} className="text-sm font-semibold text-slate-900">
              Confirm action
            </div>
            <div className="mt-2 text-sm text-slate-600">{confirmText}</div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm}>
                {danger ? "Confirm" : "OK"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}