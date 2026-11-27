import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProfileStats } from "@watcher/shared/types";
import { useReducedMotion } from "@watcher/ui";

const AXIS = { stroke: "#4d6280", fontSize: 10, fontFamily: "JetBrains Mono, monospace" };
const TIP = {
  contentStyle: { background: "#071625", border: "1px solid rgba(0,190,255,0.35)", borderRadius: 0, fontSize: 11 },
  labelStyle: { color: "#8297B2" },
};

export function AnalyticsCharts({ stats }: { stats: ProfileStats }) {
  const reduced = useReducedMotion();
  const days = stats.byDay.map((d) => ({ ...d, label: d.day.slice(5) }));
  const cats = Object.entries(stats.byCategory).map(([name, count]) => ({ name, count }));

  return (
    <div className="charts">
      <div className="charts__block">
        <div className="w-label">Sessions vs failed attempts</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={days} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF304F" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#FF304F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,190,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip {...TIP} />
            <Area type="monotone" dataKey="sessions" stroke="#00E5FF" fill="url(#gS)" strokeWidth={2} isAnimationActive={!reduced} animationDuration={1200} />
            <Area type="monotone" dataKey="failures" stroke="#FF304F" fill="url(#gF)" strokeWidth={1.5} isAnimationActive={!reduced} animationDuration={1200} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="charts__block">
        <div className="w-label">Events by category (30 days)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cats} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(0,190,255,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip {...TIP} cursor={{ fill: "rgba(0,191,255,0.06)" }} />
            <Bar dataKey="count" fill="#00BFFF" isAnimationActive={!reduced} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
