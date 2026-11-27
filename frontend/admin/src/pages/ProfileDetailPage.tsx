import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chip, DataRows, Panel, TechButton, TechInput, fmtStamp, threatTone } from "@watcher/ui";
import type { AdminProfile, BiometricStatus } from "@watcher/shared/types";
import { ApiError, accessAction, deleteProfile, getProfile, photoUrl, regeocode, removePhoto, replacePhoto, resetPin, updateProfile } from "../services/api";
import { useAsync } from "../components/useAsync";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { accessTone } from "../components/ProfileTable";
import { useAdminSession } from "../session";

const THREATS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"] as const;
const WATCH = ["NONE", "ACTIVE", "PENDING", "CLEARED"] as const;
const PRIORITY = ["LOW", "NORMAL", "HIGH"] as const;
const BIO: BiometricStatus[] = ["ON FILE", "MATCH FOUND", "PENDING", "NOT ON FILE"];

type Action = "suspend" | "reactivate" | "revoke" | "unlock" | "reset-pin" | "delete";

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <label className="w-field">
      <span className="w-field__label">{label}</span>
      <select className="w-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="a-fieldset">
      <legend>{title}</legend>
      <div className="a-grid">{children}</div>
    </fieldset>
  );
}

/** Build a PATCH containing only fields that differ from the loaded record. */
function diff(orig: AdminProfile, d: AdminProfile): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const simple: Array<[keyof AdminProfile, string]> = [
    ["fullName", "full_name"], ["dateOfBirth", "date_of_birth"], ["nationality", "nationality"], ["gender", "gender"],
    ["title", "title"], ["classification", "classification"], ["threatLevel", "threat_level"],
    ["watchlistStatus", "watchlist_status"], ["riskScore", "risk_score"], ["priority", "priority"], ["description", "description"],
  ];
  for (const [k, api] of simple) if (orig[k] !== d[k]) patch[api] = d[k];
  if (JSON.stringify(orig.caseNotes) !== JSON.stringify(d.caseNotes)) patch.case_notes = d.caseNotes;
  if (JSON.stringify(orig.biometrics) !== JSON.stringify(d.biometrics) && d.biometrics) patch.biometrics = d.biometrics;
  if (JSON.stringify(orig.location) !== JSON.stringify(d.location) && d.location) {
    const l = d.location;
    patch.location = { country: l.country, region: l.region || null, city: l.city, address: l.address || null, postal_code: l.postalCode || null, show_address: l.showAddress };
  }
  return patch;
}

