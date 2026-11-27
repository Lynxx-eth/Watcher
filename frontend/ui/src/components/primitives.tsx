import type { ComponentProps, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

type Tone = "info" | "ok" | "warn" | "crit" | "muted";

const toneColor: Record<Tone, string> = {
  info: "var(--w-blue)",
  ok: "var(--w-success)",
  warn: "var(--w-warning)",
  crit: "var(--w-critical)",
  muted: "var(--w-muted)",
};

/* ---------- Panel ---------- */
export interface PanelProps {
  title: string;
  code?: string;
  tools?: ReactNode;
  flush?: boolean;
  alert?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, code, tools, flush, alert, className = "", children }: PanelProps) {
  const cls = ["w-panel", flush && "w-panel--flush", alert && "w-panel--alert", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls} aria-label={title}>
      <header className="w-panel__head">
        <h2 className="w-panel__title" style={{ margin: 0 }}>
          {title}
        </h2>
        {code && <span className="w-panel__code">{code}</span>}
        <div className="w-panel__tools" aria-hidden={tools ? undefined : true}>
          {tools ?? (
            <>
              <span>▫</span>
              <span>✕</span>
            </>
          )}
        </div>
      </header>
      <div className="w-panel__body">{children}</div>
    </section>
  );
}

/* ---------- Label / value rows ---------- */
export interface DataRow {
  k: string;
  v: ReactNode;
}

export function DataRows({ rows }: { rows: Array<DataRow | "rule"> }) {
  return (
    <div className="w-rows">
      {rows.map((r, i) =>
        r === "rule" ? (
          <div className="w-rows__rule" key={`rule-${i}`} />
        ) : (
          <div key={r.k} style={{ display: "contents" }}>
            <div className="w-rows__k">{r.k}</div>
            <div className="w-rows__v">{r.v}</div>
          </div>
        ),
      )}
    </div>
  );
}

/* ---------- Status dot ---------- */
export function StatusDot({ tone = "ok", pulse = true }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={`w-dot${pulse ? " w-dot--pulse" : ""}`}
      style={{ color: toneColor[tone] }}
      aria-hidden
    />
  );
}

/* ---------- Chip ---------- */
export function Chip({ tone = "info", solid, children }: { tone?: Tone; solid?: boolean; children: ReactNode }) {
  return <span className={`w-chip w-chip--${tone}${solid ? " w-chip--solid" : ""}`}>{children}</span>;
}

/* ---------- Meter ---------- */
export function Meter({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="w-meter__track">
        <div className="w-meter__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-meter__val">{Math.round(pct)}%</span>
    </div>
  );
}

/* ---------- Button ---------- */
/** ComponentProps includes `ref` (React 19 passes refs as ordinary props). */
export interface TechButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  block?: boolean;
}

export function TechButton({ variant = "primary", size = "md", block, className = "", ...rest }: TechButtonProps) {
  const cls = [
    "w-btn",
    variant !== "primary" && `w-btn--${variant}`,
    size === "sm" && "w-btn--sm",
    block && "w-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...rest} />;
}

/* ---------- Input ---------- */
export interface TechInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TechInput({ label, hint, error, id, ...rest }: TechInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="w-field">
      <label className="w-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="w-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-err`} className="w-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="w-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Honest placeholder for work scheduled in a later phase ---------- */
export function Pending({ phase, what }: { phase: number; what: string }) {
  return (
    <div className="w-pending">
      <strong>{what}</strong>
      <span>Scheduled · Phase {phase}</span>
    </div>
  );
}
