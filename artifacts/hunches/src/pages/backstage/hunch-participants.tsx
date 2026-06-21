import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import {
  ChevronLeft, Users, Trophy, X, Loader2, ArrowUpDown,
  CheckCircle2, SlidersHorizontal, AlertTriangle, Ban, Gift,
  MailCheck, Key, Link as LinkIcon, QrCode, BarChart2, Calendar,
  Truck, Package,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PrizeTier { rank: number; prizeLabel: string; prizeValue: string; }
interface HunchDetail {
  id: number; title: string; isMulti: boolean; status: string;
  winnerOption: string | null; winnerUserId: number | null;
  winnerRanks: string | null;
  prizeTiers: PrizeTier[];
}

interface UserAnswer { questionId: number; questionPrompt: string; answerLabel: string; }
interface UserPredGroup { userId: number; username: string | null; phone: string | null; answers: UserAnswer[]; firstAt: string; }
interface PredParticipant { id: number; userId: number | null; username: string | null; phone: string | null; createdAt: string; optionLabel: string; }
interface PredData { total: number; byOption: Array<{ label: string; count: number; pct: number; participants: Array<Omit<PredParticipant, "optionLabel">>; }>; byUser: UserPredGroup[]; }

interface AwardRecord {
  id: number;
  userId: number;
  rank: number | null;
  prizeLabel: string;
  prizeValue: string;
  awardType: "digital" | "physical";
  codeType: string | null;
  code: string | null;
  codeFileUrl: string | null;
  pin: string | null;
  expiresAt: string | null;
  usageInstructions: string | null;
  trackingNumber: string | null;
  courier: string | null;
  estimatedDelivery: string | null;
  terms: string | null;
  awardedAt: string;
  emailSentAt: string | null;
}

type SortKey = "recent" | "oldest" | "lowest" | "highest";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent",  label: "Más recientes" },
  { key: "oldest",  label: "Más antiguos"  },
  { key: "lowest",  label: "Menor"         },
  { key: "highest", label: "Mayor"         },
];

