import { DataRows, Panel, StatusDot } from "@watcher/ui";
import { getAudit, getOverview, listProfiles } from "../services/api";
import { useAsync } from "../components/useAsync";
import { ProfileTable } from "../components/ProfileTable";
import { AuditTable } from "./AuditPage";

export function OverviewPage() {
  const ov = useAsync(getOverview, []);
  const recent = useAsync(() => listProfiles({ pageSize: 6 }), []);
  const audit = useAsync(() => getAudit(8), []);
  const o = ov.data;

  const tiles: Array<[string, number | undefined, "info" | "ok" | "warn" | "crit"]> = [
    ["Profiles", o?.profiles, "info"],
    ["Active", o?.active, "ok"],
    ["Suspended", o?.suspended, "warn"],
    ["Revoked", o?.revoked, "crit"],
    ["Locked out", o?.locked, "warn"],
    ["Sign-ins (24h)", o?.signIns24h, "info"],
    ["Failed (24h)", o?.failed24h, "crit"],
  ];

  return (
    <div className="a-stack">
      <div className="a-tiles">
        {tiles.map(([k, v, tone]) => (
          <Panel key={k} title={k} tools={<StatusDot tone={tone} pulse={false} />}>
            <div className="a-tile__num w-mono-num">{v ?? "—"}</div>
          </Panel>
        ))}
      </div>
      <div className="a-split">
        <Panel title="Recent Profiles" code="OV-01" flush>
          <ProfileTable rows={recent.data?.items ?? []} empty={recent.error ?? "No profiles yet."} />
        </Panel>
        <Panel title="Audit Log" code="OV-02" flush>
          <AuditTable rows={audit.data ?? []} compact />
        </Panel>
      </div>
      <Panel title="How profiles are created" code="POLICY">
        <DataRows
          rows={[
            { k: "Creation", v: "Owners create their own profile in the client app (/enroll)" },
            { k: "Admin can", v: "View · edit on owner request · suspend · reactivate · revoke · reset PIN · delete" },
            { k: "Admin cannot", v: "Create a profile on someone else's behalf" },
          ]}
        />
      </Panel>
    </div>
  );
}
