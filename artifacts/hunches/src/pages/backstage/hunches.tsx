import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch, StatusBadge } from "./dashboard";
import {
  Plus, Pencil, Trash2, X, Check,
  ArrowUpDown, ChevronDown, SlidersHorizontal,
} from "lucide-react";

interface AdminHunch {
  id: number;
  title: string;
  status: string;
  featured: boolean;
  endsAt: string;
  participantCount: number;
  answerType: string;
  imageUrl: string | null;
  categoryId: number | null;
  createdAt: string;
}

interface Category {
  id: number;
  name: string;
}

type SortKey = "newest" | "oldest" | "most_preds" | "least_preds" | "ends_soonest" | "ends_latest";

const STATUS_FILTERS = [
  { key: "open",     label: "Abiertos"   },
  { key: "closed",   label: "Cerrados"   },
  { key: "resolved", label: "Resueltos"  },
  { key: "draft",    label: "Borradores" },
] as const;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",      label: "Más recientes"       },
  { key: "oldest",      label: "Más antiguos"        },
  { key: "ends_soonest",label: "Cierra pronto"       },
  { key: "ends_latest", label: "Cierra tarde"        },
  { key: "most_preds",  label: "Más predicciones"    },
  { key: "least_preds", label: "Menos predicciones"  },
];

const ANSWER_TYPE_LABEL: Record<string, string> = {
  integer:  "Integer",
  decimal:  "Decimal",
  number:   "Número",
  date:     "Date",
  time:     "Time",
  lap_time: "Lap time",
};

export default function AdminHunches() {
  const [hunches, setHunches]       = useState<AdminHunch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const [, setLocation]             = useLocation();

  // Filter + sort state — defaults: open, newest first
  const [statusFilter,   setStatusFilter]   = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [sortBy,         setSortBy]         = useState<SortKey>("newest");
  const [sortOpen,       setSortOpen]       = useState(false);

  useAdminAuth();

  const load = () => {
    Promise.all([
      adminFetch("/admin/hunches").then((r) => r.json() as Promise<AdminHunch[]>),
      adminFetch("/admin/categories").then((r) => r.json() as Promise<Category[]>),
    ])
      .then(([h, cats]) => { setHunches(h); setCategories(cats); })
      .catch(() => {});
  };

  useEffect(load, []);

  const catMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    let list = [...hunches];
    if (statusFilter !== "all") list = list.filter((h) => h.status === statusFilter);
    if (categoryFilter !== "all") list = list.filter((h) => h.categoryId === categoryFilter);
    list.sort((a, b) => {
      if (sortBy === "newest")     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest")     return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "ends_soonest") return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      if (sortBy === "ends_latest")  return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime();
      if (sortBy === "most_preds") return (b.participantCount ?? 0) - (a.participantCount ?? 0);
      return (a.participantCount ?? 0) - (b.participantCount ?? 0);
    });
    return list;
  }, [hunches, statusFilter, categoryFilter, sortBy]);

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/hunches/${id}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === sortBy)?.label ?? "Ordenar";

  // Count per status for badges
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of hunches) counts[h.status] = (counts[h.status] ?? 0) + 1;
    return counts;
  }, [hunches]);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hunches</h1>
          <button
            onClick={() => setLocation("/backstage/hunches/new")}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New hunch
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Status pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "all"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Todos
              <span className="ml-1.5 text-gray-400">{hunches.length}</span>
            </button>
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {(countByStatus[key] ?? 0) > 0 && (
                  <span className="ml-1.5 text-gray-400">{countByStatus[key]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="relative">
              <select
                value={categoryFilter === "all" ? "all" : String(categoryFilter)}
                onChange={(e) =>
                  setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="appearance-none text-xs font-semibold bg-white border border-gray-200 rounded-xl pl-3 pr-7 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
          )}

          {/* Sort dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              {currentSortLabel}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                      className={`w-full text-left text-xs font-semibold px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        sortBy === opt.key ? "text-violet-600" : "text-gray-700"
                      }`}
                    >
                      {opt.label}
                      {sortBy === opt.key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results summary */}
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length} {filtered.length === 1 ? "hunch" : "hunches"}
          {statusFilter !== "all" && ` · ${STATUS_FILTERS.find((s) => s.key === statusFilter)?.label}`}
          {categoryFilter !== "all" && ` · ${catMap.get(categoryFilter as number) ?? ""}`}
        </p>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3" />
                <th className="px-5 py-3 text-left font-semibold">Title</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Categoría</th>
                <th className="px-5 py-3 text-left font-semibold">Answer type</th>
                <th className="px-5 py-3 text-left font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === "most_preds" ? "least_preds" : "most_preds")}
                    className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    Predicciones
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                    className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    Creado
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === "ends_soonest" ? "ends_latest" : "ends_soonest")}
                    className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    Ends
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="pl-5 pr-2 py-3">
                    {h.imageUrl ? (
                      <img src={h.imageUrl} alt="" className="w-12 h-8 object-cover rounded-lg bg-gray-100 shrink-0" />
                    ) : (
                      <div className="w-12 h-8 rounded-lg bg-gray-100 shrink-0" />
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">{h.title}</td>
                  <td className="px-5 py-3"><StatusBadge status={h.status} /></td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {h.categoryId ? (catMap.get(h.categoryId) ?? `#${h.categoryId}`) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                      {ANSWER_TYPE_LABEL[h.answerType] ?? h.answerType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 tabular-nums">{h.participantCount?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs tabular-nums">
                    {new Date(h.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">
                    {new Date(h.endsAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setLocation(`/backstage/hunches/${h.id}/edit`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(h.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-gray-400 text-sm">
                    {hunches.length === 0 ? "No hunches yet" : "Ningún hunch coincide con los filtros"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Delete hunch?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the hunch and all its predictions. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
