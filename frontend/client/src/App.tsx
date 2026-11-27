import { Navigate, Route, Routes } from "react-router";
import { ConsoleLayout } from "./layouts/ConsoleLayout";
import { RequireSession } from "./hooks/useSession";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AnalyticsPage, IntelligencePage, OperationsPage, ReportsPage, WatchlistsPage } from "./pages/SectionPages";
import { NotFoundPage } from "./pages/MiscPages";
import { ConfidentialGatePage } from "./pages/ConfidentialGatePage";
import { ConfidentialPage } from "./pages/ConfidentialPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/console"
        element={
          <RequireSession>
            <ConsoleLayout />
          </RequireSession>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="intelligence" element={<IntelligencePage />} />
        <Route path="watchlists" element={<WatchlistsPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="confidential" element={<ConfidentialGatePage />} />
      </Route>

      {/* Full-screen confidential environment; the server refuses its data unless unlocked. */}
      <Route
        path="/confidential"
        element={
          <RequireSession>
            <ConfidentialPage />
          </RequireSession>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
