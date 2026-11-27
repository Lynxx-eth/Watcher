import { useEffect, useState } from "react";
import { useReducedMotion } from "@watcher/ui";

export interface BootLine {
  text: string;
  tone?: "ok" | "warn";
}

/**
 * Types out terminal lines one by one, then calls onDone.
 * With reduced motion, all lines appear at once.
 */
export function BootSequence({
  lines,
  stepMs = 260,
  onDone,
}: {
  lines: BootLine[];
  stepMs?: number;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? lines.length : 0);

  useEffect(() => {
    if (shown >= lines.length) {
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setShown((n) => n + 1), stepMs);
    return () => window.clearTimeout(id);
    // onDone intentionally excluded: callers pass inline callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, lines.length, stepMs]);

  return (
    <div className="w-term" aria-live="polite">
      {lines.slice(0, shown).map((l, i) => (
        <div key={i}>
          <span className="w-c-muted">[{l.tone === "warn" ? "!" : l.tone === "ok" ? "+" : "*"}]</span>{" "}
          <span className={l.tone === "ok" ? "w-term__ok" : l.tone === "warn" ? "w-term__warn" : undefined}>
            {l.text}
          </span>
        </div>
      ))}
      {shown < lines.length && <span className="w-term__cursor" />}
    </div>
  );
}
