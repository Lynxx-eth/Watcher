import { Link } from "react-router";
import { Backdrop } from "@watcher/ui";

export function NotFoundPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Backdrop />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div className="w-c-crit" style={{ fontFamily: "var(--w-font-display)", fontSize: 28, letterSpacing: "0.2em" }}>
          404 · ROUTE NOT FOUND
        </div>
        <p className="w-c-muted">The requested node does not exist.</p>
        <Link to="/login">Return to access terminal</Link>
      </div>
    </div>
  );
}
