import { Outlet, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ConsoleShell, StatusDot, TechButton, toneVar, useReducedMotion, watchTone } from "@watcher/ui";
import { CLIENT_NAV, PRODUCT } from "@watcher/shared/constants";
import { useSession } from "../hooks/useSession";
import { ProfileDataProvider, useProfileData } from "../hooks/useProfileData";

export function ConsoleLayout() {
  return (
    <ProfileDataProvider>
      <ConsoleFrame />
    </ProfileDataProvider>
  );
}

function ConsoleFrame() {
  const { session, signOut } = useSession();
  const { profile: p, error, lastSync } = useProfileData();
  const loc = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const alert =
    p && p.watchlistStatus !== "NONE" ? (
      <>
        <span aria-hidden>▲</span> Watchlist · {p.watchlistStatus}
      </>
    ) : undefined;

  return (
    <ConsoleShell
      subtitle={PRODUCT.clientTitle}
      network="SECURE CHANNEL // SIMULATED ENVIRONMENT"
      user={session ? `${session.displayName} · ${session.projectId}` : "—"}
      nav={CLIENT_NAV}
      alert={alert}
      status={[
        { k: "Project", v: session?.projectId ?? "—" },
        {
          k: "System",
          v: error ? <span className="w-c-warn">SYNC ERROR</span> : <span className="w-c-ok">NOMINAL</span>,
        },
        {
          k: "Priority",
          v: p ? <span style={{ color: p.priority === "HIGH" ? toneVar.crit : undefined }}>{p.priority}</span> : "—",
        },
        {
          k: "Classification",
          v: p ? <span style={{ color: toneVar[watchTone(p.watchlistStatus)] }}>{p.classification}</span> : "—",
        },
        {
          k: "Synced",
          v: lastSync ? lastSync.toISOString().slice(11, 19) + " UTC" : "—",
        },
      ]}
      rightStatus={
        <span style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
          <StatusDot tone={error ? "warn" : "ok"} />
          <span className="w-label">Connection: {error ? "degraded" : "secure"}</span>
          <TechButton
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </TechButton>
        </span>
      }
    >
      <motion.div
        key={loc.pathname}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: "100%" }}
      >
        <Outlet />
      </motion.div>
    </ConsoleShell>
  );
}
