import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fmtLocation, useReducedMotion } from "@watcher/ui";
import { useProfileData } from "../hooks/useProfileData";
import { DossierPanel } from "../components/dashboard/DossierPanel";
import { LinkAnalysisPanel, RelatedRecordsPanel } from "../components/dashboard/LinkPanels";
import { ActivityPanel, BiometricPanel, CaseNotesPanel } from "../components/dashboard/LowerPanels";
import { GlobePanel } from "../components/dashboard/GlobePanel";
import "./DashboardPage.css";

function Enter({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.07 * i, type: "spring", stiffness: 150, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardPage() {
  const { profile: p, stats, activity, loading, error } = useProfileData();

  if (loading && !p) {
    return <div className="dash-state w-label">Decrypting profile record…</div>;
  }
  if (!p || !stats) {
    return <div className="dash-state w-c-crit">{error ?? "PROFILE UNAVAILABLE"}</div>;
  }

  return (
    <div className="dash">
      <Enter i={0} className="dash__dossier">
        <DossierPanel p={p} />
      </Enter>

      <div className="dash__links">
        <Enter i={1}>
          <LinkAnalysisPanel stats={stats} />
        </Enter>
        <Enter i={2}>
          <RelatedRecordsPanel p={p} stats={stats} />
        </Enter>
      </div>

      <Enter i={3} className="dash__globe">
        <GlobePanel subjectLabel={fmtLocation(p.location)} />
      </Enter>

      <Enter i={4} className="dash__bio">
        <BiometricPanel p={p} />
      </Enter>
      <Enter i={5} className="dash__log">
        <ActivityPanel entries={activity} />
      </Enter>
      <Enter i={6} className="dash__notes">
        <CaseNotesPanel p={p} />
      </Enter>
    </div>
  );
}
