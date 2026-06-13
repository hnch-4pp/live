import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { apiUrl } from "@/lib/apiFetch";
import { adminFetch, useAdminAuth } from "./dashboard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Users, Search, Plus, Mail, Check, X, Pencil, Eye,
  Loader2, ExternalLink, Trash2,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Affiliate {
  id: number; name: string; slug: string; email: string;
  status: "pending" | "active" | "suspended" | "rejected";
  bio: string | null; niche: string | null; avatarUrl: string | null;
  createdAt: string; approvedAt: string | null;
}

interface AffiliateDetail {
  affiliate: Affiliate;
  stats: { totalClicks: number; totalSignups: number; totalCommission: number; activePremiumUsers: number };
  tier: { name: string; commissionPercentage: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  active:    "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  rejected:  "bg-zinc-100 text-zinc-600",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

// ── Create / Edit Modal ────────────────────────────────────────────────────────

interface AffiliateFormProps {
  initial?: Affiliate;
  onClose: () => void;
  onSaved: () => void;
}

function AffiliateForm({ initial, onClose, onSaved }: AffiliateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [niche, setNiche] = useState(initial?.niche ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const method = initial ? "PUT" : "POST";
      const url = initial ? `/admin/affiliates/${initial.id}` : "/admin/affiliates";
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify({ name, email, slug, bio, niche, status }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      onSaved();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="bg-background rounded-2xl border border-border p-6 w-full max-w-md space-y-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg">{initial ? "Edit affiliate" : "Create affiliate"}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Escorpion Dorado" required className="rounded-xl" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="creator@email.com" required className="rounded-xl" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
              placeholder="escorpiondorado"
              required
              className="rounded-xl font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label>Niche</Label>
            <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Sports" className="rounded-xl" />
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
          <div className="space-y-1 col-span-2">
            <Label>Bio</Label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button type="submit" disabled={loading} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initial ? "Save changes" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await adminFetch("/admin/affiliates/invite", {
        method: "POST",
        body: JSON.stringify({ name, email, slug, message }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setSuccess(true);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={send} className="bg-background rounded-2xl border border-border p-6 w-full max-w-md space-y-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg">Invite affiliate</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {success ? (
          <div className="text-center py-6">
            <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="font-bold">Invitation sent</p>
            <p className="text-sm text-muted-foreground mt-1">The creator will receive an email with their invite link.</p>
            <Button type="button" onClick={onClose} className="mt-4 rounded-xl">Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Creator name</Label><Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl" /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl" /></div>
              <div className="space-y-1"><Label>Suggested slug</Label><Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} className="rounded-xl font-mono" /></div>
              <div className="space-y-1">
                <Label>Personal message <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1" /> Send invite</>}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function DetailDrawer({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (aff: Affiliate) => void }) {
  const [data, setData] = useState<AffiliateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`/admin/affiliates/${id}`)
      .then(r => r.json() as Promise<AffiliateDetail>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl border border-border p-6 w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Affiliate detail</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !data ? (
          <p className="text-muted-foreground text-center py-10">Failed to load</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-lg shrink-0">
                {data.affiliate.name[0]}
              </div>
              <div>
                <p className="font-bold">{data.affiliate.name}</p>
                <p className="text-sm text-muted-foreground">{data.affiliate.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge status={data.affiliate.status} />
                  {data.tier && <span className="text-xs text-muted-foreground">{data.tier.name} ({data.tier.commissionPercentage}%)</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted font-mono text-sm">
              <span>hunch.fan/{data.affiliate.slug}</span>
              <a href={`/${data.affiliate.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /></a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Clicks", value: data.stats.totalClicks },
                { label: "Signups", value: data.stats.totalSignups },
                { label: "Premium active", value: data.stats.activePremiumUsers },
                { label: "Commission", value: fmt(data.stats.totalCommission) },
              ].map(s => (
                <div key={s.label} className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-sm mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            {data.affiliate.bio && <p className="text-sm text-muted-foreground">{data.affiliate.bio}</p>}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onEdit(data.affiliate)} className="flex-1 rounded-xl gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminAffiliates() {
  useAdminAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliates", q, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      const res = await adminFetch(`/admin/affiliates?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { affiliates: Affiliate[] };
      return d.affiliates ?? [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ["admin-affiliates-metrics"],
    queryFn: async () => {
      const res = await adminFetch("/admin/affiliates-metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
    qc.invalidateQueries({ queryKey: ["admin-affiliates-metrics"] });
    setShowCreate(false);
    setEditing(null);
  }

  const m = metrics as { totalAffiliates?: number; activeAffiliates?: number; totalClicks?: number; totalSignups?: number; commissionPending?: number };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-violet-600" /> Affiliates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage the affiliate program</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowInvite(true)} className="rounded-xl gap-1.5">
              <Mail className="w-4 h-4" /> Invite
            </Button>
            <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </div>
        </div>

        {/* Global stats */}
        {m && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total", value: m.totalAffiliates ?? 0 },
              { label: "Active", value: m.activeAffiliates ?? 0 },
              { label: "Clicks", value: m.totalClicks ?? 0 },
              { label: "Signups", value: m.totalSignups ?? 0 },
              { label: "Pending commission", value: `$${((m.commissionPending ?? 0) / 100).toFixed(2)}` },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-xl p-3 border border-border">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, slug, email..." className="pl-9 rounded-xl" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name / slug</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" /></td></tr>
                ) : !data?.length ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No affiliates found.</td></tr>
                ) : data.map(aff => (
                  <tr key={aff.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{aff.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">/{aff.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{aff.email}</td>
                    <td className="px-4 py-3"><Badge status={aff.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(aff.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setLocation(`/backstage/affiliates/${aff.id}`)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ver perfil">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => setEditing(aff)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {aff.status === "pending" && (
                          <button
                            onClick={async () => {
                              await adminFetch(`/admin/affiliates/${aff.id}`, { method: "PUT", body: JSON.stringify({ status: "active" }) });
                              refresh();
                            }}
                            className="p-1.5 rounded-lg hover:bg-green-100 transition-colors" title="Approve"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {aff.status === "active" && (
                          <button
                            onClick={async () => {
                              await adminFetch(`/admin/affiliates/${aff.id}`, { method: "PUT", body: JSON.stringify({ status: "suspended" }) });
                              refresh();
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-100 transition-colors" title="Suspend"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                        {(aff.status === "pending" || aff.status === "rejected") && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete "${aff.name}"? This cannot be undone.`)) return;
                              const res = await adminFetch(`/admin/affiliates/${aff.id}`, { method: "DELETE" });
                              if (!res.ok) {
                                const d = await res.json() as { error?: string };
                                alert(d.error ?? "Error deleting affiliate");
                                return;
                              }
                              refresh();
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-100 transition-colors" title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(showCreate || editing) && (
        <AffiliateForm
          initial={editing ?? undefined}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={refresh}
        />
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </AdminLayout>
  );
}
