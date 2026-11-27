import { Chip, DataRows, fmtDob, fmtLocation, Meter, Panel, riskTone, THREAT_LEVELS, threatTone, toneVar, watchTone } from "@watcher/ui";
import type { Profile } from "@watcher/shared/types";
import { SubjectPhoto } from "./SubjectPhoto";

function ThreatGauge({ level }: { level: Profile["threatLevel"] }) {
  const idx = THREAT_LEVELS.indexOf(level);
  const tone = threatTone(level);
  return (
    <span className="threat">
      <Chip tone={tone} solid>
        {level}
      </Chip>
      <span className="threat__bars" aria-hidden>
        {THREAT_LEVELS.map((l, i) => (
          <i key={l} style={{ background: i <= idx ? toneVar[tone] : undefined }} />
        ))}
      </span>
    </span>
  );
}

export function DossierPanel({ p }: { p: Profile }) {
  return (
    <Panel title={`Subject Dossier — ${p.projectId}`} code="DSR-01">
      <div className="dossier">
        <SubjectPhoto url={p.photoUrl} name={p.fullName} />
        <DataRows
          rows={[
            { k: "Full name", v: <strong className="dossier__name">{p.fullName}</strong> },
            { k: "Title", v: p.title || "—" },
            { k: "Date of birth", v: fmtDob(p.dateOfBirth) },
            { k: "Nationality", v: p.nationality || "—" },
            { k: "Location", v: fmtLocation(p.location) },
            ...(p.location?.address ? [{ k: "Address", v: p.location.address }] : []),
            "rule" as const,
            { k: "Unique ID", v: <span className="w-c-crit dossier__uid">{p.projectId}</span> },
            { k: "Classification", v: p.classification },
            { k: "Threat level", v: <ThreatGauge level={p.threatLevel} /> },
            {
              k: "Watchlist",
              v: (
                <span style={{ color: toneVar[watchTone(p.watchlistStatus)], fontWeight: 600 }}>
                  {p.watchlistStatus}
                </span>
              ),
            },
            {
              k: "Risk score",
              v: (
                <span className="dossier__risk">
                  <span style={{ color: toneVar[riskTone(p.riskScore)] }}>{p.riskScore} / 100</span>
                  <Meter value={p.riskScore} label="Risk score" />
                </span>
              ),
            },
          ]}
        />
      </div>
      <p className="panel-foot">Owner-entered values · simulated scoring</p>
    </Panel>
  );
}
