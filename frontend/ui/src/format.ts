import type { BiometricStatus, ThreatLevel, WatchlistStatus } from "@watcher/shared/types";

export type Tone = "info" | "ok" | "warn" | "crit" | "muted";

export const THREAT_LEVELS: ThreatLevel[] = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"];

export function threatTone(t: ThreatLevel): Tone {
  return t === "LOW" ? "ok" : t === "GUARDED" ? "info" : t === "ELEVATED" ? "warn" : "crit";
}

export function watchTone(w: WatchlistStatus): Tone {
  return w === "ACTIVE" ? "crit" : w === "PENDING" ? "warn" : w === "CLEARED" ? "ok" : "muted";
}

export function bioTone(b: BiometricStatus): Tone {
  return b === "MATCH FOUND" || b === "ON FILE" ? "ok" : b === "PENDING" ? "warn" : "muted";
}

export function riskTone(score: number): Tone {
  return score >= 70 ? "crit" : score >= 40 ? "warn" : "ok";
}

export const toneVar: Record<Tone, string> = {
  info: "var(--w-blue)",
  ok: "var(--w-success)",
  warn: "var(--w-warning)",
  crit: "var(--w-critical)",
  muted: "var(--w-muted)",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 10/10/2026 18:32 (UTC) */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 10/10 18:32 (UTC) — compact form for dense tables */
export function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 01 JAN 1990 */
export function fmtDob(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][m - 1];
  return `${pad(d)} ${mon} ${y}`;
}

export function fmtLocation(loc: { city: string; region: string | null; country: string } | null): string {
  if (!loc) return "—";
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ");
}
