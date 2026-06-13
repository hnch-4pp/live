import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch, useAdminAuth } from "./dashboard";
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Globe2,
  Ticket, TrendingUp, DollarSign, CreditCard, Trophy,
  ShieldAlert, Ban, Trash2, CheckCircle2, Clock,
  Target, Zap, RefreshCw, AlertCircle, Users, Gift,
  Pencil, Check, X, Loader2, AtSign,
} from "lucide-react";

type UserStatus = "active" | "suspended" | "banned";
type ModAction = "suspend" | "ban" | "reactivate";

interface HunchEntry {
  hunchId: number;
  title: string;
  slug: string;
  status: string;
  endsAt: string | null;
  predictions: number;
  won: boolean;
  prizeLabel: string | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface ActiveSubscription {
  id: number;
  tier: string;
  ticketsPerMonth: number;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface UserDetail {
  id: number;
  email: string;
  phone: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  country: string | null;
  lastAccessAt: string | null;
  ticketStats: { currentBalance: number; totalReceived: number; totalSpent: number };
  lifetimeSpendCents: number;
  subscriptionSpendCents: number;
  hunchParticipation: HunchEntry[];
  activeHunches: HunchEntry[];
  prizesWon: HunchEntry[];
  subscription: ActiveSubscription | null;
  paymentMethods: PaymentMethod[];
  referralCode: string | null;
  referralCount: number;
}

const STATUS_BADGE: Record<UserStatus, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-green-100 text-green-700" },
  suspended: { label: "Suspended", cls: "bg-yellow-100 text-yellow-700" },
  banned:    { label: "Banned",    cls: "bg-red-100 text-red-700" },
};

function fmt$(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, opts ?? { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function CardBrandIcon({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  if (b === "visa")       return <span className="text-[10px] font-bold tracking-widest text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">VISA</span>;
  if (b === "mastercard") return <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">MC</span>;
  if (b === "amex")       return <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">AMEX</span>;
  return <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded uppercase">{brand.slice(0, 4)}</span>;
}

function StatCard({ icon: Icon, label, value, sub, color = "violet" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    sky:    "bg-sky-50 text-sky-600",
    amber:  "bg-amber-50 text-amber-600",
    rose:   "bg-rose-50 text-rose-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.violet}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{children}</h3>
  );
}

function ReferralListInline({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ id: number; email: string; username: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminFetch(`/admin/users/${userId}/referrals`);
      if (r.ok) setRows(await r.json() as typeof rows);
    } finally { setLoading(false); }
  };

  const toggle = () => {
    if (!open && rows.length === 0) void load();
    setOpen((o) => !o);
  };

  return (
    <div className="w-full">
      <button
        onClick={toggle}
        className="text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
      >
        {open ? "Hide referral list" : "Show referral list"}
      </button>
      {open && (
        <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="text-xs text-gray-400 px-4 py-3">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3 italic">No referrals found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{r.username ? `@${r.username}` : r.email}</p>
                      {r.username && <p className="text-xs text-gray-400">{r.email}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, muted }: {
  icon: React.ElementType; label: string; value: string; muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`text-sm mt-0.5 ${muted ? "text-gray-400 italic" : "text-gray-900"}`}>{value}</p>
      </div>
    </div>
  );
}

function EditableInfoRow({ icon: Icon, label, value, displayValue, muted, onSave, type = "text" }: {
  icon: React.ElementType;
  label: string;
  value: string;
  displayValue?: string;
  muted?: boolean;
  onSave: (v: string) => Promise<void>;
  type?: "text" | "date" | "email" | "tel";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => { setDraft(value); setError(""); setEditing(true); };
  const cancel = () => { setEditing(false); setError(""); };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type={type}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") cancel(); }}
                autoFocus
                className="flex-1 min-w-0 text-sm bg-white border border-violet-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <button
                onClick={() => void save()}
                disabled={saving}
                className="p-1 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50 shrink-0 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={cancel} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className={`text-sm mt-0.5 ${muted ? "text-gray-400 italic" : "text-gray-900"}`}>
              {muted ? "Not provided" : (displayValue ?? (value || "—"))}
            </p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="p-1 rounded-lg text-gray-300 hover:text-violet-500 hover:bg-violet-50 transition-colors shrink-0 mt-0.5"
            title={`Edit ${label}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const modLabels: Record<ModAction, { title: string; desc: string; confirmLabel: string; confirmCls: string }> = {
  suspend:    { title: "Suspend this user?",         desc: "The user won't be able to log in until reactivated.",                      confirmLabel: "Suspend",    confirmCls: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  ban:        { title: "Permanently ban this user?", desc: "The user will be blocked indefinitely. Account and data are preserved.",  confirmLabel: "Ban",        confirmCls: "bg-red-600 hover:bg-red-700 text-white" },
  reactivate: { title: "Reactivate this user?",      desc: "The user will be able to log in again.",                                   confirmLabel: "Reactivate", confirmCls: "bg-green-600 hover:bg-green-700 text-white" },
};

export default function AdminUserDetail() {
  useAdminAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const userId = Number(params?.id ?? 0);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modAction, setModAction] = useState<{ action: ModAction } | null>(null);
  const [modding, setModding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await adminFetch(`/admin/users/${userId}/detail`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        setLoadError(body.error ?? `Error ${r.status}`);
        return;
      }
      setDetail(await r.json() as UserDetail);
    } catch {
      setLoadError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) void load(); }, [userId]);

  const handleMod = async () => {
    if (!modAction || !detail) return;
    setModding(true);
    const statusMap: Record<ModAction, UserStatus> = { suspend: "suspended", ban: "banned", reactivate: "active" };
    const r = await adminFetch(`/admin/users/${detail.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusMap[modAction.action] }),
    });
    if (r.ok) { const updated = await r.json() as UserDetail; setDetail((d) => d ? { ...d, status: updated.status } : d); }
    setModding(false);
    setModAction(null);
  };

  const saveField = async (patch: Record<string, string | null | undefined>) => {
    const r = await adminFetch(`/admin/users/${userId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Failed to save");
    }
    const updated = await r.json() as Partial<UserDetail>;
    setDetail((d) => {
      if (!d) return d;
      const next = { ...d, ...updated };
      if ("address" in patch) {
        const parts = (next.address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
        next.country = parts[parts.length - 1] ?? null;
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    await adminFetch(`/admin/users/${detail.id}`, { method: "DELETE" });
    setDeleting(false);
    setLocation("/backstage/users");
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loadError) {
    return (
      <AdminLayout>
        <div className="p-8">
          <button
            onClick={() => setLocation("/backstage/users")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center max-w-md mx-auto mt-10">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Could not load user</h2>
            <p className="text-sm text-gray-500 mb-6">{loadError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setLocation("/backstage/users")}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back to list
              </button>
              <button
                onClick={() => void load()}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!detail) return null;

  const badge = STATUS_BADGE[detail.status] ?? STATUS_BADGE.active;
  const initials = (detail.username ?? detail.email).slice(0, 2).toUpperCase();

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-6xl">

        {/* ── Back + Header ── */}
        <button
          onClick={() => setLocation("/backstage/users")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
              {detail.avatarUrl
                ? <img src={detail.avatarUrl.startsWith("http://") || detail.avatarUrl.startsWith("https://") ? detail.avatarUrl : `/api/storage${detail.avatarUrl}`} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-lg font-bold text-violet-600">{initials}</span>
              }
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{detail.email}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                User #{detail.id}
                {detail.username && <> · @{detail.username}</>}
                {detail.country && <> · {detail.country}</>}
              </p>
            </div>
          </div>

          {/* Moderation buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {detail.status === "active" && (
              <button onClick={() => setModAction({ action: "suspend" })}
                className="flex items-center gap-1.5 text-xs font-semibold border border-yellow-200 text-yellow-700 hover:bg-yellow-50 px-3 py-2 rounded-lg transition-colors">
                <ShieldAlert className="w-3.5 h-3.5" />Suspend
              </button>
            )}
            {detail.status !== "banned" && (
              <button onClick={() => setModAction({ action: "ban" })}
                className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                <Ban className="w-3.5 h-3.5" />Ban
              </button>
            )}
            {(detail.status === "suspended" || detail.status === "banned") && (
              <button onClick={() => setModAction({ action: "reactivate" })}
                className="flex items-center gap-1.5 text-xs font-semibold border border-green-200 text-green-700 hover:bg-green-50 px-3 py-2 rounded-lg transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />Reactivate
              </button>
            )}
            <button onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" />Delete
            </button>
            <button onClick={() => void load()}
              className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
              title="Refresh user data">
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Ticket}      label="Current balance"      value={`${detail.ticketStats.currentBalance} tickets`} color="violet" />
          <StatCard icon={TrendingUp}  label="Total tickets earned"  value={`${detail.ticketStats.totalReceived} tickets`} sub={`${detail.ticketStats.totalSpent} spent`} color="emerald" />
          <StatCard icon={DollarSign}  label="Lifetime spend"        value={fmt$(detail.lifetimeSpendCents)} color="sky" />
          <StatCard icon={RefreshCw}   label="Subscription spend"    value={fmt$(detail.subscriptionSpendCents)} color="amber" />
        </div>
        {/* ── Referral info bar ── */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Referral code</span>
            {detail.referralCode
              ? <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{detail.referralCode}</span>
              : <span className="text-sm text-gray-400 italic">None assigned</span>
            }
          </div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <button
            onClick={() => window.open(`/backstage/users?referredBy=${detail.id}`, "_blank")}
            className="flex items-center gap-2 hover:text-violet-600 transition-colors group"
          >
            <Users className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-violet-600">Referrals</span>
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-violet-100 text-violet-700 text-xs font-bold px-1.5">
              {detail.referralCount}
            </span>
          </button>
          {detail.referralCount > 0 && (
            <ReferralListInline userId={detail.id} />
          )}
        </div>

        {/* ── Two-column body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* ── Left: Hunches ── */}
          <div className="space-y-5">

            {/* Hunch participation */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Hunch Participation</SectionTitle>
                <span className="text-xs text-gray-400">{detail.hunchParticipation.length} total</span>
              </div>
              {detail.hunchParticipation.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No predictions yet</p>
              ) : (
                <div className="space-y-2">
                  {detail.hunchParticipation.map((h) => (
                    <div key={h.hunchId} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      h.won ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"
                    }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        h.status === "open" ? "bg-green-100" : h.won ? "bg-amber-100" : "bg-gray-100"
                      }`}>
                        {h.won
                          ? <Trophy className="w-3.5 h-3.5 text-amber-600" />
                          : h.status === "open"
                            ? <Zap className="w-3.5 h-3.5 text-green-600" />
                            : <Target className="w-3.5 h-3.5 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{h.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {h.predictions} prediction{h.predictions !== 1 ? "s" : ""}
                          {h.endsAt && <> · ends {fmtDate(h.endsAt)}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {h.won && h.prizeLabel && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{h.prizeLabel}</span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          h.status === "open"
                            ? "bg-green-100 text-green-700"
                            : h.status === "resolved"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-500"
                        }`}>
                          {h.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prizes won */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Prizes Won</SectionTitle>
                <span className="text-xs text-gray-400">{detail.prizesWon.length} prizes</span>
              </div>
              {detail.prizesWon.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No prizes won yet</p>
              ) : (
                <div className="space-y-2">
                  {detail.prizesWon.map((h) => (
                    <div key={h.hunchId} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{h.title}</p>
                        {h.prizeLabel && <p className="text-xs text-amber-700 font-semibold mt-0.5">{h.prizeLabel}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Profile + Sub + Cards ── */}
          <div className="space-y-5">

            {/* Profile info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionTitle>Profile</SectionTitle>
              <div className="-my-1">
                <EditableInfoRow icon={Mail}    label="Email"         value={detail.email}            onSave={(v) => saveField({ email: v })}     type="email" />
                <EditableInfoRow icon={Phone}   label="Phone"         value={detail.phone ?? ""}      muted={!detail.phone}    onSave={(v) => saveField({ phone: v })}     type="tel" />
                <EditableInfoRow icon={AtSign}  label="Username"      value={detail.username ?? ""}   muted={!detail.username} onSave={(v) => saveField({ username: v })} />
                <EditableInfoRow icon={User}    label="First name"    value={detail.firstName ?? ""}  muted={!detail.firstName}  onSave={(v) => saveField({ firstName: v })} />
                <EditableInfoRow icon={User}    label="Last name"     value={detail.lastName ?? ""}   muted={!detail.lastName}   onSave={(v) => saveField({ lastName: v })} />
                <EditableInfoRow icon={MapPin}  label="Address"       value={detail.address ?? ""}    muted={!detail.address}  onSave={(v) => saveField({ address: v })} />
                <InfoRow        icon={Globe2}   label="Country"       value={detail.country ?? "Unknown"} muted={!detail.country} />
                <EditableInfoRow icon={Calendar} label="Date of birth" value={detail.dateOfBirth ?? ""} displayValue={detail.dateOfBirth ? fmtDate(detail.dateOfBirth + "T00:00:00", { year: "numeric", month: "long", day: "numeric" }) : undefined} muted={!detail.dateOfBirth} onSave={(v) => saveField({ dateOfBirth: v })} type="date" />
                <InfoRow        icon={Calendar} label="Joined"        value={fmtDate(detail.createdAt, { year: "numeric", month: "long", day: "numeric" })} />
                <InfoRow        icon={Clock}    label="Last access"   value={fmtDateTime(detail.lastAccessAt)} muted={!detail.lastAccessAt} />
              </div>
            </div>

            {/* Active hunches */}
            {detail.activeHunches.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <SectionTitle>Active Right Now</SectionTitle>
                <div className="space-y-2">
                  {detail.activeHunches.map((h) => (
                    <div key={h.hunchId} className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <Zap className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">{h.title}</p>
                      <span className="text-xs text-green-700 shrink-0">{h.predictions}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscription */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionTitle>Subscription</SectionTitle>
              {detail.subscription ? (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="w-3.5 h-3.5 text-violet-600" />
                    <p className="text-sm font-semibold text-gray-900 capitalize">{detail.subscription.tier} Plan</p>
                    {detail.subscription.cancelAtPeriodEnd && (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {detail.subscription.ticketsPerMonth} tickets/mo · {detail.subscription.status}
                  </p>
                  {detail.subscription.currentPeriodEnd && (
                    <p className="text-xs text-gray-400 mt-1">
                      {detail.subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} {fmtDate(detail.subscription.currentPeriodEnd)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">No active subscription</p>
              )}
            </div>

            {/* Payment methods */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <SectionTitle>Payment Methods</SectionTitle>
              {detail.paymentMethods.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No saved cards</p>
              ) : (
                <div className="space-y-2">
                  {detail.paymentMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardBrandIcon brand={pm.brand} />
                          <span className="text-sm font-medium text-gray-900">•••• {pm.last4}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Expires {pm.expMonth}/{pm.expYear}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Moderation confirm */}
      {modAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modAction.action === "suspend" ? "bg-yellow-100" :
              modAction.action === "ban" ? "bg-red-100" : "bg-green-100"
            }`}>
              {modAction.action === "suspend" && <ShieldAlert className="w-5 h-5 text-yellow-600" />}
              {modAction.action === "ban" && <Ban className="w-5 h-5 text-red-600" />}
              {modAction.action === "reactivate" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{modLabels[modAction.action].title}</h3>
            <p className="text-sm text-gray-500 mb-5">{modLabels[modAction.action].desc}</p>
            <div className="flex gap-3">
              <button onClick={() => setModAction(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleMod} disabled={modding}
                className={`flex-1 font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60 ${modLabels[modAction.action].confirmCls}`}>
                {modding ? "Saving…" : modLabels[modAction.action].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Delete this account?</h3>
            <p className="text-sm text-gray-500 mb-5">
              The account will be permanently removed. Past predictions remain in the system. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
