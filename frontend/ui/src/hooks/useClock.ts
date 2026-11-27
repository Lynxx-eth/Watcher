import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Ticking UTC clock formatted like an ops console: 11/27/2026 02:17:43 UTC */
export function useClock(): { date: string; time: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return {
    date: `${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/${now.getUTCFullYear()}`,
    time: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`,
  };
}
