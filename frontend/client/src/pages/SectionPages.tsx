import { Suspense, lazy, type ReactNode } from "react";
import { Chip, DataRows, fmtDob, fmtLocation, fmtStamp, Meter, Panel, riskTone, TechButton, THREAT_LEVELS, threatTone, toneVar, watchTone } from "@watcher/ui";
import type { Profile, ProfileStats } from "@watcher/shared/types";
import { useProfileData } from "../hooks/useProfileData";
import { ActivityPanel, BiometricPanel, CaseNotesPanel } from "../components/dashboard/LowerPanels";
import { DossierPanel } from "../components/dashboard/DossierPanel";
import { LinkAnalysisPanel } from "../components/dashboard/LinkPanels";
import "./SectionPages.css";

// Recharts is only downloaded when the Analytics tab is opened.
const AnalyticsCharts = lazy(() =>
  import("../components/dashboard/AnalyticsCharts").then((m) => ({ default: m.AnalyticsCharts })),
);

/** Renders children only once the owner's profile + stats have loaded. */
function WithProfile({ children }: { children: (p: Profile, s: ProfileStats) => ReactNode }) {
  const { profile, stats, error } = useProfileData();
  if (!profile || !stats) {
    return <div className="dash-state w-label">{error ?? "Decrypting profile record…"}</div>;
  }
  return <>{children(profile, stats)}</>;
}

export function IntelligencePage() {
  return (
    <WithProfile>
      {(p, s) => (
        <div className="sect sect--2-1">
          <DossierPanel p={p} />
          <div className="sect__col">
            <Panel title="Intelligence Summary" code="IN-01">
              <p className="sect__lead">{p.description || "No summary written yet."}</p>
              <DataRows
                rows={[
                  { k: "Title", v: p.title || "—" },
                  { k: "Gender", v: p.gender || "—" },
                  { k: "Born", v: fmtDob(p.dateOfBirth) },
                  { k: "Region", v: fmtLocation(p.location) },
                  { k: "Record created", v: `${fmtStamp(p.createdAt)} UTC` },
                ]}
              />
            </Panel>
            <LinkAnalysisPanel stats={s} />
          </div>
        </div>
      )}
    </WithProfile>
  );
}

export function WatchlistsPage() {
  return (
    <WithProfile>
      {(p) => {
        const idx = THREAT_LEVELS.indexOf(p.threatLevel);
        return (
          <div className="sect sect--1-1">
            <Panel title="Watchlist Status" code="WL-01" alert={p.watchlistStatus === "ACTIVE"}>
              <div className="wl-hero" style={{ color: toneVar[watchTone(p.watchlistStatus)] }}>
                {p.watchlistStatus}
              </div>
              <DataRows
                rows={[
                  { k: "Subject", v: p.fullName },
                  { k: "Project ID", v: p.projectId },
                  { k: "Classification", v: p.classification },
                  { k: "Priority", v: p.priority },
                ]}
              />
              <p className="panel-foot">Status chosen by the profile owner · fictional display</p>
            </Panel>
            <Panel title="Threat Matrix" code="WL-02">
              <div className="matrix">
                {THREAT_LEVELS.map((l, i) => (
                  <div key={l} className={`matrix__row${i === idx ? " is-on" : ""}`}>
                    <span className="matrix__lvl" style={{ color: i <= idx ? toneVar[threatTone(l)] : undefined }}>
                      {l}
                    </span>
                    <span className="matrix__bar" style={{ background: i <= idx ? toneVar[threatTone(l)] : undefined }} />
                    {i === idx && <Chip tone={threatTone(l)}>Current</Chip>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="w-label" style={{ marginBottom: 6 }}>
                  Risk score <span style={{ color: toneVar[riskTone(p.riskScore)] }}>{p.riskScore} / 100</span>
                </div>
                <Meter value={p.riskScore} label="Risk score" />
              </div>
            </Panel>
          </div>
        );
      }}
    </WithProfile>
  );
}

export function OperationsPage() {
  const { activity } = useProfileData();
  return (
    <WithProfile>
      {(p, s) => (
        <div className="sect sect--2-1">
          <ActivityPanel entries={activity} limit={50} compact={false} />
          <div className="sect__col">
            <Panel title="Operations Feed" code="OP-01">
              <DataRows
                rows={[
                  { k: "Sessions (30d)", v: s.sessions30d },
                  { k: "Failed attempts", v: <span className={s.failures30d ? "w-c-crit" : "w-c-ok"}>{s.failures30d}</span> },
                  ...Object.entries(s.byCategory).map(([k, v]) => ({ k: `${k} events`, v })),
                ]}
              />
            </Panel>
            <CaseNotesPanel p={p} />
          </div>
        </div>
      )}
    </WithProfile>
  );
}

export function AnalyticsPage() {
  return (
    <WithProfile>
      {(p, s) => (
        <div className="sect sect--2-1">
          <Panel title="Access Activity — 14 Days" code="AN-01">
            <Suspense fallback={<div className="w-label">Loading charts…</div>}>
              <AnalyticsCharts stats={s} />
            </Suspense>
          </Panel>
          <div className="sect__col">
            <Panel title="Profile Integrity" code="AN-02">
              <DataRows
                rows={[
                  { k: "Completeness", v: <Meter value={s.completeness} label="Completeness" /> },
                  { k: "Biometrics", v: <Meter value={s.biometricsOnFile} max={4} label="Biometrics on file" /> },
                  { k: "Risk score", v: <Meter value={p.riskScore} label="Risk score" /> },
                ]}
              />
            </Panel>
            <BiometricPanel p={p} />
          </div>
        </div>
      )}
    </WithProfile>
  );
}

export function ReportsPage() {
  return (
    <WithProfile>
      {(p, s) => (
        <div className="report">
          <div className="report__bar no-print">
            <span className="w-label">Dossier report · {p.projectId}</span>
            <TechButton size="sm" onClick={() => window.print()}>
              Print / save PDF
            </TechButton>
          </div>
          <div className="report__sheet">
            <header className="report__head">
              <strong>WATCHER · DOSSIER REPORT</strong>
              <span>
                {p.projectId} · generated {fmtStamp(new Date().toISOString())} UTC
              </span>
            </header>
            <p className="report__notice">
              Fictional entertainment document. All values were entered by the profile owner; all scores are simulated.
            </p>
            <DataRows
              rows={[
                { k: "Full name", v: p.fullName },
                { k: "Date of birth", v: fmtDob(p.dateOfBirth) },
                { k: "Nationality", v: p.nationality || "—" },
                { k: "Location", v: fmtLocation(p.location) },
                { k: "Classification", v: p.classification },
                { k: "Threat level", v: p.threatLevel },
                { k: "Watchlist", v: p.watchlistStatus },
                { k: "Risk score", v: `${p.riskScore} / 100` },
                { k: "Priority", v: p.priority },
                "rule",
                { k: "Sessions (30d)", v: s.sessions30d },
                { k: "Completeness", v: `${s.completeness}%` },
              ]}
            />
            {p.caseNotes.length > 0 && (
              <>
                <h3 className="report__h">Case notes</h3>
                <ul>
                  {p.caseNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </WithProfile>
  );
}
