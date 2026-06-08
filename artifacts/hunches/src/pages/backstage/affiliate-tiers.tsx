import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch, useAdminAuth } from "./dashboard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, X, Loader2, Award, GitBranch } from "lucide-react";

interface Tier {
  id: number;
  name: string;
  minActivePremiumUsers: number;
  maxActivePremiumUsers: number | null;
  commissionPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function TierForm({ initial, onClose, onSaved }: { initial?: Tier; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [minUsers, setMinUsers] = useState(String(initial?.minActivePremiumUsers ?? 0));
  const [maxUsers, setMaxUsers] = useState(initial?.maxActivePremiumUsers != null ? String(initial.maxActivePremiumUsers) : "");
  const [pct, setPct] = useState(String(initial?.commissionPercentage ?? 20));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const method = initial ? "PUT" : "POST";
      const url = initial ? `/admin/affiliate-tiers/${initial.id}` : "/admin/affiliate-tiers";
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify({
          name,
          minActivePremiumUsers: Number(minUsers),
          maxActivePremiumUsers: maxUsers.trim() ? Number(maxUsers) : null,
          commissionPercentage: Number(pct),
          isActive,
        }),
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
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{initial ? "Edit tier" : "Create tier"}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tier name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Starter" required className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Min active premium users</Label>
              <Input type="number" min={0} value={minUsers} onChange={e => setMinUsers(e.target.value)} required className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Max <span className="text-muted-foreground text-xs">(blank = unlimited)</span></Label>
              <Input type="number" min={0} value={maxUsers} onChange={e => setMaxUsers(e.target.value)} placeholder="Unlimited" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Commission percentage</Label>
            <div className="relative">
              <Input type="number" min={0} max={100} value={pct} onChange={e => setPct(e.target.value)} required className="rounded-xl pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="tier-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <Label htmlFor="tier-active">Active</Label>
          </div>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button type="submit" disabled={loading} className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initial ? "Save changes" : "Create tier"}
          </Button>
        </div>
      </form>
    </div>
  );
}

const TIER_COLORS = ["bg-zinc-100 text-zinc-700", "bg-violet-100 text-violet-700", "bg-indigo-100 text-indigo-700", "bg-amber-100 text-amber-700"];

function SubAffiliateRateCard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-sub-affiliate-rate"],
    queryFn: async () => {
      const res = await adminFetch("/admin/settings/sub-affiliate-rate");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ pct: number }>;
    },
  });

  function startEdit() {
    setDraft(String(data?.pct ?? 3));
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const res = await adminFetch("/admin/settings/sub-affiliate-rate", {
        method: "PUT",
        body: JSON.stringify({ pct: Number(draft) }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(d.error ?? "Error"); return; }
      qc.invalidateQueries({ queryKey: ["admin-sub-affiliate-rate"] });
      setEditing(false);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  const currentPct = data?.pct ?? 3;

  return (
    <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-600" />
          <div>
            <p className="font-bold text-foreground">Sub-affiliate commission</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When affiliate A refers affiliate B, A earns this % of B's generated commissions.
            </p>
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">{currentPct}%</span>
            <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-indigo-100 transition-colors" title="Edit rate">
              <Pencil className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-[120px]">
            <Input
              type="number"
              min={0}
              max={100}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="rounded-xl pr-8"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">Cancel</Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminAffiliateTiers() {
  useAdminAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliate-tiers"],
    queryFn: async () => {
      const res = await adminFetch("/admin/affiliate-tiers");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { tiers: Tier[] };
      return d.tiers ?? [];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-affiliate-tiers"] });
    setShowCreate(false);
    setEditing(null);
  }

  async function deleteTier(id: number) {
    if (!confirm("Delete this tier?")) return;
    await adminFetch(`/admin/affiliate-tiers/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-violet-600" /> Commission Tiers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure affiliate commission tiers</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
            <Plus className="w-4 h-4" /> New tier
          </Button>
        </div>

        {/* Sub-affiliate rate */}
        <SubAffiliateRateCard />

        {/* Tiers */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.length ? (
          <div className="text-center py-12 text-muted-foreground">No tiers configured.</div>
        ) : (
          <div className="space-y-4">
            {data.map((tier, idx) => (
              <div key={tier.id} className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-background hover:bg-muted/20 transition-colors">
                <div className={`px-3 py-1 rounded-full text-sm font-bold shrink-0 ${TIER_COLORS[idx % TIER_COLORS.length]}`}>
                  {tier.commissionPercentage}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{tier.name}</p>
                    {!tier.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {tier.minActivePremiumUsers}
                    {tier.maxActivePremiumUsers != null ? ` – ${tier.maxActivePremiumUsers}` : "+"} active premium users
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditing(tier)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Edit">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteTier(tier.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">How tiers work</p>
          <p>An affiliate's tier is determined by their current number of active premium users referred. The commission percentage is applied to revenue generated by those users. Tiers are recalculated on each commission event.</p>
          <p className="mt-2">Ticket purchases always earn a flat <strong>10% commission</strong>, regardless of tier.</p>
        </div>
      </div>

      {(showCreate || editing) && (
        <TierForm
          initial={editing ?? undefined}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={refresh}
        />
      )}
    </AdminLayout>
  );
}
