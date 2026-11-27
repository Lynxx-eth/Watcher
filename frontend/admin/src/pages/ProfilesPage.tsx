import { useEffect, useState } from "react";
import { Panel, TechButton } from "@watcher/ui";
import { listProfiles } from "../services/api";
import { useAsync } from "../components/useAsync";
import { ProfileTable } from "../components/ProfileTable";

const PAGE_SIZE = 25;

export function ProfilesPage({ accessFilter, title = "All Profiles" }: { accessFilter?: string; title?: string }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [access, setAccess] = useState(accessFilter ?? "");
  const [page, setPage] = useState(1);

  // Debounce search typing.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [input]);

  const { data, error, loading } = useAsync(
    () => listProfiles({ q, access: access || undefined, page, pageSize: PAGE_SIZE }),
    [q, access, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Panel title={title} code="AP-00" flush>
      <div className="a-toolbar">
        <input
          className="w-input a-search"
          placeholder="Search project ID or name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search profiles"
        />
        <select className="w-input a-select" value={access} onChange={(e) => (setAccess(e.target.value), setPage(1))} aria-label="Access filter">
          <option value="">All access states</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REVOKED">Revoked</option>
        </select>
        <span className="w-label a-count">{loading ? "Loading…" : `${data?.total ?? 0} result(s)`}</span>
      </div>
      {error ? <p className="w-c-crit" style={{ padding: 12 }}>{error}</p> : <ProfileTable rows={data?.items ?? []} />}
      <div className="a-pager">
        <TechButton size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ‹ Prev
        </TechButton>
        <span className="w-label">
          Page {page} / {pages}
        </span>
        <TechButton size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Next ›
        </TechButton>
      </div>
    </Panel>
  );
}
