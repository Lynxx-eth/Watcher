import { Outlet, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ConsoleShell, TechButton, useReducedMotion } from "@watcher/ui";
import { ADMIN_NAV, PRODUCT } from "@watcher/shared/constants";
import { useAdminSession } from "../session";

export function AdminLayout() {
  const { session, signOut } = useAdminSession();
  const loc = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  return (
    <ConsoleShell
      subtitle={PRODUCT.adminTitle}
      network="ADMIN CHANNEL // RESTRICTED"
      user={session ? `${session.username} (${session.role})` : "—"}
      nav={ADMIN_NAV}
      status={[
        { k: "Role", v: session?.role ?? "—" },
        { k: "Backend", v: <span className="w-c-ok">CONNECTED</span> },
        { k: "Build", v: PRODUCT.build },
      ]}
      rightStatus={
        <TechButton
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
        >
          Logout
        </TechButton>
      }
    >
      <motion.div
        key={loc.pathname}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Outlet />
      </motion.div>
    </ConsoleShell>
  );
}
