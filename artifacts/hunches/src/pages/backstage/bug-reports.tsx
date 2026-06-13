import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Bug, Trash2, CheckCircle, Clock, XCircle, Search, Loader2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface BugReport {
  id: number;
  description: string;
  email: string | null;
  username: string | null;
  pageUrl: string | null;
  status: "new" | "in_progress" | "resolved" | "dismissed";
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

type StatusFilter = "all" | "new" | "in_progress" | "resolved" | "dismissed";

const STATUS_LABELS: Record<BugReport["status"], string> = {
  new: "Nuevo",
  in_progress: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const STATUS_COLORS: Record<BugReport["status"], string> = {
  new: "bg-red-100 text-red-700 border-red-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  dismissed: "bg-gray-100 text-gray-500 border-gray-200",
};

const PAGE_SIZE = 20;

export default function AdminBugReports() {
  useAdminAuth();

  const [reports, setReports] = useState<BugReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);
  const [expandedNote, setExpandedNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<Record<number, string>>({});

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, search, page: String(page) });
      const r = await adminFetch(`/admin/bug-reports?${params}`);
      const data = await r.json() as { reports: BugReport[]; total: number };
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  async function updateStatus(id: number, status: BugReport["status"]) {
    setActioning(id);
    try {
      await adminFetch(`/admin/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchReports();
    } finally {
      setActioning(null);
    }
  }

  async function saveNote(id: number) {
    setActioning(id);
    try {
      await adminFetch(`/admin/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: noteText[id] ?? "" }),
      });
      setExpandedNote(null);
      await fetchReports();
    } finally {
      setActioning(null);
    }
  }

  async function deleteReport(id: number) {
    if (!confirm("¿Eliminar este reporte permanentemente?")) return;
    setActioning(id);
    try {
      await adminFetch(`/admin/bug-reports/${id}`, { method: "DELETE" });
      await fetchReports();
    } finally {
      setActioning(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Bug className="w-6 h-6 text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Errores reportados</h1>
            <p className="text-sm text-gray-500">{total} reporte{total !== 1 ? "s" : ""} en total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuario, email o descripción..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="all">Todos</option>
            <option value="new">Nuevos</option>
            <option value="in_progress">En revisión</option>
            <option value="resolved">Resueltos</option>
            <option value="dismissed">Descartados</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bug className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No hay reportes</p>
            <p className="text-sm mt-1">Cuando los usuarios reporten errores aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div
                key={r.id}
                className={`bg-white border rounded-xl p-4 ${r.status === "new" ? "border-red-200 shadow-sm" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    {r.username && (
                      <span className="text-sm font-semibold text-violet-700">@{r.username}</span>
                    )}
                    {r.email && (
                      <span className="text-sm text-gray-500">{r.email}</span>
                    )}
                    {!r.username && !r.email && (
                      <span className="text-sm text-gray-400">Anónimo</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.pageUrl && (
                      <a
                        href={r.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Abrir página"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {r.status !== "in_progress" && (
                      <button
                        onClick={() => updateStatus(r.id, "in_progress")}
                        disabled={actioning === r.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        title="Marcar en revisión"
                      >
                        <Clock className="w-3 h-3" /> En revisión
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button
                        onClick={() => updateStatus(r.id, "resolved")}
                        disabled={actioning === r.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="Marcar como resuelto"
                      >
                        <CheckCircle className="w-3 h-3" /> Resuelto
                      </button>
                    )}
                    {r.status !== "dismissed" && (
                      <button
                        onClick={() => updateStatus(r.id, "dismissed")}
                        disabled={actioning === r.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="Descartar"
                      >
                        <XCircle className="w-3 h-3" /> Descartar
                      </button>
                    )}
                    <button
                      onClick={() => deleteReport(r.id)}
                      disabled={actioning === r.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.description}</p>

                {/* Page URL */}
                {r.pageUrl && (
                  <p className="mt-1.5 text-xs text-gray-400 truncate">
                    Página: <span className="text-gray-500">{r.pageUrl}</span>
                  </p>
                )}

                {/* Admin note */}
                <div className="mt-3">
                  {expandedNote === r.id ? (
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={noteText[r.id] ?? r.adminNote ?? ""}
                        onChange={(e) => setNoteText({ ...noteText, [r.id]: e.target.value })}
                        placeholder="Nota interna..."
                        rows={2}
                        className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveNote(r.id)}
                          disabled={actioning === r.id}
                          className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setExpandedNote(null)}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setExpandedNote(r.id);
                        setNoteText({ ...noteText, [r.id]: r.adminNote ?? "" });
                      }}
                      className="text-xs text-gray-400 hover:text-violet-600 transition-colors"
                    >
                      {r.adminNote ? `Nota: ${r.adminNote}` : "+ Agregar nota interna"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} · {total} reportes
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
