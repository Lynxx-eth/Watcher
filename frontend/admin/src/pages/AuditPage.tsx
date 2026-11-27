import { Panel, TechButton, fmtStamp } from "@watcher/ui";
import type { AuditRow } from "@watcher/shared/types";
import { getAudit } from "../services/api";
import { useAsync } from "../components/useAsync";

export function AuditTable({ rows, compact }: { rows: AuditRow[]; compact?: boolean }) {
  return (
    <table className="a-table">
      <thead>
        <tr>
          <th>Time (UTC)</th>
          <th>Actor</th>
          <th>Event</th>
          {!compact && <th>Profile</th>}
          {!compact && <th>IP</th>}
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={compact ? 4 : 6} className="w-c-muted">
              No events.
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={`${r.at}-${i}`}>
              <td className="w-mono-num">{fmtStamp(r.at)}</td>
              <td className="w-c-muted">{r.actor}</td>
              <td>{r.event}</td>
              {!compact && <td>{r.projectId ?? "—"}</td>}
              {!compact && <td className="w-c-muted">{r.ip ?? "—"}</td>}
              <td className={r.status === "OK" ? "w-c-ok" : r.status === "WARN" ? "w-c-warn" : "w-c-crit"}>{r.status}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function AuditPage() {
  const { data, error, reload, loading } = useAsync(() => getAudit(300), []);
  return (
    <Panel
      title="Audit Log"
      code="RP-01"
      flush
      tools={
        <TechButton size="sm" variant="ghost" onClick={() => void reload()} disabled={loading}>
          Refresh
        </TechButton>
      }
    >
      {error ? <p className="w-c-crit" style={{ padding: 12 }}>{error}</p> : <AuditTable rows={data ?? []} />}
    </Panel>
  );
}