export function ProfileDetailPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAdminSession();
  const { data, error, setData } = useAsync(() => getProfile(projectId), [projectId]);
  const [draft, setDraft] = useState<AdminProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);

  // Seed the edit form once per loaded profile; access actions must not wipe unsaved edits.
  useEffect(() => {
    if (data && (!draft || draft.projectId !== data.projectId)) setDraft(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (error) return <Panel title="Profile" code="PR-ERR"><p className="w-c-crit">{error}</p><Link to="/profiles">← Back to profiles</Link></Panel>;
  if (!data || !draft) return <div className="w-label" style={{ padding: 24 }}>Loading profile…</div>;

  const set = <K extends keyof AdminProfile>(k: K, v: AdminProfile[K]) => setDraft({ ...draft, [k]: v });
  const setLoc = (k: keyof NonNullable<AdminProfile["location"]>, v: string | boolean) =>
    setDraft({ ...draft, location: { country: "", region: null, city: "", address: null, postalCode: null, showAddress: false, lat: null, lon: null, ...draft.location, [k]: v } });
  const setBio = (k: keyof NonNullable<AdminProfile["biometrics"]>, v: BiometricStatus) =>
    setDraft({ ...draft, biometrics: { facial: "NOT ON FILE", fingerprint: "NOT ON FILE", iris: "NOT ON FILE", dna: "NOT ON FILE", ...draft.biometrics, [k]: v } });

  const patch = diff(data, draft);
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setSaving(true);
    setFlash(null);
    try {
      const updated = await updateProfile(projectId, patch);
      setData(updated);
      setDraft(updated);
      setFlash({ ok: true, text: "Saved. The owner's console will update within 30 seconds." });
    } catch (e) {
      setFlash({ ok: false, text: e instanceof ApiError ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(a: Action) {
    setBusy(true);
    try {
      if (a === "delete") {
        await deleteProfile(projectId);
        navigate("/profiles", { replace: true });
        return;
      }
      if (a === "reset-pin") {
        const r = await resetPin(projectId);
        setNewPin(r.newPin);
        setData(await getProfile(projectId));
      } else {
        setData(await accessAction(projectId, a));
      }
      setFlash({ ok: true, text: `Action complete: ${a}.` });
    } catch (e) {
      setFlash({ ok: false, text: e instanceof ApiError ? e.message : "Action failed" });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const dialogs: Record<Action, { title: string; body: string; label: string; danger?: boolean; type?: boolean }> = {
    suspend: { title: "Suspend access?", body: "The owner is signed out immediately and can't sign in until reactivated.", label: "Suspend" },
    reactivate: { title: "Reactivate access?", body: "The owner can sign in again. Failed-attempt lockout is cleared.", label: "Reactivate" },
    unlock: { title: "Clear lockout?", body: "Resets failed attempts so the owner can try again now.", label: "Unlock" },
    revoke: { title: "Revoke access permanently?", body: "Revocation cannot be undone. The profile stays on record but can never sign in again.", label: "Revoke", danger: true, type: true },
    "reset-pin": { title: "Reset access PIN?", body: "A new 6-digit PIN is generated and shown once. Give it to the owner through a channel they trust. Existing sessions end.", label: "Generate new PIN" },
    delete: { title: "Delete profile?", body: "Permanently deletes the profile, its notes, location, biometric statuses, sessions and activity. This cannot be undone.", label: "Delete forever", danger: true, type: true },
  };
  const dlg = pending ? dialogs[pending] : null;
  const loc = draft.location;
  const bio = draft.biometrics;
  const st = data.accessStatus;
  const isLocked = !!data.lockedUntil && new Date(data.lockedUntil) > new Date();

  return (
    <div className="a-stack">
      <Panel title={`Profile — ${data.projectId}`} code="PR-01" tools={<Link to="/profiles" className="w-label">← All profiles</Link>}>
        <div className="a-head">
          <div className="a-head__photo">
            {data.hasPhoto ? <img src={photoUrl(data.projectId, data.updatedAt)} alt={`Photo of ${data.fullName}`} /> : <span className="w-label">No photo</span>}
            <label className="w-btn w-btn--ghost w-btn--sm" style={{ cursor: "pointer" }}>
              Replace
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    setData(await replacePhoto(projectId, file));
                    setFlash({ ok: true, text: "Photo replaced (re-encoded, metadata stripped)." });
                  } catch (err) {
                    setFlash({ ok: false, text: err instanceof ApiError ? err.message : "Upload failed" });
                  }
                }}
              />
            </label>
            {data.hasPhoto && (
              <TechButton size="sm" variant="ghost" onClick={async () => setData(await removePhoto(projectId))}>
                Remove
              </TechButton>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="a-head__name">{data.fullName}</div>
            <div className="a-head__chips">
              <Chip tone={accessTone(st)} solid>{st}</Chip>
              <Chip tone={threatTone(data.threatLevel)}>{data.threatLevel}</Chip>
              {isLocked && <Chip tone="warn">Locked until {fmtStamp(data.lockedUntil!)}</Chip>}
              {data.isDemo && <Chip tone="muted">Demo</Chip>}
            </div>
          </div>
          <div className="a-actions">
            {st === "ACTIVE" && <TechButton size="sm" variant="ghost" onClick={() => setPending("suspend")}>Suspend</TechButton>}
            {st === "SUSPENDED" && <TechButton size="sm" onClick={() => setPending("reactivate")}>Reactivate</TechButton>}
            {isLocked && <TechButton size="sm" variant="ghost" onClick={() => setPending("unlock")}>Unlock</TechButton>}
            {st !== "REVOKED" && <TechButton size="sm" variant="ghost" onClick={() => setPending("reset-pin")}>Reset PIN</TechButton>}
            {st !== "REVOKED" && <TechButton size="sm" variant="danger" onClick={() => setPending("revoke")}>Revoke</TechButton>}
            {session?.role === "owner" && <TechButton size="sm" variant="danger" onClick={() => setPending("delete")}>Delete</TechButton>}
          </div>
        </div>
        <DataRows
          rows={[
            { k: "Created", v: `${fmtStamp(data.createdAt)} UTC` },
            { k: "Updated", v: `${fmtStamp(data.updatedAt)} UTC` },
            { k: "Last access", v: data.lastAccessAt ? `${fmtStamp(data.lastAccessAt)} UTC` : "Never" },
            { k: "Failed attempts", v: data.failedAttempts },
            { k: "Photo", v: data.hasPhoto ? "On file" : "None" },
            {
              k: "Coordinates",
              v: (
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  {data.location?.lat != null && data.location?.lon != null
                    ? `${data.location.lat.toFixed(4)}, ${data.location.lon.toFixed(4)}`
                    : "Not resolved"}
                  <TechButton
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        setData(await regeocode(projectId));
                        setFlash({ ok: true, text: "Geocoding re-run." });
                      } catch (e) {
                        setFlash({ ok: false, text: e instanceof ApiError ? e.message : "Geocoding failed" });
                      }
                    }}
                  >
                    Re-geocode
                  </TechButton>
                </span>
              ),
            },
          ]}
        />
        {newPin && (
          <div className="a-pin" role="status">
            <span className="w-label">New PIN — shown once</span>
            <strong className="w-mono-num">{newPin}</strong>
            <TechButton size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(newPin)}>Copy</TechButton>
            <TechButton size="sm" variant="ghost" onClick={() => setNewPin(null)}>Hide</TechButton>
          </div>
        )}
        {flash && <p className={flash.ok ? "w-c-ok" : "w-c-crit"} role="status">{flash.text}</p>}
      </Panel>

      <Panel title="Edit (on owner request)" code="PR-02">
        <div className="a-form">
          <Section title="General">
            <TechInput label="Full name" value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} />
            <TechInput label="Date of birth" type="date" value={draft.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value || null)} />
            <TechInput label="Nationality" value={draft.nationality} onChange={(e) => set("nationality", e.target.value)} />
            <TechInput label="Gender (optional)" value={draft.gender ?? ""} onChange={(e) => set("gender", e.target.value || null)} />
            <TechInput label="Title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </Section>
          <Section title="Location">
            <TechInput label="Country" value={loc?.country ?? ""} onChange={(e) => setLoc("country", e.target.value)} />
            <TechInput label="State / region" value={loc?.region ?? ""} onChange={(e) => setLoc("region", e.target.value)} />
            <TechInput label="City" value={loc?.city ?? ""} onChange={(e) => setLoc("city", e.target.value)} />
            <TechInput label="Full address" value={loc?.address ?? ""} onChange={(e) => setLoc("address", e.target.value)} />
            <TechInput label="Postal code" value={loc?.postalCode ?? ""} onChange={(e) => setLoc("postalCode", e.target.value)} />
            <label className="a-check">
              <input type="checkbox" checked={loc?.showAddress ?? false} onChange={(e) => setLoc("showAddress", e.target.checked)} />
              Show full address to owner (otherwise city/country only)
            </label>
          </Section>
          <Section title="Display & classification">
            <TechInput label="Classification label" value={draft.classification} onChange={(e) => set("classification", e.target.value)} />
            <Select label="Threat level" value={draft.threatLevel} options={THREATS} onChange={(v) => set("threatLevel", v)} />
            <Select label="Watchlist status" value={draft.watchlistStatus} options={WATCH} onChange={(v) => set("watchlistStatus", v)} />
            <Select label="Priority" value={draft.priority} options={PRIORITY} onChange={(v) => set("priority", v)} />
            <TechInput label="Risk score (0–100)" type="number" min={0} max={100} value={draft.riskScore} onChange={(e) => set("riskScore", Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
          </Section>
          <Section title="Biometric display statuses">
            <Select label="Facial" value={bio?.facial ?? "NOT ON FILE"} options={BIO} onChange={(v) => setBio("facial", v)} />
            <Select label="Fingerprint" value={bio?.fingerprint ?? "NOT ON FILE"} options={BIO} onChange={(v) => setBio("fingerprint", v)} />
            <Select label="Iris" value={bio?.iris ?? "NOT ON FILE"} options={BIO} onChange={(v) => setBio("iris", v)} />
            <Select label="DNA" value={bio?.dna ?? "NOT ON FILE"} options={BIO} onChange={(v) => setBio("dna", v)} />
          </Section>
          <fieldset className="a-fieldset">
            <legend>Description & case notes</legend>
            <label className="w-field">
              <span className="w-field__label">Profile description</span>
              <textarea className="w-input a-textarea" value={draft.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} />
            </label>
            <label className="w-field">
              <span className="w-field__label">Case notes (one per line, max 20)</span>
              <textarea
                className="w-input a-textarea"
                value={draft.caseNotes.join("\n")}
                onChange={(e) => set("caseNotes", e.target.value.split("\n").slice(0, 20))}
              />
            </label>
          </fieldset>
          <div className="a-savebar">
            <span className="w-label">{dirty ? `${Object.keys(patch).length} field(s) changed` : "No changes"}</span>
            <TechButton variant="ghost" size="sm" disabled={!dirty || saving} onClick={() => setDraft(data)}>Discard</TechButton>
            <TechButton size="sm" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</TechButton>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ""}
        body={dlg?.body}
        confirmLabel={dlg?.label ?? ""}
        danger={dlg?.danger}
        typeToConfirm={dlg?.type ? data.projectId : undefined}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void runAction(pending)}
      />
    </div>
  );
}
