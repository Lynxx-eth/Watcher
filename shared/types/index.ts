/**
 * Data contracts. Every field on a Profile is entered by the profile's
 * own owner through the self-service flow (Phase 6). The admin app can
 * view, edit, suspend or delete profiles but cannot create one.
 */

export type ThreatLevel = "LOW" | "GUARDED" | "ELEVATED" | "HIGH" | "SEVERE";
export type WatchlistStatus = "NONE" | "ACTIVE" | "PENDING" | "CLEARED";
export type BiometricStatus = "ON FILE" | "MATCH FOUND" | "PENDING" | "NOT ON FILE";
export type AccessStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface Biometrics {
  facial: BiometricStatus;
  fingerprint: BiometricStatus;
  iris: BiometricStatus;
  dna: BiometricStatus;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Provider that produced the coordinates, e.g. "nominatim". */
  source: string;
}

export interface Profile {
  projectId: string;
  fullName: string;
  dateOfBirth: string | null; // ISO yyyy-mm-dd
  nationality: string;
  gender: string | null;
  photoUrl: string | null;
  title: string;
  classification: string;
  threatLevel: ThreatLevel;
  watchlistStatus: WatchlistStatus;
  riskScore: number; // 0–100, chosen by owner
  priority: string;
  description: string;
  caseNotes: string[];
  biometrics: Biometrics | null;
  location: {
    country: string;
    region: string | null;
    city: string;
    /** null unless the owner chose to show their full address. */
    address: string | null;
    postalCode: string | null;
    geo: GeoPoint | null; // null = geocoding failed or not attempted
  } | null;
  access: AccessStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  at: string;
  event: string;
  category: string;
  source: string;
  status: "OK" | "WARN" | "FAIL";
}

export interface DayCount {
  day: string;
  sessions: number;
  failures: number;
}

/** Figures derived from the owner's own records. */
export interface ProfileStats {
  linkedRecords: number;
  caseNotes: number;
  biometricsOnFile: number;
  sessions30d: number;
  failures30d: number;
  completeness: number;
  byDay: DayCount[];
  byCategory: Record<string, number>;
}

/* ---------- Admin ---------- */

export interface AdminProfileRow {
  projectId: string;
  fullName: string;
  accessStatus: AccessStatus;
  threatLevel: ThreatLevel;
  watchlistStatus: WatchlistStatus;
  isDemo: boolean;
  locked: boolean;
  lastAccessAt: string | null;
  createdAt: string;
}

export interface AdminProfilePage {
  items: AdminProfileRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminProfile {
  projectId: string;
  fullName: string;
  dateOfBirth: string | null;
  nationality: string;
  gender: string | null;
  hasPhoto: boolean;
  title: string;
  classification: string;
  threatLevel: ThreatLevel;
  watchlistStatus: WatchlistStatus;
  riskScore: number;
  priority: "LOW" | "NORMAL" | "HIGH";
  description: string;
  caseNotes: string[];
  biometrics: Biometrics | null;
  location: {
    country: string;
    region: string | null;
    city: string;
    address: string | null;
    postalCode: string | null;
    showAddress: boolean;
    lat: number | null;
    lon: number | null;
  } | null;
  accessStatus: AccessStatus;
  failedAttempts: number;
  lockedUntil: string | null;
  lastAccessAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  profiles: number;
  active: number;
  suspended: number;
  revoked: number;
  locked: number;
  signIns24h: number;
  failed24h: number;
}

export interface AuditRow {
  at: string;
  actor: string;
  event: string;
  category: string;
  status: "OK" | "WARN" | "FAIL";
  projectId: string | null;
  ip: string | null;
}

/* ---------- Confidential ---------- */

export interface ConfidentialStatus {
  unlocked: boolean;
  expiresAt: string | null;
}

export interface ConfidentialProfile {
  projectId: string;
  fullName: string;
  dateOfBirth: string | null;
  nationality: string;
  gender: string | null;
  photoUrl: string | null;
  title: string;
  classification: string;
  threatLevel: ThreatLevel;
  watchlistStatus: WatchlistStatus;
  riskScore: number;
  description: string;
  caseNotes: string[];
  biometrics: Biometrics | null;
  location: {
    country: string;
    region: string | null;
    city: string;
    address: string | null;
    postalCode: string | null;
    geo: GeoPoint | null;
    geoStatus: "LOCATED" | "PENDING" | "UNAVAILABLE";
  } | null;
  expiresAt: string;
}
