import { Link } from "react-router";
import { Chip, fmtStamp, threatTone } from "@watcher/ui";
import type { AccessStatus, AdminProfileRow } from "@watcher/shared/types";

export const accessTone = (s: AccessStatus) => (s === "ACTIVE" ? "ok" : s === "SUSPENDED" ? "warn" : "crit");

export function ProfileTable({ rows, empty = "No profiles found." }: { rows: AdminProfileRow[]; empty?: string }) {
  return (
    <table className="a-table">
      <thead>
        <tr>
          <th>Project ID</th>
          <th>Name</th>
          <th>Access</th>
          <th>Threat</th>
          <th>Last access</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="w-c-muted">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.projectId}>
              <td>
                <Link to={`/profiles/${encodeURIComponent(r.projectId)}`} className="a-table__id">
                  {r.projectId}
                </Link>
                {r.isDemo && <span className="a-tag">demo</span>}
              </td>
              <td>{r.fullName}</td>
              <td>
                <Chip tone={accessTone(r.accessStatus)}>{r.accessStatus}</Chip>
                {r.locked && <span className="a-tag a-tag--warn">locked</span>}
              </td>
              <td>
                <Chip tone={threatTone(r.threatLevel)}>{r.threatLevel}</Chip>
              </td>
              <td className="w-mono-num">{r.lastAccessAt ? fmtStamp(r.lastAccessAt) : "—"}</td>
              <td className="w-mono-num">{fmtStamp(r.createdAt)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
