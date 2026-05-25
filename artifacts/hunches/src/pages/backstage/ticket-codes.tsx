import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import {
  Ticket, Plus, Pencil, Trash2, RefreshCw, Eye,
  ChevronDown, ChevronUp, Download, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TicketCodeRow {
  id: number;
  code: string;
  codeType: "generic" | "unique";
  scope: "registration" | "general" | "both";
  bonusTickets: number;
  maxUses: number | null;
  currentUses: number;
  startsAt: string | null;
  expiresAt: string | null;
  instructions: string | null;
  termsAndConditions: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RedemptionRow {
  id: number;
  userId: number;
  userEmail: string | null;
  ticketsGranted: number;
  context: string;
  redeemedAt: string;
}

type ModalState = "create" | "edit" | "redemptions" | "bulk-results" | null;

const EMPTY_FORM = {
  code: "",
  codeType: "generic" as "generic" | "unique",
  scope: "both" as "registration" | "general" | "both",
  bonusTickets: 5,
  maxUses: "" as string,
  startsAt: "",
  expiresAt: "",
  instructions: "",
  termsAndConditions: "",
  isActive: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: string }) {
  const map: Record<string, string> = {
    registration: "bg-blue-50 text-blue-700 border-blue-200",
    general: "bg-amber-50 text-amber-700 border-amber-200",
    both: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[scope] ?? map["both"]}`}>
      {scope}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      type === "generic"
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-orange-50 text-orange-700 border-orange-200"
    }`}>
      {type}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function exportCSV(codes: TicketCodeRow[], filename: string): void {
  const headers = ["Code", "Bonus Tickets", "Scope", "Status", "Starts At", "Expires At", "Created At"];
  const rows = codes.map((c) => [
    c.code,
    c.bonusTickets,
    c.scope,
    c.isActive ? "Active" : "Inactive",
    c.startsAt ? new Date(c.startsAt).toISOString() : "",
    c.expiresAt ? new Date(c.expiresAt).toISOString() : "",
    new Date(c.createdAt).toISOString(),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminTicketCodes() {
  useAdminAuth();

  const [codes, setCodes] = useState<TicketCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [selected, setSelected] = useState<TicketCodeRow | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatingCode, setGeneratingCode] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Bulk state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(50);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState<TicketCodeRow[]>([]);

  const load = () => {
    setLoading(true);
    adminFetch("/admin/ticket-codes")
      .then((r) => r.json() as Promise<TicketCodeRow[]>)
      .then((data) => { setCodes(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setSelected(null);
    setBulkMode(false);
    setBulkCount(50);
    setModal("create");
  };

  const openEdit = (code: TicketCodeRow) => {
    setSelected(code);
    setForm({
      code: code.code,
      codeType: code.codeType,
      scope: code.scope,
      bonusTickets: code.bonusTickets,
      maxUses: code.maxUses != null ? String(code.maxUses) : "",
      startsAt: code.startsAt ? code.startsAt.slice(0, 16) : "",
      expiresAt: code.expiresAt ? code.expiresAt.slice(0, 16) : "",
      instructions: code.instructions ?? "",
      termsAndConditions: code.termsAndConditions ?? "",
      isActive: code.isActive,
    });
    setFormError("");
    setBulkMode(false);
    setModal("edit");
  };

  const openRedemptions = async (code: TicketCodeRow) => {
    setSelected(code);
    setModal("redemptions");
    setRedemptionsLoading(true);
    try {
      const r = await adminFetch(`/admin/ticket-codes/${code.id}/redemptions`);
      const data = await r.json() as RedemptionRow[];
      setRedemptions(data);
    } catch {
      setRedemptions([]);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const generateCode = async () => {
    setGeneratingCode(true);
    try {
      const r = await adminFetch("/admin/ticket-codes/generate-code");
      const { code } = await r.json() as { code: string };
      setForm((f) => ({ ...f, code }));
    } catch {
      // ignore
    } finally {
      setGeneratingCode(false);
    }
  };

  const save = async () => {
    setFormError("");
    setSaving(true);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        codeType: form.codeType,
        scope: form.scope,
        bonusTickets: Number(form.bonusTickets),
        maxUses: form.maxUses !== "" ? Number(form.maxUses) : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        instructions: form.instructions || null,
        termsAndConditions: form.termsAndConditions || null,
        isActive: form.isActive,
      };
      const url = modal === "edit" && selected ? `/admin/ticket-codes/${selected.id}` : "/admin/ticket-codes";
      const method = modal === "edit" ? "PATCH" : "POST";
      const r = await adminFetch(url, { method, body: JSON.stringify(body) });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setFormError(data.error ?? "Failed to save"); return; }
      setModal(null);
      load();
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const bulkGenerate = async () => {
    setFormError("");
    setBulkGenerating(true);
    try {
      const body = {
        count: bulkCount,
        scope: form.scope,
        bonusTickets: Number(form.bonusTickets),
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        instructions: form.instructions || null,
        termsAndConditions: form.termsAndConditions || null,
        isActive: form.isActive,
      };
      const r = await adminFetch("/admin/ticket-codes/bulk-generate", { method: "POST", body: JSON.stringify(body) });
      const data = await r.json() as { codes?: TicketCodeRow[]; error?: string };
      if (!r.ok) { setFormError(data.error ?? "Failed to generate codes"); return; }
      setBulkResults(data.codes ?? []);
      setModal("bulk-results");
      load();
    } catch {
      setFormError("Network error");
    } finally {
      setBulkGenerating(false);
    }
  };

  const remove = async (code: TicketCodeRow) => {
    if (!confirm(`Delete code "${code.code}"? This cannot be undone.`)) return;
    await adminFetch(`/admin/ticket-codes/${code.id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (code: TicketCodeRow) => {
    await adminFetch(`/admin/ticket-codes/${code.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !code.isActive }),
    });
    load();
  };

  const campaignSlug = (() => {
    const instr = form.instructions.trim();
    if (instr) {
      return instr.slice(0, 20).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-";
    }
    return "";
  })();

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Codes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage promo codes that grant bonus tickets to users</p>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 h-9 text-sm font-medium">
            <Plus className="w-4 h-4" />
            New code
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total codes", value: codes.length },
            { label: "Active", value: codes.filter((c) => c.isActive).length },
            { label: "Registration-scoped", value: codes.filter((c) => c.scope === "registration" || c.scope === "both").length },
            { label: "Total redemptions", value: codes.reduce((s, c) => s + c.currentUses, 0).toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
          ) : codes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Ticket className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No ticket codes yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 text-left font-semibold">Code</th>
                  <th className="px-6 py-3 text-left font-semibold">Type</th>
                  <th className="px-6 py-3 text-left font-semibold">Scope</th>
                  <th className="px-6 py-3 text-left font-semibold">Bonus</th>
                  <th className="px-6 py-3 text-left font-semibold">Uses</th>
                  <th className="px-6 py-3 text-left font-semibold">Expires</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {codes.map((c) => (
                  <>
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {expandedId === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <code className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{c.code}</code>
                        </div>
                      </td>
                      <td className="px-6 py-3"><TypeBadge type={c.codeType} /></td>
                      <td className="px-6 py-3"><ScopeBadge scope={c.scope} /></td>
                      <td className="px-6 py-3 font-semibold text-violet-700">+{c.bonusTickets}</td>
                      <td className="px-6 py-3 text-gray-600">
                        {c.codeType === "unique" ? (
                          <span className={c.currentUses >= 1 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                            {c.currentUses >= 1 ? "Used" : "Available"}
                          </span>
                        ) : (
                          <span>{c.currentUses.toLocaleString()}{c.maxUses != null ? ` / ${c.maxUses.toLocaleString()}` : ""}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{fmtDate(c.expiresAt)}</td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => toggleActive(c)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                            c.isActive
                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openRedemptions(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View redemptions"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`} className="bg-gray-50/80">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {c.instructions && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Instructions</p>
                                <p className="text-gray-700 whitespace-pre-wrap">{c.instructions}</p>
                              </div>
                            )}
                            {c.termsAndConditions && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms &amp; Conditions</p>
                                <p className="text-gray-700 whitespace-pre-wrap">{c.termsAndConditions}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Validity</p>
                              <p className="text-gray-700">
                                {c.startsAt ? `From ${fmtDate(c.startsAt)}` : "No start date"} &mdash; {c.expiresAt ? `Until ${fmtDate(c.expiresAt)}` : "No expiry"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created</p>
                              <p className="text-gray-700">{fmtDate(c.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">{modal === "create" ? "New ticket code" : "Edit ticket code"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-5">

              {/* Type + Scope */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={form.codeType}
                    onChange={(e) => {
                      const t = e.target.value as "generic" | "unique";
                      setForm((f) => ({ ...f, codeType: t }));
                      if (t !== "unique") setBulkMode(false);
                    }}
                    className="w-full rounded-xl border border-input bg-background h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="generic">Generic (reusable)</option>
                    <option value="unique">Unique (single-use)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "registration" | "general" | "both" }))}
                    className="w-full rounded-xl border border-input bg-background h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="both">Both (registration + general)</option>
                    <option value="registration">Registration only</option>
                    <option value="general">General (existing users)</option>
                  </select>
                </div>
              </div>

              {/* Bulk toggle — only for unique type on create */}
              {modal === "create" && form.codeType === "unique" && (
                <div className={`rounded-xl border-2 transition-colors ${bulkMode ? "border-violet-300 bg-violet-50/50" : "border-gray-200 bg-gray-50/50"}`}>
                  <button
                    type="button"
                    onClick={() => setBulkMode((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className={`w-4 h-4 ${bulkMode ? "text-violet-600" : "text-gray-400"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${bulkMode ? "text-violet-700" : "text-gray-700"}`}>
                          Generate a batch of codes
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Create multiple unique codes for a campaign</p>
                      </div>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${bulkMode ? "bg-violet-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${bulkMode ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </button>

                  {bulkMode && (
                    <div className="px-4 pb-4 border-t border-violet-200/60 pt-3">
                      <Label className="mb-1.5 block">Number of codes to generate</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={bulkCount}
                          onChange={(e) => setBulkCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="rounded-xl w-32 font-mono"
                        />
                        <span className="text-sm text-gray-500">codes (max 500)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Single code input — only when not in bulk mode */}
              {!bulkMode && (
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder={form.codeType === "unique" ? "Auto-generated" : "NBA2026"}
                      className="rounded-xl font-mono uppercase"
                    />
                    {form.codeType === "unique" && (
                      <button
                        onClick={generateCode}
                        disabled={generatingCode}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? "animate-spin" : ""}`} />
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bonus + Max uses */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Bonus tickets</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={form.bonusTickets}
                    onChange={(e) => setForm((f) => ({ ...f, bonusTickets: parseInt(e.target.value) || 1 }))}
                    className="rounded-xl"
                  />
                </div>
                {form.codeType === "generic" && (
                  <div className="space-y-1.5">
                    <Label>Max uses <span className="text-gray-400 font-normal">(blank = unlimited)</span></Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.maxUses}
                      onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                      placeholder="Unlimited"
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Validity window */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Starts at</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expires at</Label>
                  <Input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <Label>Instructions <span className="text-gray-400 font-normal">(shown to user when redeeming)</span></Label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  rows={3}
                  placeholder="e.g. This code is valid for new users registering during the NBA 2026 season..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Terms */}
              <div className="space-y-1.5">
                <Label>Terms &amp; Conditions <span className="text-gray-400 font-normal">(optional)</span></Label>
                <textarea
                  value={form.termsAndConditions}
                  onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))}
                  rows={3}
                  placeholder="e.g. One per account. Cannot be combined with other offers..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Active */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-input accent-primary"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                {bulkMode ? (
                  <Button
                    onClick={bulkGenerate}
                    disabled={bulkGenerating || bulkCount < 1}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold flex items-center justify-center gap-2"
                  >
                    <Layers className="w-4 h-4" />
                    {bulkGenerating ? "Generating..." : `Generate ${bulkCount} codes`}
                  </Button>
                ) : (
                  <Button
                    onClick={save}
                    disabled={saving || (!bulkMode && !form.code.trim())}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold"
                  >
                    {saving ? "Saving..." : modal === "create" ? "Create code" : "Save changes"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setModal(null)}
                  className="rounded-xl h-10 px-5"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk results modal ──────────────────────────────────────────────── */}
      {modal === "bulk-results" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">
                  {bulkResults.length} unique code{bulkResults.length !== 1 ? "s" : ""} generated
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bulkResults[0]?.scope ?? "both"} scope · +{bulkResults[0]?.bonusTickets ?? 0} tickets each ·{" "}
                  {bulkResults[0]?.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>

            {/* Code list */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-2.5 text-left font-semibold">#</th>
                    <th className="px-6 py-2.5 text-left font-semibold">Code</th>
                    <th className="px-6 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-6 py-2.5 text-left font-semibold">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bulkResults.map((c, i) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-6 py-2.5">
                        <code className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-wider">{c.code}</code>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-gray-500 text-xs">{fmtDate(c.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <button
                onClick={() => exportCSV(bulkResults, `ticket-codes-${campaignSlug}${new Date().toISOString().slice(0, 10)}.csv`)}
                className="flex items-center gap-2 px-4 h-9 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <Button
                onClick={() => setModal(null)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9 px-5 font-semibold text-sm"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Redemptions modal ───────────────────────────────────────────────── */}
      {modal === "redemptions" && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-900">Redemptions for <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-sm">{selected.code}</code></h2>
                <p className="text-xs text-gray-500 mt-0.5">{selected.currentUses} total use{selected.currentUses !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div className="p-6">
              {redemptionsLoading ? (
                <div className="text-center text-gray-400 text-sm py-10">Loading...</div>
              ) : redemptions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">No redemptions yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                      <th className="pb-2 text-left font-semibold">User</th>
                      <th className="pb-2 text-left font-semibold">Context</th>
                      <th className="pb-2 text-left font-semibold">Tickets</th>
                      <th className="pb-2 text-left font-semibold">Redeemed at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-gray-700">{r.userEmail ?? `#${r.userId}`}</td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{r.context}</span>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-violet-700">+{r.ticketsGranted}</td>
                        <td className="py-2.5 text-gray-500">{new Date(r.redeemedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
