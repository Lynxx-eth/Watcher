import { createApi } from "@watcher/ui";
import type { ActivityEntry, ConfidentialProfile, ConfidentialStatus, Profile, ProfileStats } from "@watcher/shared/types";

export { ApiError } from "@watcher/ui";

const api = createApi(import.meta.env.VITE_API_URL ?? "/api");

export interface SessionInfo {
  projectId: string;
  displayName: string;
}

/** POST /api/auth/client — sets an httpOnly session cookie on success. */
export function requestAccess(projectId: string, pin: string) {
  return api<SessionInfo>("/auth/client", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, pin }),
  });
}

/** GET /api/auth/me — restores the session after a page reload. */
export function fetchSession() {
  return api<SessionInfo>("/auth/me");
}

export function logout() {
  return api<void>("/auth/logout", { method: "POST" });
}

/** GET /api/profile/me — the signed-in owner's own profile (used from Phase 3). */
export function fetchMyProfile() {
  return api<Profile>("/profile/me");
}

export function fetchMyActivity(days = 30) {
  return api<ActivityEntry[]>(`/profile/me/activity?days=${days}`);
}

export function fetchMyStats() {
  return api<ProfileStats>("/profile/me/stats");
}

export interface EnrollPayload {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  gender: string | null;
  title: string;
  description: string;
  location: { country: string; region: string | null; city: string; address: string | null; postal_code: string | null; show_address: boolean };
  classification: string;
  threat_level: string;
  watchlist_status: string;
  risk_score: number;
  priority: string;
  biometrics: { facial: string; fingerprint: string; iris: string; dna: string };
  case_notes: string[];
  pin: string;
  pin_confirm: string;
  consent_own_profile: boolean;
}

/** POST /api/enroll — creates the owner's profile and signs them in. */
export function enroll(body: EnrollPayload) {
  return api<SessionInfo>("/enroll", { method: "POST", body: JSON.stringify(body) });
}

export function uploadMyPhoto(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<Profile>("/profile/me/photo", { method: "POST", body: fd });
}

/* ---------- Confidential ---------- */

export function unlockConfidential(projectId: string, pin: string) {
  return api<ConfidentialStatus>("/confidential/unlock", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, pin }),
  });
}
export const confidentialStatus = () => api<ConfidentialStatus>("/confidential/status");
export const lockConfidential = () => api<ConfidentialStatus>("/confidential/lock", { method: "POST" });
export const fetchConfidentialProfile = () => api<ConfidentialProfile>("/confidential/profile");
