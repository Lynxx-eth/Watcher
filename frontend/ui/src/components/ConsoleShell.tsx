import type { ReactNode } from "react";
import { NavLink } from "react-router";
import type { NavItem } from "@watcher/shared/constants";
import { FictionBanner } from "./FictionBanner";
import { Logo } from "./Logo";
import { StatusDot } from "./primitives";
import { Backdrop } from "../effects/Backdrop";
import { useClock } from "../hooks/useClock";

export interface StatusItem {
  k: string;
  v: ReactNode;
}

export interface ConsoleShellProps {
  subtitle: string;
  network: string;
  user: string;
  nav: NavItem[];
  status: StatusItem[];
  alert?: ReactNode;
  rightStatus?: ReactNode;
  children: ReactNode;
}

/**
 * Full-viewport console frame: banner → header → nav → content → status bar.
 * Shared by client and admin so both apps read as one product.
 */
export function ConsoleShell({ subtitle, network, user, nav, status, alert, rightStatus, children }: ConsoleShellProps) {
  const { date, time } = useClock();
  return (
    <div className="w-shell">
      <Backdrop beam={false} />
      <FictionBanner />

      <header className="w-shell__header">
        <div className="w-shell__brand">
          <Logo size={34} sub={subtitle} />
        </div>
        <div className="w-shell__net">
          <span className="w-label">Network</span>
          <span className="w-shell__net-v">{network}</span>
        </div>
        <div className="w-shell__meta">
          <div>
            <span className="w-label">User</span> <span className="w-value">{user}</span>
          </div>
          <div className="w-mono-num">
            <span className="w-label">Date</span> <span className="w-value">{date}</span>{" "}
            <span className="w-value">{time}</span>
          </div>
        </div>
        <div className="w-shell__online">
          <StatusDot tone="ok" />
          <span>ONLINE</span>
        </div>
      </header>

      <nav className="w-shell__nav" aria-label="Primary">
        {nav.map((n) => (
          <NavLink key={n.path} to={n.path} end={n.end} className={({ isActive }) => `w-tab${isActive ? " is-active" : ""}`}>
            <span className="w-tab__code">{n.code}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="w-shell__nav-fill" aria-hidden />
      </nav>

      <main className="w-shell__main">{children}</main>

      <footer className="w-shell__status">
        {alert && <div className="w-shell__alert">{alert}</div>}
        <div className="w-shell__status-items">
          {status.map((s, i) => (
            <span key={s.k} className="w-shell__status-item">
              {i > 0 && <span className="w-shell__sep">|</span>}
              <span className="w-label">{s.k}:</span> <span className="w-value">{s.v}</span>
            </span>
          ))}
        </div>
        {rightStatus && <div className="w-shell__status-right">{rightStatus}</div>}
      </footer>
    </div>
  );
}
