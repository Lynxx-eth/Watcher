import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TechButton, TechInput } from "@watcher/ui";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** If set, the user must type this exact text to enable the confirm button. */
  typeToConfirm?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, typeToConfirm, danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Depends on `open` only, so parent re-renders don't wipe what the user typed.
  useEffect(() => {
    if (!open) return;
    setTyped("");
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancelRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ok = !typeToConfirm || typed === typeToConfirm;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="dlg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dlg-title"
            className={`dlg${danger ? " dlg--danger" : ""}`}
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dlg-title" className="dlg__title">
              {title}
            </h2>
            <div className="dlg__body">{body}</div>
            {typeToConfirm && (
              <TechInput
                label={`Type ${typeToConfirm} to confirm`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            )}
            <div className="dlg__actions">
              <TechButton ref={cancelRef} variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </TechButton>
              <TechButton variant={danger ? "danger" : "primary"} size="sm" disabled={!ok || busy} onClick={onConfirm}>
                {busy ? "Working…" : confirmLabel}
              </TechButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
