import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Users, TrendingUp, TrendingDown, Minus, Activity, UsersRound, CreditCard, UserCheck, Target } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  totalNow: number;
  totalBeforePeriod: number;
  paidNow: number;
  freeNow: number;
  paidBeforePeriod: number;
  data: { label: string; count: number; paidCount: number }[];
}

interface ActiveUsersData {
  current: { dau: number; wau: number; mau: number };
  dau: { label: string; count: number }[];
  wau: { label: string; count: number }[];
  mau: { label: string; count: number }[];
}

type AuView = "dau" | "wau" | "mau";

interface PredictionsMetricsData {
  stats: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    peakDay: { label: string; count: number } | null;
  };
  daily:   { label: string; iso: string; count: number }[];
  weekly:  { label: string; count: number }[];
  monthly: { label: string; count: number }[];
}

type PredView = "daily" | "weekly" | "monthly";

// ── Constants ─────────────────────────────────────────────────────────────────

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

const AU_VIEWS: { value: AuView; label: string; window: string }[] = [
  { value: "dau", label: "Daily",   window: "Last 30 days" },
  { value: "wau", label: "Weekly",  window: "Last 12 weeks" },
  { value: "mau", label: "Monthly", window: "Last 12 months" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Custom Tooltips ───────────────────────────────────────────────────────────

const RegTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-violet-700">
        {payload[0].value} <span className="text-sm font-normal text-gray-500">new users</span>
      </p>
    </div>
  );
};

const CumTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const labelMap: Record<string, string> = { total: "Total", paid: "Paid", free: "Free" };
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 min-w-[140px]">
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-bold" style={{ color: p.color }}>
          {(p.value ?? 0).toLocaleString()} <span className="font-normal text-gray-500">{labelMap[p.name ?? ""] ?? p.name}</span>
        </p>
      ))}
    </div>
  );
};

const AuTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value?: number | string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-emerald-700">
        {payload[0].value} <span className="text-sm font-normal text-gray-500">active users</span>
      </p>
    </div>
  );
};

const PredTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-orange-600">
        {(payload[0].value ?? 0).toLocaleString()} <span className="text-sm font-normal text-gray-500">predicciones</span>
      </p>
    </div>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMetrics() {
  useAdminAuth();

  // Shared period for all user charts
  const [period, setPeriod] = useState<Period>("last_7_days");

  // New user registrations state
  const [regData, setRegData] = useState<MetricsData | null>(null);
  const [regLoading, setRegLoading] = useState(true);

  // Active users state
  const [auView, setAuView] = useState<AuView>("dau");
  const [auData, setAuData] = useState<ActiveUsersData | null>(null);
  const [auLoading, setAuLoading] = useState(true);

  // Daily predictions state
  const [predView, setPredView] = useState<PredView>("daily");
  const [predData, setPredData] = useState<PredictionsMetricsData | null>(null);
  const [predLoading, setPredLoading] = useState(true);

  useEffect(() => {
    setPredLoading(true);
    adminFetch("/admin/metrics/predictions")
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<PredictionsMetricsData>; })
      .then((d) => { setPredData(d); setPredLoading(false); })
      .catch(() => setPredLoading(false));
  }, []);

  useEffect(() => {
    setRegLoading(true);
    setRegData(null);
    adminFetch(`/admin/metrics/users?period=${period}`)
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<MetricsData>; })
      .then((d) => { if (Array.isArray(d?.data)) { setRegData(d); } setRegLoading(false); })
      .catch(() => setRegLoading(false));
  }, [period]);

  useEffect(() => {
    setAuLoading(true);
    adminFetch("/admin/metrics/active-users")
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<ActiveUsersData>; })
      .then((d) => { if (d?.current) { setAuData(d); } setAuLoading(false); })
      .catch(() => setAuLoading(false));
  }, []);

  // Derive cumulative series from registration data (no separate endpoint needed)
  const cumSeries: { label: string; total: number; paid: number; free: number }[] | null = regData
    ? (() => {
        let running = regData.totalBeforePeriod ?? 0;
        let runningPaid = regData.paidBeforePeriod ?? 0;
        return regData.data.map((bucket) => {
          running += bucket.count;
          runningPaid += bucket.paidCount ?? 0;
          const runningFree = running - runningPaid;
          return { label: bucket.label, total: running, paid: runningPaid, free: runningFree };
        });
      })()
    : null;
  const cumTotalNow = regData?.totalNow ?? 0;

  const regMaxCount = regData?.data ? Math.max(...regData.data.map((d) => d.count), 1) : 1;
  const chartData: { label: string; count: number }[] = auData?.[auView] ?? [];

  return (
    <AdminLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
          <p className="text-sm text-gray-500 mt-1">Platform analytics and growth data</p>
        </div>

        {/* ══ USUARIOS ══════════════════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Usuarios</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Shared period selector */}
          <div className="flex flex-wrap gap-1.5 mb-8">
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

          <div className="space-y-10">

        {/* ── Total registered users (cumulative) ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
              <UsersRound className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-gray-800">Total registered users</h2>
          </div>

          {/* Stat cards row 1: totals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total users now</p>
              {regLoading ? <StatSkeleton /> : (
                <span className="text-3xl font-bold text-gray-900">{cumTotalNow.toLocaleString()}</span>
              )}
              <p className="text-xs text-gray-400 mt-1">all time</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">At period start</p>
              {regLoading ? <StatSkeleton /> : (
                <span className="text-3xl font-bold text-gray-900">{(cumSeries?.[0]?.total ?? 0).toLocaleString()}</span>
              )}
              <p className="text-xs text-gray-400 mt-1">{PERIODS.find((p) => p.value === period)?.label}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Growth in period</p>
              {regLoading ? <StatSkeleton /> : (() => {
                const start = cumSeries?.[0]?.total ?? 0;
                const gained = cumTotalNow - start;
                return (
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-gray-900">+{gained.toLocaleString()}</span>
                    {gained > 0 && start > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 mb-1">
                        <TrendingUp className="w-3 h-3" /> +{Math.round((gained / start) * 100)}%
                      </span>
                    )}
                  </div>
                );
              })()}
              <p className="text-xs text-gray-400 mt-1">vs. start of period</p>
            </div>
          </div>

          {/* Stat cards row 2: free / paid breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Free users</p>
              </div>
              {regLoading ? <StatSkeleton /> : (
                <span className="text-3xl font-bold text-gray-900">{(regData?.freeNow ?? 0).toLocaleString()}</span>
              )}
              <p className="text-xs text-gray-400 mt-1">no active subscription</p>
            </div>
            <div className="bg-white border border-violet-100 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Paying subscribers</p>
              </div>
              {regLoading ? <StatSkeleton /> : (
                <span className="text-3xl font-bold text-gray-900">{(regData?.paidNow ?? 0).toLocaleString()}</span>
              )}
              <p className="text-xs text-gray-400 mt-1">active subscription</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Conversion rate</p>
              {regLoading ? <StatSkeleton /> : (() => {
                const pct = cumTotalNow > 0
                  ? ((regData?.paidNow ?? 0) / cumTotalNow * 100).toFixed(1)
                  : "0.0";
                return (
                  <span className="text-3xl font-bold text-gray-900">{pct}%</span>
                );
              })()}
              <p className="text-xs text-gray-400 mt-1">free → paid</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {regLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">Loading chart...</div>
              </div>
            ) : !cumSeries || cumSeries.length === 0 ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">No data for this period</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-semibold text-gray-700">
                    {PERIODS.find((p) => p.value === period)?.label} — cumulative growth
                  </p>
                  <p className="text-xs text-gray-400">{cumTotalNow.toLocaleString()} total</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={cumSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                    <Tooltip content={<CumTooltip />} cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 2" }} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                      formatter={(value: string) => ({ total: "Total", paid: "Paid", free: "Free" } as Record<string, string>)[value] ?? value}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="total"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      dot={cumSeries.length <= 14 ? { r: 4, fill: "#4f46e5", strokeWidth: 0 } : false}
                      activeDot={{ r: 5, fill: "#4f46e5", strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="paid"
                      name="paid"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={cumSeries.length <= 14 ? { r: 3, fill: "#7c3aed", strokeWidth: 0 } : false}
                      activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="free"
                      name="free"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={cumSeries.length <= 14 ? { r: 3, fill: "#0ea5e9", strokeWidth: 0 } : false}
                      activeDot={{ r: 4, fill: "#0ea5e9", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </section>

        {/* ── New user registrations ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="text-base font-bold text-gray-800">New user registrations</h2>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total in period</p>
              {regLoading ? <StatSkeleton /> : (
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-gray-900">{regData?.total ?? 0}</span>
                  {regData && <TrendBadge current={regData.total} previous={regData.previousTotal} />}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">vs. previous period</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Previous period</p>
              {regLoading ? <StatSkeleton /> : (
                <span className="text-3xl font-bold text-gray-900">{regData?.previousTotal ?? 0}</span>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Peak bucket</p>
              {regLoading ? <StatSkeleton /> : (
                <div>
                  <span className="text-3xl font-bold text-gray-900">
                    {regMaxCount === 1 && !regData?.data.some((d) => d.count > 0) ? 0 : regMaxCount}
                  </span>
                  {regData && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {regData.data.find((d) => d.count === regMaxCount)?.label ?? "—"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {regLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">Loading chart...</div>
              </div>
            ) : !regData || regData.data.length === 0 ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">No data for this period</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-semibold text-gray-700">
                    {PERIODS.find((p) => p.value === period)?.label} — new registrations
                  </p>
                  <p className="text-xs text-gray-400">{regData.total} total</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={regData.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                    <Tooltip content={<RegTooltip />} cursor={{ stroke: "#7c3aed", strokeWidth: 1, strokeDasharray: "4 2" }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      fill="url(#regGradient)"
                      dot={regData.data.length <= 14 ? { r: 4, fill: "#7c3aed", strokeWidth: 0 } : false}
                      activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </section>

        {/* Active users — DAU / WAU / MAU */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Active users — DAU / WAU / MAU</h2>
              <p className="text-xs text-gray-400 mt-0.5">An active user has participated in at least 1 hunch in the measured window</p>
            </div>
          </div>

          {/* Snapshot cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(["dau", "wau", "mau"] as AuView[]).map((key) => {
              const meta: Record<AuView, { title: string; sub: string }> = {
                dau: { title: "DAU", sub: "Today" },
                wau: { title: "WAU", sub: "This week" },
                mau: { title: "MAU", sub: "This month" },
              };
              return (
                <button
                  key={key}
                  onClick={() => setAuView(key)}
                  className={`text-left bg-white border rounded-2xl p-5 transition-all ${
                    auView === key
                      ? "border-emerald-400 ring-1 ring-emerald-200 shadow-sm"
                      : "border-gray-200 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{meta[key].title}</p>
                    {auView === key && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                  {auLoading ? <StatSkeleton /> : (
                    <span className="text-3xl font-bold text-gray-900">{auData?.current[key] ?? 0}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{meta[key].sub}</p>
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {/* View tabs */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-1">
                {AU_VIEWS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setAuView(v.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      auView === v.value
                        ? "bg-emerald-600 text-white"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {AU_VIEWS.find((v) => v.value === auView)?.window}
              </p>
            </div>

            {auLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">Loading chart...</div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center">
                <div className="text-sm text-gray-400">No activity data</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                  <Tooltip
                    content={(props) => (
                      <AuTooltip
                        active={props.active}
                        payload={props.payload as { value?: number | string }[]}
                        label={props.label}
                      />
                    )}
                    cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "4 2" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#auGradient)"
                    dot={chartData.length <= 14 ? { r: 4, fill: "#10b981", strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

          </div>{/* /space-y-10 */}
        </div>{/* /Usuarios */}

        {/* ══ ACTIVIDADES ═══════════════════════════════════════════════════════ */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Actividades</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* ── Predicciones diarias ── */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">Predicciones</h2>
                <p className="text-xs text-gray-400 mt-0.5">Predicciones realizadas por los usuarios desde el primer día</p>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:col-span-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total</p>
                {predLoading ? <StatSkeleton /> : (
                  <span className="text-3xl font-bold text-gray-900">{(predData?.stats.total ?? 0).toLocaleString()}</span>
                )}
                <p className="text-xs text-gray-400 mt-1">all time</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Hoy</p>
                {predLoading ? <StatSkeleton /> : (
                  <span className="text-3xl font-bold text-gray-900">{(predData?.stats.today ?? 0).toLocaleString()}</span>
                )}
                <p className="text-xs text-gray-400 mt-1">desde 00:00 UTC</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Esta semana</p>
                {predLoading ? <StatSkeleton /> : (
                  <span className="text-3xl font-bold text-gray-900">{(predData?.stats.thisWeek ?? 0).toLocaleString()}</span>
                )}
                <p className="text-xs text-gray-400 mt-1">lunes–hoy</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Este mes</p>
                {predLoading ? <StatSkeleton /> : (
                  <span className="text-3xl font-bold text-gray-900">{(predData?.stats.thisMonth ?? 0).toLocaleString()}</span>
                )}
                <p className="text-xs text-gray-400 mt-1">mes en curso</p>
              </div>
              <div className="bg-white border border-orange-100 rounded-2xl p-5">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Día pico</p>
                {predLoading ? <StatSkeleton /> : predData?.stats.peakDay ? (
                  <>
                    <span className="text-3xl font-bold text-gray-900">{predData.stats.peakDay.count.toLocaleString()}</span>
                    <p className="text-xs text-gray-400 mt-1 truncate">{predData.stats.peakDay.label}</p>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-900">—</span>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              {/* View tabs */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex gap-1">
                  {([ { value: "daily", label: "Diario" }, { value: "weekly", label: "Semanal" }, { value: "monthly", label: "Mensual" } ] as { value: PredView; label: string }[]).map((v) => (
                    <button
                      key={v.value}
                      onClick={() => setPredView(v.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        predView === v.value
                          ? "bg-orange-500 text-white"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {predView === "daily" ? "Desde el primer día" : predView === "weekly" ? "Desde la primera semana" : "Desde el primer mes"}
                </p>
              </div>

              {predLoading ? (
                <div className="h-72 flex items-center justify-center">
                  <div className="text-sm text-gray-400">Cargando gráfica...</div>
                </div>
              ) : (() => {
                const chartData = predData?.[predView] ?? [];
                if (chartData.length === 0) {
                  return (
                    <div className="h-72 flex items-center justify-center">
                      <div className="text-sm text-gray-400">Sin datos todavía</div>
                    </div>
                  );
                }
                const showDots = chartData.length <= 14;
                return (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                        <defs>
                          <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"  stopColor="#f97316" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#fb923c" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          tickLine={false}
                          axisLine={false}
                          interval={chartData.length > 60 ? Math.floor(chartData.length / 20) : "preserveStartEnd"}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                        <Tooltip
                          content={(props) => (
                            <PredTooltip
                              active={props.active}
                              payload={props.payload as { value?: number }[]}
                              label={props.label}
                            />
                          )}
                          cursor={{ fill: "#f97316", fillOpacity: 0.08 }}
                        />
                        <Bar
                          dataKey="count"
                          fill="url(#predGradient)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={showDots ? 40 : 20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                );
              })()}
            </div>
          </section>
        </div>

      </div>
    </AdminLayout>
  );
}
