import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/apiFetch";
import { Layout } from "@/components/layout";
import {
  Loader2, Copy, Check, TrendingUp, Users, DollarSign, Award,
  ExternalLink, ArrowUpRight, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AffiliateDashboard {
  affiliate: {
    id: number; name: string; slug: string;
    avatarUrl: string | null; bio: string | null;
    niche: string | null; status: string;
  };
  stats: {
    totalClicks: number; totalSignups: number; totalConverted: number;
    activePremiumUsers: number; conversionRate: number;
    commissionPending: number; commissionApproved: number; commissionPaid: number;
    commissionTotal: number;
  };
  tier: {
    current: { id: number; name: string; commissionPercentage: number } | null;
    next: { id: number; name: string; minActivePremiumUsers: number; commissionPercentage: number } | null;
    activePremiumCount: number;
    usersToNextTier: number;
  };
}

interface Referral {
  id: number; status: string; signupAt: string;
  convertedAt: string | null; username: string | null;
}

interface Commission {
  id: number; commissionAmount: number; revenueAmount: number;
  commissionPercentage: number; status: string; earnedAt: string;
  commissionType: string;
}

interface Payout {
  id: number; amount: number; status: string;
  periodStart: string | null; periodEnd: string | null;
  paidAt: string | null; paymentReference: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    signed_up: "bg-blue-100 text-blue-700",
    converted:  "bg-green-100 text-green-700",
    active:     "bg-emerald-100 text-emerald-700",
    cancelled:  "bg-red-100 text-red-700",
    pending:    "bg-amber-100 text-amber-700",
    approved:   "bg-green-100 text-green-700",
    paid:       "bg-emerald-100 text-emerald-700",
    rejected:   "bg-red-100 text-red-700",
    processing: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">{icon}</div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AffiliateDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [data, setData] = useState<AffiliateDashboard | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"referrals" | "commissions" | "payouts">("referrals");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLocation("/login"); return; }

    Promise.all([
      fetch(apiUrl("/api/affiliate/dashboard"), { credentials: "include" }).then(r => r.json()),
      fetch(apiUrl("/api/affiliate/referrals"),  { credentials: "include" }).then(r => r.json()),
      fetch(apiUrl("/api/affiliate/commissions"), { credentials: "include" }).then(r => r.json()),
      fetch(apiUrl("/api/affiliate/payouts"),    { credentials: "include" }).then(r => r.json()),
    ]).then(([dash, refs, comms, pays]) => {
      if (dash.error) { setError(dash.error); return; }
      setData(dash as AffiliateDashboard);
      setReferrals((refs as { referrals: Referral[] }).referrals ?? []);
      setCommissions((comms as { commissions: Commission[] }).commissions ?? []);
      setPayouts((pays as { payouts: Payout[] }).payouts ?? []);
    }).catch(() => setError("Error loading dashboard")).finally(() => setLoading(false));
  }, [user, authLoading, setLocation]);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(`https://hunch.fan/${data.affiliate.slug}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
          <XCircle className="w-12 h-12 text-muted-foreground" />
          <p className="text-xl font-bold">Affiliate dashboard unavailable</p>
          <p className="text-muted-foreground">{error}</p>
          <Link href="/affiliate"><Button variant="outline">Apply to the program</Button></Link>
        </div>
      </Layout>
    );
  }

  if (!data) return null;

  const { affiliate, stats, tier } = data;
  const link = `hunch.fan/${affiliate.slug}`;
  const tierPct = tier.current?.commissionPercentage ?? 20;
  const nextProgress = tier.next
    ? Math.min(100, Math.round((tier.activePremiumCount / tier.next.minActivePremiumUsers) * 100))
    : 100;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black">Affiliate Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {affiliate.name}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border">
            <span className="text-sm font-mono text-foreground">{link}</span>
            <a href={`/${affiliate.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={copyLink} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tier progress */}
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-foreground">{tier.current?.name ?? "Starter"} tier</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{tierPct}% commission</span>
            </div>
            {tier.next && (
              <span className="text-xs text-muted-foreground">
                {tier.usersToNextTier} more users to {tier.next.name} ({tier.next.commissionPercentage}%)
              </span>
            )}
          </div>
          {tier.next && (
            <div className="w-full h-2 rounded-full bg-violet-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-500"
                style={{ width: `${nextProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total clicks"   value={stats.totalClicks}    icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Signups"        value={stats.totalSignups}   sub={`${stats.conversionRate}% conversion`} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Premium active" value={stats.activePremiumUsers} icon={<Award className="w-4 h-4" />} />
          <StatCard label="Total commission" value={fmt(stats.commissionTotal)} icon={<DollarSign className="w-4 h-4" />} />
        </div>

        {/* Commission breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Pending", value: fmt(stats.commissionPending), icon: <Clock className="w-4 h-4" />, color: "text-amber-600 bg-amber-50 border-amber-200" },
            { label: "Approved", value: fmt(stats.commissionApproved), icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600 bg-green-50 border-green-200" },
            { label: "Paid out", value: fmt(stats.commissionPaid), icon: <ArrowUpRight className="w-4 h-4" />, color: "text-violet-600 bg-violet-50 border-violet-200" },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
              <div className="flex items-center gap-2 mb-1">{c.icon}<p className="text-xs font-semibold">{c.label}</p></div>
              <p className="text-xl font-black">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="flex border-b border-border">
            {(["referrals", "commissions", "payouts"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-background text-foreground border-b-2 border-violet-600" : "text-muted-foreground hover:text-foreground bg-muted/40"}`}
              >
                {t} {t === "referrals" ? `(${referrals.length})` : t === "commissions" ? `(${commissions.length})` : `(${payouts.length})`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {tab === "referrals" && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Signed up</th>
                    <th className="text-left px-4 py-3 font-medium">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No referrals yet. Share your link to get started.</td></tr>
                  ) : referrals.map(r => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.username ? `@${r.username}` : `User #${r.id}`}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.signupAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.convertedAt ? new Date(r.convertedAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "commissions" && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Revenue</th>
                    <th className="text-left px-4 py-3 font-medium">Rate</th>
                    <th className="text-left px-4 py-3 font-medium">Commission</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No commissions yet.</td></tr>
                  ) : commissions.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.earnedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 capitalize">{c.commissionType.replace("_", " ")}</td>
                      <td className="px-4 py-3">{fmt(c.revenueAmount)}</td>
                      <td className="px-4 py-3">{c.commissionPercentage}%</td>
                      <td className="px-4 py-3 font-semibold">{fmt(c.commissionAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "payouts" && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Period</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Paid at</th>
                    <th className="text-left px-4 py-3 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No payouts yet.</td></tr>
                  ) : payouts.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.periodStart ? new Date(p.periodStart).toLocaleDateString() : "—"}
                        {" – "}
                        {p.periodEnd ? new Date(p.periodEnd).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(p.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.paymentReference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
