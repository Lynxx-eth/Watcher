import { createApi } from "@watcher/ui";

export { ApiError } from "@watcher/ui";

const api = createApi(import.meta.env.VITE_API_URL ?? "/api");

export interface SessionInfo {
  projectId: string;
  displayName: string;
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

/** POST /api/enroll — creates the owner's profile. */
export function enroll(body: EnrollPayload) {
  return api<SessionInfo>("/enroll", { method: "POST", body: JSON.stringify(body) });
}

/** Optional photo upload right after creation (uses the session the enrol response set). */
export function uploadMyPhoto(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<unknown>("/profile/me/photo", { method: "POST", body: fd });
}

/** Where to send people to sign in (the main website). */
export const MAIN_SITE_URL = import.meta.env.VITE_MAIN_URL ?? "http://localhost:5173";
