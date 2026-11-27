import { bioTone, fmtShort, fmtStamp, Panel, toneVar, watchTone } from "@watcher/ui";
import type { ActivityEntry, BiometricStatus, Profile } from "@watcher/shared/types";
import { SubjectPhoto } from "./SubjectPhoto";

const BIO_ROWS: Array<[keyof NonNullable<Profile["biometrics"]>, string]> = [
  ["facial", "Facial recognition"],
  ["fingerprint", "Fingerprints"],
  ["iris", "Iris scan"],
  ["dna", "DNA profile"],
];

function BioValue({ v }: { v: BiometricStatus }) {
  const tone = bioTone(v);
  return (
    <span style={{ color: toneVar[tone] }}>
      {v} {tone === "ok" ? "✓" : tone === "warn" ? "…" : ""}
    </span>
  );
}

export function BiometricPanel({ p }: { p: Profile }) {
  return (
    <Panel title="Biometric Data" code="BIO-05">
      <div className="bio">
        <SubjectPhoto url={p.photoUrl} name={p.fullName} variant="scan" />
        <div className="w-rows">
          {BIO_ROWS.map(([key, label]) => (
            <div key={key} style={{ display: "contents" }}>
              <div className="w-rows__k">{label}</div>
              <div className="w-rows__v">{p.biometrics ? <BioValue v={p.biometrics[key]} /> : "—"}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="panel-foot">Display statuses only · no biometric data is collected</p>
    </Panel>
  );
}

export function ActivityPanel({ entries, limit = 6, compact = true }: { entries: ActivityEntry[]; limit?: number; compact?: boolean }) {
  return (
    <Panel title="Activity Log (Last 30 Days)" code="LOG-06" flush>
      <table className={`log-table${compact ? " log-table--compact" : ""}`}>
        <thead>
          <tr>
            <th>Date / time</th>
            <th>Event</th>
            {!compact && <th>Category</th>}
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={compact ? 4 : 5} className="w-c-muted">
                No activity recorded.
              </td>
            </tr>
          ) : (
            entries.slice(0, limit).map((e, i) => (
              <tr key={`${e.at}-${i}`}>
                <td className="w-mono-num">{compact ? fmtShort(e.at) : fmtStamp(e.at)}</td>
                <td>{e.event}</td>
                {!compact && <td className="w-c-muted">{e.category}</td>}
                <td className="w-c-muted">{e.source}</td>
                <td className={e.status === "OK" ? "w-c-ok" : e.status === "WARN" ? "w-c-warn" : "w-c-crit"}>
                  {e.status}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Panel>
  );
}

export function CaseNotesPanel({ p }: { p: Profile }) {
  return (
    <Panel title="Case Notes" code="NTE-07">
      <div className="notes">
        {p.description && <p className="notes__lead">{p.description}</p>}
        {p.caseNotes.length > 0 ? (
          <ul>
            {p.caseNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="w-c-muted">No notes added.</p>
        )}
        <p className="notes__status">
          Status:{" "}
          <span style={{ color: toneVar[watchTone(p.watchlistStatus)] }}>
            Watchlist {p.watchlistStatus} · {p.classification}
          </span>
        </p>
        <p className="w-c-muted notes__meta">Last updated: {fmtStamp(p.updatedAt)} UTC</p>
      </div>
    </Panel>
  );
}
