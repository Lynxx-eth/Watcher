import { useState, type FormEvent } from "react";
import { DataRows, Panel, TechButton, TechInput } from "@watcher/ui";
import { ApiError, changePassword } from "../services/api";
import { useAdminSession } from "../session";

export function SettingsPage() {
  const { session } = useAdminSession();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 12) return setMsg({ ok: false, text: "New password must be at least 12 characters." });
    if (next !== again) return setMsg({ ok: false, text: "New passwords do not match." });
    setBusy(true);
    try {
      await changePassword(cur, next);
      setCur("");
      setNext("");
      setAgain("");
      setMsg({ ok: true, text: "Password updated." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Update failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a-split">
      <Panel title="Change Password" code="ST-01">
        <form className="a-form" onSubmit={submit} noValidate>
          <TechInput label="Current password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <TechInput label="New password" type="password" autoComplete="new-password" hint="Minimum 12 characters" value={next} onChange={(e) => setNext(e.target.value)} />
          <TechInput label="Repeat new password" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          {msg && <div className={msg.ok ? "w-c-ok" : "w-c-crit"} role="status">{msg.text}</div>}
          <TechButton type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</TechButton>
        </form>
      </Panel>
      <Panel title="Session" code="ST-02">
        <DataRows
          rows={[
            { k: "Signed in as", v: session?.username ?? "—" },
            { k: "Role", v: session?.role ?? "—" },
            { k: "Session length", v: "2 hours (server-enforced)" },
            { k: "New admins", v: "python -m app.cli create-admin" },
          ]}
        />
      </Panel>
    </div>
  );
}
