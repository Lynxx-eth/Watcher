import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActivityEntry, Profile, ProfileStats } from "@watcher/shared/types";
import { ApiError, fetchMyActivity, fetchMyProfile, fetchMyStats } from "../services/api";
import { useSession } from "./useSession";

interface ProfileData {
  profile: Profile | null;
  activity: ActivityEntry[];
  stats: ProfileStats | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ProfileData | null>(null);

/** Polling keeps the console in step with admin edits (suspend, corrections). */
const POLL_MS = 30_000;

export function ProfileDataProvider({ children }: { children: ReactNode }) {
  const { setSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [p, a, s] = await Promise.all([fetchMyProfile(), fetchMyActivity(), fetchMyStats()]);
      setProfile(p);
      setActivity(a);
      setStats(s);
      setError(null);
      setLastSync(new Date());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Session ended server-side (logout elsewhere, suspended, expired).
        setSession(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "SYNC FAILED");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [setSession]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ profile, activity, stats, loading, error, lastSync, refresh }}>{children}</Ctx.Provider>
  );
}

export function useProfileData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfileData must be used inside <ProfileDataProvider>");
  return v;
}
