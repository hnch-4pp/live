import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch, useAdminAuth } from "./dashboard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ExternalLink, Pencil, Loader2, Check, X,
  TrendingUp, Users, Award, DollarSign,
  Clock, CheckCircle2, ArrowUpRight, Globe,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AffiliateRecord {
  id: number; name: string; slug: string; email: string;
  status: "pending" | "active" | "suspended" | "rejected";
  bio: string | null; niche: string | null; avatarUrl: string | null;
  socialLinks: Record<string, string> | null;
  referredByUsername: string | null;
  createdAt: string; approvedAt: string | null;
}

interface DetailData {
  affiliate: AffiliateRecord;
  stats: {
    totalClicks: number; totalSignups: number; activePremiumUsers: number;
    conversionRate: number;
    commissionPending: number; commissionApproved: number;
    commissionPaid: number; commissionTotal: number;
  };
  tier: {
    current: { id: number; name: string; commissionPercentage: number } | null;
    next: { id: number; name: string; minActivePremiumUsers: number; commissionPercentage: number } | null;
    activePremiumCount: number;
    usersToNextTier: number;
  };
  referrals: { id: number; status: string; signupAt: string; convertedAt: string | null; username: string | null }[];
  commissions: { id: number; commissionAmount: number; revenueAmount: number; commissionPercentage: number; status: string; earnedAt: string; commissionType: string }[];
  payouts: { id: number; amount: number; status: string; periodStart: string | null; periodEnd: string | null; paidAt: string | null; paymentReference: string | null }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700",
  active:     "bg-green-100 text-green-700",
  suspended:  "bg-red-100 text-red-700",
  rejected:   "bg-zinc-100 text-zinc-600",
  signed_up:  "bg-blue-100 text-blue-700",
  converted:  "bg-green-100 text-green-700",
  cancelled:  "bg-red-100 text-red-700",
  approved:   "bg-green-100 text-green-700",
  paid:       "bg-emerald-100 text-emerald-700",
  processing: "bg-indigo-100 text-indigo-700",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

const SOCIAL_LABELS: Record<string, string> = {
  x: "X (Twitter)", instagram: "Instagram", tiktok: "TikTok",
  youtube: "YouTube", facebook: "Facebook", discord: "Discord",
  twitch: "Twitch", linkedin: "LinkedIn",
};

// ── Inline edit form ───────────────────────────────────────────────────────────

function EditForm({ aff, onSaved, onCancel }: { aff: AffiliateRecord; onSaved: () => void; onCancel: () => void }) {
  const [name, setName]     = useState(aff.name);
  const [email, setEmail]   = useState(aff.email);
  const [slug, setSlug]     = useState(aff.slug);
  const [bio, setBio]       = useState(aff.bio ?? "");
  const [niche, setNiche]   = useState(aff.niche ?? "");
  const [status, setStatus] = useState(aff.status as string);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await adminFetch(`/admin/affiliates/${aff.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, email, slug, bio, niche, status }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      onSaved();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={save} className="bg-background rounded-2xl border border-border p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-base">Editar afiliado</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label>Slug</Label>
          <Input
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
            required className="rounded-xl font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label>Niche</Label>
          <Input value={niche} onChange={e => setNiche(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Bio</Label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
        <Button type="submit" disabled={loading} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminAffiliateDetail() {
  useAdminAuth();
  const [, params] = useRoute("/backstage/affiliates/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);

  const [data, setData]     = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab]       = useState<"referrals" | "commissions" | "payouts">("referrals");

  function load() {
    setLoading(true);
    adminFetch(`/admin/affiliates/${id}`)
      .then(r => r.json() as Promise<DetailData>)
      .then(d => { setData(d); setEditing(false); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (id) load(); }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Afiliado no encontrado.</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setLocation("/backstage/affiliates")}>
            Volver
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const { affiliate, stats, tier, referrals, commissions, payouts } = data;
  const link = `hunch.fan/${affiliate.slug}`;
  const tierPct = tier.current?.commissionPercentage ?? 0;
  const nextProgress = tier.next
    ? Math.min(100, Math.round((tier.activePremiumCount / tier.next.minActivePremiumUsers) * 100))
    : 100;

  const socialEntries = Object.entries(affiliate.socialLinks ?? {}).filter(([, v]) => v);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Back + header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/backstage/affiliates")}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-black text-lg shrink-0">
              {affiliate.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-black">{affiliate.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge status={affiliate.status} />
                {affiliate.niche && <span className="text-xs text-muted-foreground">{affiliate.niche}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border text-sm font-mono">
              <span>{link}</span>
              <a href={`/${affiliate.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <Button
              variant="outline"
              onClick={() => setEditing(e => !e)}
              className="rounded-xl gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          </div>
        </div>

        {/* Edit form (inline, collapsible) */}
        {editing && (
          <EditForm aff={affiliate} onSaved={load} onCancel={() => setEditing(false)} />
        )}

        {/* Profile card */}
        <div className="bg-background border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Ficha del afiliado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
              <p className="font-semibold">{affiliate.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
              <p className="font-semibold">{affiliate.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Slug</p>
              <p className="font-semibold font-mono">/{affiliate.slug}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Niche</p>
              <p className="font-semibold">{affiliate.niche ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Recomendado por</p>
              <p className="font-semibold">{affiliate.referredByUsername ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Registrado</p>
              <p className="font-semibold">{new Date(affiliate.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Aprobado</p>
              <p className="font-semibold">
                {affiliate.approvedAt
                  ? new Date(affiliate.approvedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
                  : <span className="text-muted-foreground">Pendiente</span>}
              </p>
            </div>
            {affiliate.bio && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Bio</p>
                <p className="text-foreground leading-relaxed">{affiliate.bio}</p>
              </div>
            )}
            {socialEntries.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-2">Perfiles sociales</p>
                <div className="flex flex-wrap gap-2">
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted text-xs font-medium hover:border-violet-300 hover:text-violet-700 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      {SOCIAL_LABELS[key] ?? key}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tier progress */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-violet-600" />
              <span className="font-bold">{tier.current?.name ?? "Starter"}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{tierPct}% comisión</span>
            </div>
            {tier.next && (
              <span className="text-xs text-muted-foreground">
                {tier.usersToNextTier} usuarios para {tier.next.name} ({tier.next.commissionPercentage}%)
              </span>
            )}
          </div>
          {tier.next && (
            <div className="w-full h-2 rounded-full bg-violet-200 overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${nextProgress}%` }} />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total clicks",    value: stats.totalClicks,         icon: <TrendingUp className="w-4 h-4" /> },
            { label: "Signups",         value: stats.totalSignups,        sub: `${stats.conversionRate}% conversión`, icon: <Users className="w-4 h-4" /> },
            { label: "Premium activos", value: stats.activePremiumUsers,  icon: <Award className="w-4 h-4" /> },
            { label: "Comisión total",  value: fmt(stats.commissionTotal), icon: <DollarSign className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="bg-background border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">{s.icon}</div>
              </div>
              <p className="text-2xl font-black">{s.value}</p>
              {"sub" in s && s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Commission breakdown */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pendiente",  value: fmt(stats.commissionPending),  icon: <Clock className="w-4 h-4" />,        color: "text-amber-600 bg-amber-50 border-amber-200" },
            { label: "Aprobado",   value: fmt(stats.commissionApproved), icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600 bg-green-50 border-green-200" },
            { label: "Pagado",     value: fmt(stats.commissionPaid),     icon: <ArrowUpRight className="w-4 h-4" />, color: "text-violet-600 bg-violet-50 border-violet-200" },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
              <div className="flex items-center gap-2 mb-1">{c.icon}<p className="text-xs font-semibold">{c.label}</p></div>
              <p className="text-xl font-black">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Referrals / Commissions / Payouts */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="flex border-b border-border">
            {(["referrals", "commissions", "payouts"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-background text-foreground border-b-2 border-violet-600" : "text-muted-foreground hover:text-foreground bg-muted/40"}`}
              >
                {t === "referrals" ? `Referidos (${referrals.length})`
                  : t === "commissions" ? `Comisiones (${commissions.length})`
                  : `Pagos (${payouts.length})`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {tab === "referrals" && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Registro</th>
                    <th className="text-left px-4 py-3 font-medium">Conversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Sin referidos aún.</td></tr>
                  ) : referrals.map(r => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.username ? `@${r.username}` : `Usuario #${r.id}`}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
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
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium">Ingreso</th>
                    <th className="text-left px-4 py-3 font-medium">Tasa</th>
                    <th className="text-left px-4 py-3 font-medium">Comisión</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Sin comisiones aún.</td></tr>
                  ) : commissions.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.earnedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 capitalize">{c.commissionType.replace("_", " ")}</td>
                      <td className="px-4 py-3">{fmt(c.revenueAmount)}</td>
                      <td className="px-4 py-3">{c.commissionPercentage}%</td>
                      <td className="px-4 py-3 font-semibold">{fmt(c.commissionAmount)}</td>
                      <td className="px-4 py-3"><Badge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "payouts" && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Período</th>
                    <th className="text-left px-4 py-3 font-medium">Monto</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Pagado</th>
                    <th className="text-left px-4 py-3 font-medium">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Sin pagos aún.</td></tr>
                  ) : payouts.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.periodStart ? new Date(p.periodStart).toLocaleDateString() : "—"}
                        {" – "}
                        {p.periodEnd ? new Date(p.periodEnd).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(p.amount)}</td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
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
    </AdminLayout>
  );
}
