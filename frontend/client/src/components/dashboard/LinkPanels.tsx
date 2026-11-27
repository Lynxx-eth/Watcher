import { Link } from "react-router";
import { DataRows, Meter, Panel } from "@watcher/ui";
import type { Profile, ProfileStats } from "@watcher/shared/types";

export function LinkAnalysisPanel({ stats }: { stats: ProfileStats }) {
  return (
    <Panel title="Link Analysis" code="LNK-02">
      <DataRows
        rows={[
          { k: "Linked records", v: <span className="w-mono-num">{stats.linkedRecords}</span> },
          { k: "Biometrics on file", v: <span className="w-mono-num">{stats.biometricsOnFile} / 4</span> },
          { k: "Sessions (30d)", v: <span className="w-mono-num">{stats.sessions30d}</span> },
          {
            k: "Access anomalies",
            v:
              stats.failures30d > 0 ? (
                <span className="w-c-crit">YES · {stats.failures30d}</span>
              ) : (
                <span className="w-c-ok">NONE</span>
              ),
          },
          { k: "Data correlation", v: <Meter value={stats.completeness} label="Profile completeness" /> },
        ]}
      />
    </Panel>
  );
}

const DocIcon = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
    <path d="M1 1h8l4 4v10H1z" fill="none" stroke="currentColor" />
    <path d="M9 1v4h4M3.5 8h7M3.5 10.5h7M3.5 13h5" stroke="currentColor" />
  </svg>
);

export function RelatedRecordsPanel({ p, stats }: { p: Profile; stats: ProfileStats }) {
  const items = [
    { label: "Identity Record", to: "/console/intelligence", meta: p.classification },
    { label: "Watchlist Record", to: "/console/watchlists", meta: p.watchlistStatus },
    { label: "Activity Trail", to: "/console/operations", meta: `${stats.sessions30d} sessions` },
    { label: "Analytics Digest", to: "/console/analytics", meta: `${stats.completeness}%` },
    { label: "Dossier Report", to: "/console/reports", meta: "print" },
  ];
  return (
    <Panel title="Related Records" code="REC-03" flush>
      <ul className="records">
        {items.map((r) => (
          <li key={r.label}>
            <Link to={r.to}>
              <DocIcon />
              <span className="records__label">
                {p.projectId} — {r.label}
              </span>
              <span className="records__meta">{r.meta}</span>
              <span aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
