/** Constants shared by the client app, admin app and (mirrored) backend. */

export const PRODUCT = {
  name: "WATCHER",
  clientTitle: "Intelligence Operations Centre",
  adminTitle: "Profile Administration",
  version: "0.11.0",
  build: "PHASE-11",
} as const;

/** Shown on every page of both apps. Kept short enough to fit one line on desktop. */
export const FICTION_NOTICE =
  "Fictional entertainment experience · Self-created profiles · Not affiliated with any government agency · All scans and scores are simulated";

export const PALETTE = {
  bg: "#020711",
  bg2: "#06111F",
  panel: "#071625",
  blue: "#00BFFF",
  cyan: "#00E5FF",
  border: "rgba(0, 190, 255, 0.35)",
  text: "#DCEBFF",
  muted: "#8297B2",
  warning: "#FFB52E",
  critical: "#FF304F",
  success: "#29E58C",
} as const;

export interface NavItem {
  path: string;
  label: string;
  code: string;
  /** Match only the exact path (used for index routes). */
  end?: boolean;
}

export const CLIENT_NAV: NavItem[] = [
  { path: "/console", label: "Databases", code: "DB", end: true },
  { path: "/console/intelligence", label: "Intelligence", code: "IN" },
  { path: "/console/watchlists", label: "Watchlists", code: "WL" },
  { path: "/console/operations", label: "Operations", code: "OP" },
  { path: "/console/analytics", label: "Analytics", code: "AN" },
  { path: "/console/reports", label: "Reports", code: "RP" },
  { path: "/console/confidential", label: "Confidential Access", code: "CA" },
];

export const ADMIN_NAV: NavItem[] = [
  { path: "/", label: "Overview", code: "OV", end: true },
  { path: "/profiles", label: "All Profiles", code: "AP" },
  { path: "/access", label: "Profile Access", code: "PA" },
  { path: "/reports", label: "Reports", code: "RP" },
  { path: "/settings", label: "Settings", code: "ST" },
];

/** Project IDs are random 12-digit numbers, generated server-side. */
export const PROJECT_ID_PATTERN = /^\d{12}$/;
export const PROJECT_ID_PLACEHOLDER = "000000000000";
export const DEMO_PROJECT_ID = "demo-0000";