const RANK_CONFIG: Record<number, { label: string; bg: string; border: string; badge: string; btn: string }> = {
  1: { label: "1st", bg: "bg-amber-50",  border: "border-amber-300",  badge: "bg-amber-100 text-amber-800 border-amber-200",  btn: "border-amber-300 text-amber-700 hover:bg-amber-50"  },
  2: { label: "2nd", bg: "bg-slate-50",  border: "border-slate-300",  badge: "bg-slate-100 text-slate-700 border-slate-200",  btn: "border-slate-300 text-slate-600 hover:bg-slate-50"  },
  3: { label: "3rd", bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-100 text-orange-800 border-orange-200", btn: "border-orange-200 text-orange-700 hover:bg-orange-50" },
  4: { label: "4th", bg: "bg-purple-50", border: "border-purple-300", badge: "bg-purple-100 text-purple-800 border-purple-200", btn: "border-purple-200 text-purple-700 hover:bg-purple-50" },
  5: { label: "5th", bg: "bg-blue-50",   border: "border-blue-300",   badge: "bg-blue-100 text-blue-800 border-blue-200",     btn: "border-blue-200 text-blue-700 hover:bg-blue-50"    },
};

function numVal(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtPred(val: string): string {
  if (!val || val.toLowerCase() === "nan") return "—";
  const stripped = val.replace(/,/g, "").trim();
  if (stripped === "") return val;
  const n = Number(stripped);
  if (!isFinite(n)) return val;
  const parts = stripped.split(".");
  const intPart = Math.trunc(n).toLocaleString("en-US");
  return parts.length > 1 ? intPart + "." + parts[1] : intPart;
}

function formatTs(ts: string | Date): string {
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({ onConfirm, onCancel, saving }: { onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Confirmar publicacion de ganadores</h3>
            <p className="text-sm text-gray-500 mt-1">
              Al confirmar se publicaran los ganadores en el sitio y se enviara un correo a cada uno notificandoles su premio.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-sm font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Si, publicar ganadores
          </button>
        </div>
      </div>
    </div>
  );
}

function NoWinnerModal({ onConfirm, onCancel, saving }: { onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <Ban className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Declarar premio desierto</h3>
            <p className="text-sm text-gray-500 mt-1">
              Ninguno de los participantes sera premiado. Se les notificara por correo que el resultado fue publicado sin ganador.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-sm font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-slate-600 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Award detail modal ────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

function AwardDetailModal({ award, onClose }: { award: AwardRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Premio enviado</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {award.prizeLabel}{award.prizeValue && award.prizeValue !== award.prizeLabel ? ` · ${award.prizeValue}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className={`font-semibold px-2.5 py-1 rounded-full ${award.awardType === "digital" ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-orange-700"}`}>
              {award.awardType === "digital" ? "Digital" : "Físico"}
            </span>
            {award.rank && (
              <span className="font-semibold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">
                {award.rank === 1 ? "1er" : award.rank === 2 ? "2do" : award.rank === 3 ? "3er" : `${award.rank}°`} lugar
              </span>
            )}
            <span className="text-gray-400">Otorgado {fmtDate(award.awardedAt)}</span>
            {award.emailSentAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <MailCheck className="w-3 h-3" /> Email enviado
              </span>
            ) : (
              <span className="text-amber-500">Sin email</span>
            )}
          </div>

          {award.awardType === "digital" ? (
            <div className="space-y-3">
              {(award.codeType === "qr" || award.codeType === "barcode") && award.codeFileUrl ? (
                <div className="flex flex-col items-center gap-2 bg-gray-50 rounded-xl p-4">
                  <img src={award.codeFileUrl} alt="code" className="h-28 w-auto object-contain" />
                  <a href={award.codeFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">
                    {award.codeType === "qr" ? <QrCode className="w-3.5 h-3.5 inline mr-1" /> : <BarChart2 className="w-3.5 h-3.5 inline mr-1" />}
                    Ver imagen
                  </a>
                </div>
              ) : award.codeType === "link" && award.code ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Link</p>
                  <a href={award.code} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline break-all">{award.code}</a>
                </div>
              ) : award.code ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1"><Key className="w-3 h-3" /> Código</p>
                  <div className="bg-gray-100 rounded-xl px-4 py-2.5 font-mono text-sm tracking-widest text-gray-900 select-all">{award.code}</div>
                </div>
              ) : null}
              {award.pin && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1">PIN</p>
                  <div className="bg-gray-100 rounded-xl px-4 py-2 font-mono text-sm tracking-widest text-gray-900 select-all inline-block">{award.pin}</div>
                </div>
              )}
              {award.expiresAt && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" /> Vigencia: {fmtDate(award.expiresAt)}
                </div>
              )}
              {award.usageInstructions && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Instrucciones de uso</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{award.usageInstructions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {award.trackingNumber && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Número de guía</p>
                  <div className="bg-gray-100 rounded-xl px-4 py-2.5 font-mono text-sm font-bold text-gray-900 select-all">
                    {award.trackingNumber}
                    {award.courier && <span className="ml-2 font-normal text-gray-500 text-xs">({award.courier})</span>}
                  </div>
                </div>
              )}
              {award.estimatedDelivery && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Package className="w-3.5 h-3.5" /> Llegada estimada: {fmtDate(award.estimatedDelivery)}
                </div>
              )}
            </div>
          )}

          {award.terms && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400 mb-1">Términos y condiciones</p>
              <p className="text-xs text-gray-500 whitespace-pre-line">{award.terms}</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HunchParticipants() {
  useAdminAuth();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const [hunch, setHunch] = useState<HunchDetail | null>(null);
  const [predData, setPredData] = useState<PredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNoWinner, setConfirmNoWinner] = useState(false);
  const [noWinnerMode, setNoWinnerMode] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);

  // Winner state
  const [winnerOption, setWinnerOption] = useState<string>("");
  const [winnerUserId, setWinnerUserId] = useState<number | null>(null);
  const [winnerRanks, setWinnerRanks] = useState<Array<{ rank: number; userId: number; predId?: number }>>([]);

  // Award state
  const [awardedMap, setAwardedMap] = useState<Map<number, AwardRecord>>(new Map());
  const [viewAward, setViewAward] = useState<AwardRecord | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    Promise.all([
      adminFetch(`/admin/hunches/${params.id}`).then((r) => r.json()),
      adminFetch(`/admin/hunches/${params.id}/predictions`).then((r) => r.json()),
      adminFetch(`/admin/hunches/${params.id}/awards`).then((r) => r.ok ? r.json() : []),
    ]).then(([h, preds, awards]) => {
      setHunch(h);
      setPredData(preds);
      const map = new Map<number, AwardRecord>();
      for (const a of (awards as AwardRecord[])) {
        if (!map.has(a.userId)) map.set(a.userId, a);
      }
      setAwardedMap(map);
      if (h.winnerOption) setWinnerOption(h.winnerOption as string);
      if (h.winnerUserId) setWinnerUserId(h.winnerUserId as number);
      if (h.winnerRanks) {
        try {
          const raw = JSON.parse(h.winnerRanks) as Array<{ rank: number; userId: number }>;
          // Re-attach predId by finding the first matching prediction for each userId
          const allPreds: Array<{ id: number; userId: number | null }> =
            (preds as PredData).byOption?.flatMap((g) => g.participants) ?? [];
          const withPredId = raw.map((entry) => {
            const match = allPreds.find((p) => p.userId === entry.userId);
            return { rank: entry.rank, userId: entry.userId, predId: match?.id };
          });
          setWinnerRanks(withPredId);
        }
        catch { /* ignore */ }
      }
      // Detect already-declared no-winner state
      if (h.status === "resolved" && !h.winnerOption && !h.winnerUserId && !h.winnerRanks) {
        setNoWinnerMode(true);
      }
    }).finally(() => setLoading(false));
  }, [params.id]);

  // ── Sorted multi-prediction users ──────────────────────────────────────────

  const sortedByUser = useMemo<UserPredGroup[]>(() => {
    if (!predData?.byUser) return [];
    const list = [...predData.byUser];
    switch (sortBy) {
      case "recent":  return list.sort((a, b) => new Date(b.firstAt).getTime() - new Date(a.firstAt).getTime());
      case "oldest":  return list.sort((a, b) => new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime());
      case "lowest":  return list.sort((a, b) => numVal(a.answers[0]?.answerLabel ?? "0") - numVal(b.answers[0]?.answerLabel ?? "0"));
      case "highest": return list.sort((a, b) => numVal(b.answers[0]?.answerLabel ?? "0") - numVal(a.answers[0]?.answerLabel ?? "0"));
    }
  }, [predData, sortBy]);

  // ── Sorted single-prediction flat list ────────────────────────────────────

  const sortedFlat = useMemo<PredParticipant[]>(() => {
    if (!predData?.byOption) return [];
    const flat: PredParticipant[] = predData.byOption.flatMap((group) =>
      group.participants.map((p) => ({ ...p, createdAt: String(p.createdAt), optionLabel: group.label })),
    );
    switch (sortBy) {
      case "recent":  return flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":  return flat.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "lowest":  return flat.sort((a, b) => numVal(a.optionLabel) - numVal(b.optionLabel));
      case "highest": return flat.sort((a, b) => numVal(b.optionLabel) - numVal(a.optionLabel));
    }
  }, [predData, sortBy]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!hunch) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status: "resolved", notifyWinners: true };
      const isMPrize = hunch.prizeTiers.length > 1;
      if (isMPrize) {
        // Both multi-prediction + multi-prize AND single-prediction + multi-prize
        // use ranked winner selection — strip predId before sending to backend
        body["winnerRanks"] = winnerRanks.length > 0 ? winnerRanks.map(({ rank, userId }) => ({ rank, userId })) : null;
        body["winnerUserId"] = null;
        body["winnerOption"] = null;
      } else if (hunch.isMulti) {
        body["winnerUserId"] = winnerUserId ?? null;
        body["winnerRanks"] = null;
      } else {
        body["winnerOption"] = winnerOption || null;
        body["winnerRanks"] = null;
      }
      await adminFetch(`/admin/hunches/${hunch.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setSaved(true);
      setConfirmOpen(false);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Declare no winner ────────────────────────────────────────────────────

  async function saveNoWinner() {
    if (!hunch) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/hunches/${hunch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          winnerOption: null,
          winnerUserId: null,
          winnerRanks: null,
          winnerAnswers: null,
          notifyParticipants: true,
        }),
      });
      setNoWinnerMode(true);
      setConfirmNoWinner(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Rank helpers ─────────────────────────────────────────────────────────

  function setRank(rank: number, userId: number, predId?: number) {
    setWinnerRanks((prev) => {
      // Remove any existing rank for this userId (one rank per user)
      // and any existing user for this rank (one user per rank)
      const filtered = prev.filter((r) => r.userId !== userId && r.rank !== rank);
      return [...filtered, { rank, userId, predId }].sort((a, b) => a.rank - b.rank);
    });
  }

  function clearRank(userId: number, predId?: number) {
    if (predId != null) {
      // Single-prediction: clear the specific prediction row
      setWinnerRanks((prev) => prev.filter((r) => r.predId !== predId));
    } else {
      // Multi-prediction: clear by userId
      setWinnerRanks((prev) => prev.filter((r) => r.userId !== userId));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!hunch || !predData) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-sm text-gray-500">Hunch not found.</p>
        </div>
      </AdminLayout>
    );
  }

  const isMultiPrize = hunch.prizeTiers.length > 1;
  const totalCount = predData.total;
  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === sortBy)?.label ?? "Más recientes";

  return (
    <>
    <AdminLayout>
      {confirmOpen && (
        <ConfirmModal
          onConfirm={save}
          onCancel={() => setConfirmOpen(false)}
          saving={saving}
        />
      )}
      {confirmNoWinner && (
        <NoWinnerModal
          onConfirm={saveNoWinner}
          onCancel={() => setConfirmNoWinner(false)}
          saving={saving}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setLocation(`/backstage/hunches/${params.id}/edit`)}
              className="mt-0.5 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{hunch.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {totalCount} {totalCount === 1 ? "participant" : "participants"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                {currentSortLabel}
                <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                        sortBy === opt.key
                          ? "bg-violet-50 text-violet-700 font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {sortBy === opt.key && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                      {sortBy !== opt.key && <span className="w-3.5 h-3.5 shrink-0" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Premio desierto button */}
            {!noWinnerMode && (
              <button
                type="button"
                onClick={() => setConfirmNoWinner(true)}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-300 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <Ban className="w-3.5 h-3.5" />
                Sin ganador
              </button>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 px-3 py-2 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
              {saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>

        {/* No-winner banner */}
        {noWinnerMode && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <Ban className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">Premio desierto declarado</p>
              <p className="text-xs text-slate-500">Este hunch fue resuelto sin ganador. Los participantes fueron notificados.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmNoWinner(true)}
              disabled={saving}
              className="ml-auto text-xs font-semibold text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
            >
              Volver a declarar
            </button>
          </div>
        )}

        {/* Close sort dropdown on outside click */}
        {sortOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
        )}

        {totalCount === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No predictions yet.</p>
          </div>
        )}

        {/* ── Multi-prediction: individual users ──────────────────────────────── */}
        {hunch.isMulti && sortedByUser.length > 0 && (
          <div className="space-y-2">
            {sortedByUser.map((u) => {
              const displayName = u.username ? `@${u.username}` : (u.phone ?? `User ${u.userId}`);
              const assignedRank = isMultiPrize ? (winnerRanks.find((r) => r.userId === u.userId)?.rank ?? null) : null;
              const isSingleWinner = !isMultiPrize && winnerUserId === u.userId;
              const rankCfg = assignedRank !== null ? RANK_CONFIG[assignedRank] : null;
              const takenRanks = winnerRanks.filter((r) => r.userId !== u.userId).map((r) => r.rank);
              const availableRanks = hunch.prizeTiers.map((t) => t.rank).filter((r) => !takenRanks.includes(r) && RANK_CONFIG[r]);
              const isHighlighted = isMultiPrize ? assignedRank !== null : isSingleWinner;

              return (
                <div
                  key={u.userId}
                  className={`border rounded-xl transition-colors ${
                    isHighlighted
                      ? (isMultiPrize ? (rankCfg?.border ?? "border-gray-100") : "border-emerald-300")
                      : "border-gray-100"
                  }`}
                >
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                    isHighlighted
                      ? (isMultiPrize ? (rankCfg?.bg ?? "") : "bg-emerald-50")
                      : "bg-gray-50/60"
                  }`}>

                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-violet-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                        {u.answers.map((a) => (
                          <span key={a.questionId} className="text-xs text-gray-500">
                            <span className="text-gray-400">{a.questionPrompt}:</span>{" "}
                            <span className="font-semibold text-gray-800">{a.answerLabel}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <span className="text-xs text-gray-400 shrink-0 hidden sm:block tabular-nums">
                      {formatTs(u.firstAt)}
                    </span>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isMultiPrize ? (
                        assignedRank !== null ? (
                          <>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${rankCfg!.badge}`}>
                              <Trophy className="w-3 h-3" /> {RANK_CONFIG[assignedRank].label} Place
                            </span>
                            {awardedMap.has(u.userId) ? (
                              <button
                                type="button"
                                onClick={() => setViewAward(awardedMap.get(u.userId)!)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Premio enviado
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const tier = hunch!.prizeTiers.find((t) => t.rank === assignedRank);
                                  const qs = new URLSearchParams({ rank: String(assignedRank), prizeLabel: tier?.prizeLabel ?? "", prizeValue: tier?.prizeValue ?? "" });
                                  setLocation(`/backstage/hunches/${params.id}/participants/${u.userId}/award?${qs}`);
                                }}
                                title="Premiar"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                              >
                                <Gift className="w-3 h-3" /> Premiar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => clearRank(u.userId)}
                              title="Remove rank"
                              className="text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          availableRanks.map((rank) => (
                            <button
                              key={rank}
                              type="button"
                              onClick={() => setRank(rank, u.userId)}
                              className={`text-xs font-semibold border px-2.5 py-1 rounded-lg transition-colors ${RANK_CONFIG[rank].btn}`}
                            >
                              {RANK_CONFIG[rank].label}
                            </button>
                          ))
                        )
                      ) : (
                        isSingleWinner ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <Trophy className="w-3 h-3" /> Winner
                            </span>
                            {awardedMap.has(u.userId) ? (
                              <button
                                type="button"
                                onClick={() => setViewAward(awardedMap.get(u.userId)!)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Premio enviado
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const tier = hunch!.prizeTiers[0];
                                  const qs = new URLSearchParams({ prizeLabel: tier?.prizeLabel ?? "", prizeValue: tier?.prizeValue ?? "" });
                                  setLocation(`/backstage/hunches/${params.id}/participants/${u.userId}/award?${qs}`);
                                }}
                                title="Premiar"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                              >
                                <Gift className="w-3 h-3" /> Premiar
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setWinnerUserId(u.userId)}
                            className="text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                          >
                            Set as winner
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Single-prediction + multi-prize: rank buttons per participant ───── */}
        {!hunch.isMulti && isMultiPrize && sortedFlat.length > 0 && (
          <div className="space-y-2">
            {sortedFlat.map((p) => {
              const displayName = p.username ? `@${p.username}` : (p.phone ?? (p.userId != null ? `User ${p.userId}` : "Anonymous"));
              const uid = p.userId;
              // Badge keyed by predId so the same user's other predictions don't also light up
              const assignedRank = winnerRanks.find((r) => r.predId === p.id)?.rank ?? null;
              const rankCfg = assignedRank !== null ? RANK_CONFIG[assignedRank] : null;
              // takenRanks: ranks already claimed by OTHER users (userId-level exclusion)
              const takenRanks = winnerRanks.filter((r) => r.userId !== uid).map((r) => r.rank);
              // Also exclude any rank already assigned to THIS userId via a different predId
              const userAlreadyRanked = uid != null && winnerRanks.some((r) => r.userId === uid && r.predId !== p.id);
              const availableRanks = hunch.prizeTiers.map((t) => t.rank).filter((r) => !takenRanks.includes(r) && RANK_CONFIG[r]);
              const isHighlighted = assignedRank !== null;

              return (
                <div
                  key={p.id}
                  className={`border rounded-xl transition-colors ${isHighlighted ? (rankCfg?.border ?? "border-gray-100") : "border-gray-100"}`}
                >
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isHighlighted ? (rankCfg?.bg ?? "") : "bg-gray-50/60"}`}>
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">Predicted:</span>
                        <span className="text-xs font-semibold text-gray-800">{fmtPred(p.optionLabel)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums hidden sm:block">
                      {formatTs(p.createdAt)}
                    </span>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {assignedRank !== null ? (
                        <>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${rankCfg!.badge}`}>
                            <Trophy className="w-3 h-3" /> {RANK_CONFIG[assignedRank].label} Place
                          </span>
                          {uid != null && (
                            <>
                              {uid != null && awardedMap.has(uid) ? (
                                <button
                                  type="button"
                                  onClick={() => setViewAward(awardedMap.get(uid)!)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Premio enviado
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tier = hunch!.prizeTiers.find((t) => t.rank === assignedRank);
                                    const qs = new URLSearchParams({ rank: String(assignedRank), prizeLabel: tier?.prizeLabel ?? "", prizeValue: tier?.prizeValue ?? "" });
                                    setLocation(`/backstage/hunches/${params.id}/participants/${uid}/award?${qs}`);
                                  }}
                                  title="Premiar"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                                >
                                  <Gift className="w-3 h-3" /> Premiar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => clearRank(uid, p.id)}
                                title="Remove rank"
                                className="text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        uid != null && !userAlreadyRanked && availableRanks.map((rank) => (
                          <button
                            key={rank}
                            type="button"
                            onClick={() => setRank(rank, uid, p.id)}
                            className={`text-xs font-semibold border px-2.5 py-1 rounded-lg transition-colors ${RANK_CONFIG[rank].btn}`}
                          >
                            {RANK_CONFIG[rank].label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Single-prediction + single-prize: per-row winner button ────────── */}
        {!hunch.isMulti && !isMultiPrize && sortedFlat.length > 0 && (
          <div className="space-y-2">
            {sortedFlat.map((p) => {
              const displayName = p.username ? `@${p.username}` : (p.phone ?? (p.userId != null ? `User ${p.userId}` : "Anonymous"));
              const isWinner = winnerOption === p.optionLabel;
              return (
                <div
                  key={p.id}
                  className={`border rounded-xl transition-colors ${isWinner ? "border-emerald-300" : "border-gray-100"}`}
                >
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isWinner ? "bg-emerald-50" : "bg-gray-50/60"}`}>
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">Predicted:</span>
                        <span className="text-xs font-semibold text-gray-800">{fmtPred(p.optionLabel)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums hidden sm:block">
                      {formatTs(p.createdAt)}
                    </span>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isWinner ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <Trophy className="w-3 h-3" /> Ganador
                          </span>
                          {p.userId != null && (
                            awardedMap.has(p.userId) ? (
                              <button
                                type="button"
                                onClick={() => setViewAward(awardedMap.get(p.userId!)!)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Premio enviado
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const tier = hunch!.prizeTiers[0];
                                  const qs = new URLSearchParams({ prizeLabel: tier?.prizeLabel ?? "", prizeValue: tier?.prizeValue ?? "" });
                                  setLocation(`/backstage/hunches/${params.id}/participants/${p.userId}/award?${qs}`);
                                }}
                                title="Premiar"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                              >
                                <Gift className="w-3 h-3" /> Premiar
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => setWinnerOption("")}
                            title="Quitar ganador"
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setWinnerOption(p.optionLabel)}
                          className="text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                        >
                          Marcar ganador
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
    {viewAward && <AwardDetailModal award={viewAward} onClose={() => setViewAward(null)} />}
    </>
  );
}
