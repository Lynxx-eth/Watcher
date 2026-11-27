import { createApi } from "@watcher/ui";
import type { AdminOverview, AdminProfile, AdminProfilePage, AuditRow } from "@watcher/shared/types";

export { ApiError } from "@watcher/ui";

const api = createApi(import.meta.env.VITE_API_URL ?? "/api");

export interface AdminSession {
  username: string;
  role: "owner" | "moderator";
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const adminLogin = (username: string, password: string) =>
  api<AdminSession>("/admin/login", { method: "POST", ...json({ username, password }) });
export const adminMe = () => api<AdminSession>("/admin/me");
export const adminLogout = () => api<void>("/admin/logout", { method: "POST" });
export const changePassword = (current_password: string, new_password: string) =>
  api<void>("/admin/me/password", { method: "POST", ...json({ current_password, new_password }) });

export const getOverview = () => api<AdminOverview>("/admin/overview");
export const getAudit = (limit = 100) => api<AuditRow[]>(`/admin/audit?limit=${limit}`);

export function listProfiles(opts: { q?: string; access?: string; page?: number; pageSize?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.access) p.set("access", opts.access);
  p.set("page", String(opts.page ?? 1));
  p.set("page_size", String(opts.pageSize ?? 25));
  return api<AdminProfilePage>(`/admin/profiles?${p}`);
}

const pid = (id: string) => encodeURIComponent(id);

export const getProfile = (id: string) => api<AdminProfile>(`/admin/profiles/${pid(id)}`);
export const updateProfile = (id: string, patch: Record<string, unknown>) =>
  api<AdminProfile>(`/admin/profiles/${pid(id)}`, { method: "PATCH", ...json(patch) });
export const accessAction = (id: string, action: "suspend" | "reactivate" | "revoke" | "unlock") =>
  api<AdminProfile>(`/admin/profiles/${pid(id)}/${action}`, { method: "POST" });
export const resetPin = (id: string) =>
  api<{ projectId: string; newPin: string }>(`/admin/profiles/${pid(id)}/reset-pin`, { method: "POST" });
export const deleteProfile = (id: string) =>
  api<void>(`/admin/profiles/${pid(id)}`, { method: "DELETE", ...json({ confirm: id }) });

export const photoUrl = (id: string, v: string) => `${import.meta.env.VITE_API_URL ?? "/api"}/admin/profiles/${pid(id)}/photo?v=${encodeURIComponent(v)}`;
export function replacePhoto(id: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<AdminProfile>(`/admin/profiles/${pid(id)}/photo`, { method: "PUT", body: fd });
}
export const removePhoto = (id: string) => api<AdminProfile>(`/admin/profiles/${pid(id)}/photo`, { method: "DELETE" });
export const regeocode = (id: string) => api<AdminProfile>(`/admin/profiles/${pid(id)}/geocode`, { method: "POST" });
