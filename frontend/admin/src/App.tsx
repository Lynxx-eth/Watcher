import { Link, Route, Routes } from "react-router";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminLayout } from "./pages/AdminPages";
import { OverviewPage } from "./pages/OverviewPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ProfileDetailPage } from "./pages/ProfileDetailPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { RequireAdmin } from "./session";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path="profiles/:projectId" element={<ProfileDetailPage />} />
        <Route path="access" element={<ProfilesPage key="access" title="Profile Access — Suspended" accessFilter="SUSPENDED" />} />
        <Route path="reports" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={
          <div style={{ padding: 40 }}>
            <p className="w-c-crit">404 · ROUTE NOT FOUND</p>
            <Link to="/">Back to overview</Link>
          </div>
        }
      />
    </Routes>
  );
}
