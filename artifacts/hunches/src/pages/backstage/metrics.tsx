import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "this_month"
  | "last_30_days"
  | "this_year"
  | "last_12_months";

interface MetricsData {
  period: Period;
  total: number;
  previousTotal: number;
  data: { label: string; count: number }[];
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "today",          label: "Today" },
  { value: "yesterday",      label: "Yesterday" },
  { value: "this_week",      label: "This week" },
  { value: "last_7_days",    label: "Last 7 days" },
  { value: "this_month",     label: "This month" },
  { value: "last_30_days",   label: "Last 30 days" },
  { value: "this_year",      label: "This year" },
  { value: "last_12_months", label: "Last 12 months" },
];

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (pct === null) return null;
  if (pct === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
  if (pct > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
      <TrendingUp className="w-3 h-3" /> +{pct}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-1">
      <TrendingDown className="w-3 h-3" /> {pct}%
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-violet-700">{payload[0].value} <span className="text-sm font-normal text-gray-500">new users</span></p>
    </div>
  );
};

export default function AdminMetrics() {
  useAdminAuth();
  const [period, setPeriod] = useState<Period>("last_7_days");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    adminFetch(`/admin/metrics/users?period=${period}`)
      .then((r) => r.json())
      .then((d: MetricsData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const maxCount = data ? Math.max(...data.data.map((d) => d.count), 1) : 1;

  return (
    <AdminLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
          <p className="text-sm text-gray-500 mt-1">Platform analytics and growth data</p>
        </div>

        {/* Section: Users */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="text-base font-bold text-gray-800">New user registrations</h2>
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  period === p.value
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total in period</p>
              {loading ? (
                <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-gray-900">{data?.total ?? 0}</span>
                  {data && <TrendBadge current={data.total} previous={data.previousTotal} />}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">vs. previous period</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Previous period</p>
              {loading ? (
                <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
              ) : (
                <span className="text-3xl font-bold text-gray-900">{data?.previousTotal ?? 0}</span>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Peak bucket</p>
              {loading ? (
                <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div>
                  <span className="text-3xl font-bold text-gray-900">{maxCount === 1 && !data?.data.some((d) => d.count > 0) ? 0 : maxCount}</span>
                  {data && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {data.data.find((d) => d.count === maxCount)?.label ?? "—"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">Loading chart...</div>
              </div>
            ) : !data || data.data.length === 0 ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">No data for this period</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-semibold text-gray-700">
                    {PERIODS.find((p) => p.value === period)?.label} — new registrations
                  </p>
                  <p className="text-xs text-gray-400">
                    {data.total} total
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#7c3aed", strokeWidth: 1, strokeDasharray: "4 2" }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      fill="url(#userGradient)"
                      dot={data.data.length <= 14 ? { r: 4, fill: "#7c3aed", strokeWidth: 0 } : false}
                      activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
