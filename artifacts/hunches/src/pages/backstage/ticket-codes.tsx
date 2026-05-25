import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import {
  Ticket, Plus, Pencil, Trash2, RefreshCw, Eye,
  ChevronDown, ChevronUp, Download, Layers, Folder, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CampaignWithStats {
  id: number;
  name: string;
  createdAt: string;
  codeCount: number;
  activeCount: number;
  redemptionCount: number;
}

interface TicketCodeRow {
  id: number;
  campaignId: number | null;
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

type ModalKind = "create" | "edit-campaign" | "bulk-results" | "redemptions" | null;

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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[scope] ?? map["both"]}`}>{scope}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
      type === "generic" ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"
    }`}>{type}</span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function exportCSV(codes: TicketCodeRow[], filename: string): void {
  const headers = ["Code", "Bonus Tickets", "Scope", "Type", "Status", "Starts At", "Expires At", "Created At"];
  const rows = codes.map((c) => [
    c.code, c.bonusTickets, c.scope, c.codeType,
    c.isActive ? "Active" : "Inactive",
    c.startsAt ? new Date(c.startsAt).toISOString() : "",
    c.expiresAt ? new Date(c.expiresAt).toISOString() : "",
    new Date(c.createdAt).toISOString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Code table (shared between campaigns and uncategorized) ───────────────────

function CodeTable({
  codes,
  onViewRedemptions,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  codes: TicketCodeRow[];
  onViewRedemptions: (c: TicketCodeRow) => void;
  onEdit: (c: TicketCodeRow) => void;
  onDelete: (c: TicketCodeRow) => void;
  onToggleActive: (c: TicketCodeRow) => void;
}) {
  if (codes.length === 0) {
    return <div className="px-6 py-8 text-center text-gray-400 text-sm">No codes in this campaign</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
          <th className="px-6 py-2.5 text-left font-semibold">Code</th>
          <th className="px-6 py-2.5 text-left font-semibold">Type</th>
          <th className="px-6 py-2.5 text-left font-semibold">Scope</th>
          <th className="px-6 py-2.5 text-left font-semibold">Bonus</th>
          <th className="px-6 py-2.5 text-left font-semibold">Uses</th>
          <th className="px-6 py-2.5 text-left font-semibold">Expires</th>
          <th className="px-6 py-2.5 text-left font-semibold">Status</th>
          <th className="px-6 py-2.5 text-right font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {codes.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-6 py-2.5">
              <code className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{c.code}</code>
            </td>
            <td className="px-6 py-2.5"><TypeBadge type={c.codeType} /></td>
            <td className="px-6 py-2.5"><ScopeBadge scope={c.scope} /></td>
            <td className="px-6 py-2.5 font-semibold text-violet-700">+{c.bonusTickets}</td>
            <td className="px-6 py-2.5 text-gray-600">
              {c.codeType === "unique"
                ? <span className={c.currentUses >= 1 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{c.currentUses >= 1 ? "Used" : "Available"}</span>
                : <span>{c.currentUses.toLocaleString()}{c.maxUses != null ? ` / ${c.maxUses.toLocaleString()}` : ""}</span>}
            </td>
            <td className="px-6 py-2.5 text-gray-500 text-xs">{fmtDate(c.expiresAt)}</td>
            <td className="px-6 py-2.5">
              <button
                onClick={() => onToggleActive(c)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                  c.isActive ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                }`}
              >{c.isActive ? "Active" : "Inactive"}</button>
            </td>
            <td className="px-6 py-2.5">
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => onViewRedemptions(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Redemptions"><Eye className="w-3.5 h-3.5" /></button>
                <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminTicketCodes() {
  useAdminAuth();

  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [codesMap, setCodesMap] = useState<Record<number, TicketCodeRow[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [uncategorized, setUncategorized] = useState<TicketCodeRow[]>([]);
  const [uncatExpanded, setUncatExpanded] = useState(false);
  const [uncatLoaded, setUncatLoaded] = useState(false);

  // Modals
  const [modal, setModal] = useState<ModalKind>(null);
  const [activeCampaign, setActiveCampaign] = useState<CampaignWithStats | null>(null);
  const [activeCode, setActiveCode] = useState<TicketCodeRow | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<TicketCodeRow[]>([]);

  // Create form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignDropOpen, setCampaignDropOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(50);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatingCode, setGeneratingCode] = useState(false);
  const campaignDropRef = useRef<HTMLDivElement>(null);

  // Edit campaign form
  const [campForm, setCampForm] = useState({
    name: "",
    updateCodes: false,
    isActive: true,
    scope: "both" as "registration" | "general" | "both",
    bonusTickets: 5,
    startsAt: "",
    expiresAt: "",
    instructions: "",
    termsAndConditions: "",
  });
  const [campSaving, setCampSaving] = useState(false);
  const [campError, setCampError] = useState("");

  // Single-code edit (reusing create form as edit mode)
  const [editingCode, setEditingCode] = useState<TicketCodeRow | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadCampaigns = () => {
    setLoading(true);
    adminFetch("/admin/campaigns")
      .then((r) => r.json() as Promise<CampaignWithStats[]>)
      .then((data) => { setCampaigns(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadCampaigns(); }, []);

  // Close campaign combobox on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (campaignDropRef.current && !campaignDropRef.current.contains(e.target as Node)) {
        setCampaignDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const expandCampaign = async (id: number) => {
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }
    setExpandedIds((prev) => new Set([...prev, id]));
    if (!codesMap[id]) {
      setLoadingIds((prev) => new Set([...prev, id]));
      try {
        const codes = await adminFetch(`/admin/campaigns/${id}/codes`).then((r) => r.json() as Promise<TicketCodeRow[]>);
        setCodesMap((prev) => ({ ...prev, [id]: codes }));
      } finally {
        setLoadingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }
  };

  const expandUncategorized = async () => {
    setUncatExpanded((v) => !v);
    if (!uncatLoaded) {
      const codes = await adminFetch("/admin/ticket-codes/uncategorized").then((r) => r.json() as Promise<TicketCodeRow[]>);
      setUncategorized(codes);
      setUncatLoaded(true);
    }
  };

  const refreshCampaignCodes = async (campaignId: number) => {
    const codes = await adminFetch(`/admin/campaigns/${campaignId}/codes`).then((r) => r.json() as Promise<TicketCodeRow[]>);
    setCodesMap((prev) => ({ ...prev, [campaignId]: codes }));
  };

  // ── Campaign actions ──────────────────────────────────────────────────────

  const openEditCampaign = (c: CampaignWithStats) => {
    setActiveCampaign(c);
    setCampForm({ name: c.name, updateCodes: false, isActive: true, scope: "both", bonusTickets: 5, startsAt: "", expiresAt: "", instructions: "", termsAndConditions: "" });
    setCampError("");
    setModal("edit-campaign");
  };

  const saveCampaign = async () => {
    if (!activeCampaign) return;
    setCampError("");
    setCampSaving(true);
    try {
      const body: Record<string, unknown> = { name: campForm.name.trim() };
      if (campForm.updateCodes) {
        body["isActive"] = campForm.isActive;
        body["scope"] = campForm.scope;
        body["bonusTickets"] = campForm.bonusTickets;
        if (campForm.startsAt) body["startsAt"] = campForm.startsAt;
        if (campForm.expiresAt) body["expiresAt"] = campForm.expiresAt;
        if (campForm.instructions) body["instructions"] = campForm.instructions;
        if (campForm.termsAndConditions) body["termsAndConditions"] = campForm.termsAndConditions;
      }
      const r = await adminFetch(`/admin/campaigns/${activeCampaign.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json() as { error?: string }; setCampError(d.error ?? "Failed"); return; }
      setModal(null);
      loadCampaigns();
      if (expandedIds.has(activeCampaign.id)) {
        await refreshCampaignCodes(activeCampaign.id);
      }
    } catch { setCampError("Network error"); }
    finally { setCampSaving(false); }
  };

  const deleteCampaign = async (c: CampaignWithStats) => {
    if (!confirm(`Delete campaign "${c.name}" and all its ${c.codeCount} code${c.codeCount !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    await adminFetch(`/admin/campaigns/${c.id}`, { method: "DELETE" });
    setCodesMap((prev) => { const n = { ...prev }; delete n[c.id]; return n; });
    setExpandedIds((prev) => { const s = new Set(prev); s.delete(c.id); return s; });
    loadCampaigns();
  };

  const exportCampaign = async (c: CampaignWithStats) => {
    const codes = codesMap[c.id] ?? (await adminFetch(`/admin/campaigns/${c.id}/codes`).then((r) => r.json() as Promise<TicketCodeRow[]>));
    exportCSV(codes, `${c.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Code actions ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCode(null);
    setForm({ ...EMPTY_FORM });
    setCampaignQuery("");
    setSelectedCampaignId(null);
    setBulkMode(false);
    setBulkCount(50);
    setFormError("");
    setModal("create");
  };

  const openEditCode = (code: TicketCodeRow) => {
    setEditingCode(code);
    const campaign = campaigns.find((c) => c.id === code.campaignId);
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
    setCampaignQuery(campaign?.name ?? "");
    setSelectedCampaignId(code.campaignId);
    setBulkMode(false);
    setFormError("");
    setModal("create");
  };

  const generateCode = async () => {
    setGeneratingCode(true);
    try {
      const { code } = await adminFetch("/admin/ticket-codes/generate-code").then((r) => r.json() as Promise<{ code: string }>);
      setForm((f) => ({ ...f, code }));
    } finally { setGeneratingCode(false); }
  };

  const saveCode = async () => {
    setFormError(""); setSaving(true);
    try {
      // If new campaign name was typed (no id match), create it first
      let campaignId = selectedCampaignId;
      if (campaignQuery.trim() && !campaignId) {
        const r = await adminFetch("/admin/campaigns", { method: "POST", body: JSON.stringify({ name: campaignQuery.trim() }) });
        const d = await r.json() as { id?: number; error?: string };
        if (!r.ok) { setFormError(d.error ?? "Failed to create campaign"); return; }
        campaignId = d.id ?? null;
        loadCampaigns();
      }
      const body = {
        campaignId,
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
      const url = editingCode ? `/admin/ticket-codes/${editingCode.id}` : "/admin/ticket-codes";
      const method = editingCode ? "PATCH" : "POST";
      const r = await adminFetch(url, { method, body: JSON.stringify(body) });
      const d = await r.json() as { error?: string };
      if (!r.ok) { setFormError(d.error ?? "Failed"); return; }
      setModal(null);
      loadCampaigns();
      if (campaignId && expandedIds.has(campaignId)) await refreshCampaignCodes(campaignId);
      if (editingCode?.campaignId && editingCode.campaignId !== campaignId && expandedIds.has(editingCode.campaignId)) {
        await refreshCampaignCodes(editingCode.campaignId);
      }
    } catch { setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const bulkGenerate = async () => {
    setFormError(""); setSaving(true);
    try {
      let campaignId = selectedCampaignId;
      if (campaignQuery.trim() && !campaignId) {
        const r = await adminFetch("/admin/campaigns", { method: "POST", body: JSON.stringify({ name: campaignQuery.trim() }) });
        const d = await r.json() as { id?: number; error?: string };
        if (!r.ok) { setFormError(d.error ?? "Failed to create campaign"); return; }
        campaignId = d.id ?? null;
        loadCampaigns();
      }
      const r = await adminFetch("/admin/ticket-codes/bulk-generate", {
        method: "POST",
        body: JSON.stringify({
          campaignId, count: bulkCount,
          scope: form.scope, bonusTickets: Number(form.bonusTickets),
          startsAt: form.startsAt || null, expiresAt: form.expiresAt || null,
          instructions: form.instructions || null, termsAndConditions: form.termsAndConditions || null,
          isActive: form.isActive,
        }),
      });
      const d = await r.json() as { codes?: TicketCodeRow[]; error?: string };
      if (!r.ok) { setFormError(d.error ?? "Failed"); return; }
      setBulkResults(d.codes ?? []);
      setModal("bulk-results");
      loadCampaigns();
      if (campaignId && expandedIds.has(campaignId)) await refreshCampaignCodes(campaignId);
    } catch { setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const deleteCode = async (code: TicketCodeRow) => {
    if (!confirm(`Delete code "${code.code}"?`)) return;
    await adminFetch(`/admin/ticket-codes/${code.id}`, { method: "DELETE" });
    loadCampaigns();
    if (code.campaignId && expandedIds.has(code.campaignId)) await refreshCampaignCodes(code.campaignId);
    if (!code.campaignId && uncatLoaded) {
      setUncategorized((prev) => prev.filter((c) => c.id !== code.id));
    }
  };

  const toggleCodeActive = async (code: TicketCodeRow) => {
    await adminFetch(`/admin/ticket-codes/${code.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !code.isActive }) });
    if (code.campaignId && expandedIds.has(code.campaignId)) await refreshCampaignCodes(code.campaignId);
    if (!code.campaignId && uncatLoaded) {
      setUncategorized((prev) => prev.map((c) => c.id === code.id ? { ...c, isActive: !c.isActive } : c));
    }
    loadCampaigns();
  };

  const openRedemptions = async (code: TicketCodeRow) => {
    setActiveCode(code);
    setModal("redemptions");
    setRedemptionsLoading(true);
    try {
      const rows = await adminFetch(`/admin/ticket-codes/${code.id}/redemptions`).then((r) => r.json() as Promise<RedemptionRow[]>);
      setRedemptions(rows);
    } catch { setRedemptions([]); }
    finally { setRedemptionsLoading(false); }
  };

  // ── Campaign combobox helpers ─────────────────────────────────────────────

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(campaignQuery.toLowerCase())
  );
  const exactMatch = campaigns.some((c) => c.name.toLowerCase() === campaignQuery.toLowerCase().trim());

  const selectCampaignOption = (c: CampaignWithStats) => {
    setSelectedCampaignId(c.id);
    setCampaignQuery(c.name);
    setCampaignDropOpen(false);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalCodes = campaigns.reduce((s, c) => s + c.codeCount, 0);
  const totalActive = campaigns.reduce((s, c) => s + c.activeCount, 0);
  const totalRedemptions = campaigns.reduce((s, c) => s + c.redemptionCount, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Codes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Promo codes organized by campaign</p>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 h-9 text-sm font-medium">
            <Plus className="w-4 h-4" />
            New code
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Campaigns", value: campaigns.length },
            { label: "Total codes", value: totalCodes },
            { label: "Active codes", value: totalActive },
            { label: "Total redemptions", value: totalRedemptions.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Campaign list */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 && uncategorized.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-white border border-gray-200 rounded-2xl">
            <Folder className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No campaigns yet — create your first code to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isExpanded = expandedIds.has(campaign.id);
              const isLoadingCodes = loadingIds.has(campaign.id);
              const codes = codesMap[campaign.id] ?? [];

              return (
                <div key={campaign.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Campaign header */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <button
                      onClick={() => expandCampaign(campaign.id)}
                      className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder className="w-4 h-4 text-violet-500 shrink-0" />
                      <button
                        onClick={() => expandCampaign(campaign.id)}
                        className="font-bold text-gray-900 text-base hover:text-violet-700 transition-colors truncate text-left"
                      >
                        {campaign.name}
                      </button>
                    </div>

                    {/* Stats badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
                        {campaign.codeCount} code{campaign.codeCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                        {campaign.activeCount} active
                      </span>
                      {campaign.redemptionCount > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                          {campaign.redemptionCount} redeemed
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditCampaign(campaign)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Edit campaign"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => exportCampaign(campaign)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded codes */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {isLoadingCodes ? (
                        <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading codes...</div>
                      ) : (
                        <CodeTable
                          codes={codes}
                          onViewRedemptions={openRedemptions}
                          onEdit={openEditCode}
                          onDelete={deleteCode}
                          onToggleActive={toggleCodeActive}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized section */}
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={expandUncategorized} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5">
                  {uncatExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={expandUncategorized} className="font-semibold text-gray-500 text-sm hover:text-gray-700 transition-colors text-left flex-1">
                  Uncategorized codes
                </button>
                {uncatLoaded && uncategorized.length > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full font-medium">{uncategorized.length}</span>
                )}
              </div>
              {uncatExpanded && (
                <div className="border-t border-gray-100">
                  {!uncatLoaded ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
                  ) : uncategorized.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">No uncategorized codes</div>
                  ) : (
                    <CodeTable
                      codes={uncategorized}
                      onViewRedemptions={openRedemptions}
                      onEdit={openEditCode}
                      onDelete={deleteCode}
                      onToggleActive={toggleCodeActive}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit code modal ─────────────────────────────────────────── */}
      {modal === "create" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editingCode ? "Edit code" : "New ticket code"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">

              {/* Campaign selector */}
              <div className="space-y-1.5" ref={campaignDropRef}>
                <Label>Campaign <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <input
                    value={campaignQuery}
                    onChange={(e) => { setCampaignQuery(e.target.value); setSelectedCampaignId(null); setCampaignDropOpen(true); }}
                    onFocus={() => setCampaignDropOpen(true)}
                    placeholder="Select or create a campaign..."
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {campaignDropOpen && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
                      {filteredCampaigns.map((c) => (
                        <button
                          key={c.id}
                          onMouseDown={(e) => { e.preventDefault(); selectCampaignOption(c); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-violet-50 transition-colors"
                        >
                          <Folder className="w-3.5 h-3.5 text-violet-400" />
                          <span className="flex-1 font-medium text-gray-800">{c.name}</span>
                          <span className="text-xs text-gray-400">{c.codeCount} codes</span>
                        </button>
                      ))}
                      {campaignQuery.trim() && !exactMatch && (
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setSelectedCampaignId(null); setCampaignDropOpen(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-violet-50 text-violet-700 border-t border-gray-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create "<span className="font-semibold">{campaignQuery.trim()}</span>"
                        </button>
                      )}
                      {filteredCampaigns.length === 0 && !campaignQuery.trim() && (
                        <div className="px-4 py-3 text-sm text-gray-400">Type to create a new campaign</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedCampaignId && (
                  <p className="text-xs text-violet-600 font-medium">Existing campaign selected</p>
                )}
                {campaignQuery.trim() && !selectedCampaignId && !exactMatch && (
                  <p className="text-xs text-emerald-600 font-medium">A new campaign will be created</p>
                )}
              </div>

              {/* Type + Scope */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={form.codeType}
                    onChange={(e) => { const t = e.target.value as "generic" | "unique"; setForm((f) => ({ ...f, codeType: t })); if (t !== "unique") setBulkMode(false); }}
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

              {/* Bulk toggle */}
              {!editingCode && form.codeType === "unique" && (
                <div className={`rounded-xl border-2 transition-colors ${bulkMode ? "border-violet-300 bg-violet-50/50" : "border-gray-200 bg-gray-50/50"}`}>
                  <button type="button" onClick={() => setBulkMode((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-2.5">
                      <Layers className={`w-4 h-4 ${bulkMode ? "text-violet-600" : "text-gray-400"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${bulkMode ? "text-violet-700" : "text-gray-700"}`}>Generate a batch of codes</p>
                        <p className="text-xs text-gray-400 mt-0.5">Create multiple unique codes for this campaign</p>
                      </div>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${bulkMode ? "bg-violet-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${bulkMode ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </button>
                  {bulkMode && (
                    <div className="px-4 pb-4 border-t border-violet-200/60 pt-3">
                      <Label className="mb-1.5 block">Number of codes</Label>
                      <div className="flex items-center gap-3">
                        <Input type="number" min={1} max={500} value={bulkCount} onChange={(e) => setBulkCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))} className="rounded-xl w-28 font-mono" />
                        <span className="text-sm text-gray-500">codes (max 500)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Single code input */}
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
                      <button onClick={generateCode} disabled={generatingCode} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
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
                  <Input type="number" min={1} max={999} value={form.bonusTickets} onChange={(e) => setForm((f) => ({ ...f, bonusTickets: parseInt(e.target.value) || 1 }))} className="rounded-xl" />
                </div>
                {form.codeType === "generic" && (
                  <div className="space-y-1.5">
                    <Label>Max uses <span className="text-gray-400 font-normal">(blank = unlimited)</span></Label>
                    <Input type="number" min={1} value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" className="rounded-xl" />
                  </div>
                )}
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Starts at</Label>
                  <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Expires at</Label>
                  <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="rounded-xl" />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <Label>Instructions <span className="text-gray-400 font-normal">(shown to user)</span></Label>
                <textarea value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              {/* T&C */}
              <div className="space-y-1.5">
                <Label>Terms &amp; Conditions <span className="text-gray-400 font-normal">(optional)</span></Label>
                <textarea value={form.termsAndConditions} onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              {/* Active */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded border-input accent-primary" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>

              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200">{formError}</p>}

              <div className="flex gap-3 pt-1">
                {bulkMode ? (
                  <Button onClick={bulkGenerate} disabled={saving || !campaignQuery.trim()} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold flex items-center justify-center gap-2">
                    <Layers className="w-4 h-4" />
                    {saving ? "Generating..." : `Generate ${bulkCount} codes`}
                  </Button>
                ) : (
                  <Button onClick={saveCode} disabled={saving || (!editingCode && !form.code.trim())} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold">
                    {saving ? "Saving..." : editingCode ? "Save changes" : "Create code"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setModal(null)} className="rounded-xl h-10 px-5">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit campaign modal ──────────────────────────────────────────────── */}
      {modal === "edit-campaign" && activeCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Edit campaign</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Campaign name</Label>
                <Input value={campForm.name} onChange={(e) => setCampForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
              </div>

              {/* Bulk update toggle */}
              <div className={`rounded-xl border-2 transition-colors ${campForm.updateCodes ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-gray-50/50"}`}>
                <button type="button" onClick={() => setCampForm((f) => ({ ...f, updateCodes: !f.updateCodes }))} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className={`text-sm font-semibold ${campForm.updateCodes ? "text-amber-700" : "text-gray-700"}`}>Apply changes to all {activeCampaign.codeCount} codes</p>
                    <p className="text-xs text-gray-400 mt-0.5">Bulk-update all codes in this campaign</p>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${campForm.updateCodes ? "bg-amber-500" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${campForm.updateCodes ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </button>

                {campForm.updateCodes && (
                  <div className="px-4 pb-5 border-t border-amber-200/60 pt-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={campForm.isActive} onChange={(e) => setCampForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded border-input accent-primary" />
                      <span className="text-sm font-medium text-gray-700">Set all codes as {campForm.isActive ? "Active" : "Inactive"}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Scope</Label>
                        <select value={campForm.scope} onChange={(e) => setCampForm((f) => ({ ...f, scope: e.target.value as "registration" | "general" | "both" }))} className="w-full rounded-xl border border-input bg-background h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                          <option value="both">Both</option>
                          <option value="registration">Registration only</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bonus tickets</Label>
                        <Input type="number" min={1} value={campForm.bonusTickets} onChange={(e) => setCampForm((f) => ({ ...f, bonusTickets: parseInt(e.target.value) || 1 }))} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Starts at</Label>
                        <Input type="datetime-local" value={campForm.startsAt} onChange={(e) => setCampForm((f) => ({ ...f, startsAt: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Expires at</Label>
                        <Input type="datetime-local" value={campForm.expiresAt} onChange={(e) => setCampForm((f) => ({ ...f, expiresAt: e.target.value }))} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Instructions</Label>
                      <textarea value={campForm.instructions} onChange={(e) => setCampForm((f) => ({ ...f, instructions: e.target.value }))} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Terms &amp; Conditions</Label>
                      <textarea value={campForm.termsAndConditions} onChange={(e) => setCampForm((f) => ({ ...f, termsAndConditions: e.target.value }))} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                )}
              </div>

              {campError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200">{campError}</p>}
              <div className="flex gap-3 pt-1">
                <Button onClick={saveCampaign} disabled={campSaving || !campForm.name.trim()} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold">
                  {campSaving ? "Saving..." : campForm.updateCodes ? `Save & update ${activeCampaign.codeCount} codes` : "Save campaign"}
                </Button>
                <Button variant="outline" onClick={() => setModal(null)} className="rounded-xl h-10 px-5">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk results modal ──────────────────────────────────────────────── */}
      {modal === "bulk-results" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">{bulkResults.length} unique codes generated</h2>
                <p className="text-xs text-gray-500 mt-0.5">{bulkResults[0]?.scope ?? "both"} scope · +{bulkResults[0]?.bonusTickets ?? 0} tickets each</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
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
                      <td className="px-6 py-2.5"><code className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{c.code}</code></td>
                      <td className="px-6 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="px-6 py-2.5 text-gray-500 text-xs">{fmtDate(c.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <button
                onClick={() => {
                  const name = campaigns.find((c) => c.id === bulkResults[0]?.campaignId)?.name ?? "codes";
                  exportCSV(bulkResults, `${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`);
                }}
                className="flex items-center gap-2 px-4 h-9 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <Button onClick={() => setModal(null)} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9 px-5 font-semibold text-sm">Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Redemptions modal ───────────────────────────────────────────────── */}
      {modal === "redemptions" && activeCode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-900">Redemptions — <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-sm">{activeCode.code}</code></h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeCode.currentUses} total use{activeCode.currentUses !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              {redemptionsLoading ? (
                <div className="text-center text-gray-400 text-sm py-10">Loading...</div>
              ) : redemptions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">No redemptions yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="pb-2 text-left font-semibold">User</th>
                    <th className="pb-2 text-left font-semibold">Context</th>
                    <th className="pb-2 text-left font-semibold">Tickets</th>
                    <th className="pb-2 text-left font-semibold">Date</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-gray-700">{r.userEmail ?? `#${r.userId}`}</td>
                        <td className="py-2.5 pr-4"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{r.context}</span></td>
                        <td className="py-2.5 pr-4 font-semibold text-violet-700">+{r.ticketsGranted}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{new Date(r.redeemedAt).toLocaleString()}</td>
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
