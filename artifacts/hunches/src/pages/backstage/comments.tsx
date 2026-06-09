import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Eye, EyeOff, Trash2, RotateCcw, Search, Loader2, ExternalLink, Info, Shield, AlertTriangle, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminComment {
  id: number;
  hunchId: number;
  hunch: { id: number; slug: string | null; title: string } | null;
  parentId: number | null;
  body: string;
  isHidden: boolean;
  deletedAt: string | null;
  createdAt: string;
  author: { id?: number; username: string | null } | null;
}

type StatusFilter = "all" | "visible" | "hidden" | "deleted";

// ── Moderation guidelines (distilled from best practices) ────────────────────

const GUIDELINES = [
  {
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    title: "Delete immediately",
    rules: [
      "Hate speech, slurs, or content targeting identity (race, gender, religion, etc.)",
      "Threats of violence or harassment toward any user",
      "Spam: repetitive messages, links to external services, or promotional content",
      "Illegal content (CSAM, doxxing, personally identifiable info)",
    ],
  },
  {
    icon: EyeOff,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    title: "Hide (review first)",
    rules: [
      "Personal attacks, insults, or name-calling directed at another user",
      "Off-topic content unrelated to the hunch",
      "Misinformation presented as fact about the hunch topic",
      "Excessive negativity that derails healthy discussion",
    ],
  },
  {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    title: "Keep — borderline is fine",
    rules: [
      "Disagreements and debate about the prediction are healthy",
      "Mild frustration (e.g. 'this is unfair') without targeting a person",
      "Humour, sarcasm, or emoji reactions",
      "Criticism of the platform or a hunch — feedback is valuable",
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminComments() {
  useAdminAuth();

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, search, page: String(page) });
      const res = await adminFetch(`/admin/comments?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json() as { comments: AdminComment[]; total: number };
      setComments(data.comments ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [statusFilter, search, page]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);
  useEffect(() => { fetchComments(); }, [fetchComments]);

  async function action(id: number, act: string) {
    setActioning(id);
    try {
      await adminFetch(`/admin/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: act }),
      });
      await fetchComments();
    } finally {
      setActioning(null);
    }
  }

  const statusLabel = (c: AdminComment) => {
    if (c.deletedAt) return <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Deleted</span>;
    if (c.isHidden) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Hidden</span>;
    return <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Visible</span>;
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Comment Moderation</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} comments total</p>
          </div>
          <button
            onClick={() => setGuidelinesOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 px-3 py-2 rounded-lg hover:bg-violet-100 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Moderation Guidelines
          </button>
        </div>

        {/* Guidelines panel */}
        {guidelinesOpen && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Moderation Guidelines</h2>
              <button onClick={() => setGuidelinesOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {GUIDELINES.map((g) => (
                <div key={g.title} className={`rounded-xl border p-4 ${g.bg}`}>
                  <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${g.color}`}>
                    <g.icon className="w-4 h-4" />
                    {g.title}
                  </div>
                  <ul className="space-y-1.5">
                    {g.rules.map((r) => (
                      <li key={r} className="text-xs text-gray-700 flex gap-2">
                        <span className="mt-0.5 shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["all", "visible", "hidden", "deleted"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${statusFilter === s ? "bg-violet-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search body…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No comments found.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left w-16">ID</th>
                  <th className="px-4 py-3 text-left">Author</th>
                  <th className="px-4 py-3 text-left">Body</th>
                  <th className="px-4 py-3 text-left w-28">Hunch</th>
                  <th className="px-4 py-3 text-left w-20">Status</th>
                  <th className="px-4 py-3 text-left w-28">Date</th>
                  <th className="px-4 py-3 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-3">
                      {c.author?.username ? (
                        <a
                          href={`/u/${c.author.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-violet-700 hover:underline"
                        >
                          @{c.author.username}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {c.parentId && <span className="ml-1 text-xs text-gray-400">(reply)</span>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-800 truncate">{c.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.hunch ? (
                        <a
                          href={`/hunch/${c.hunch.slug ?? c.hunch.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-violet-700 flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.hunch.title}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusLabel(c)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {actioning === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <>
                            {!c.deletedAt && !c.isHidden && (
                              <button
                                onClick={() => action(c.id, "hide")}
                                title="Hide"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                <EyeOff className="w-4 h-4" />
                              </button>
                            )}
                            {!c.deletedAt && c.isHidden && (
                              <button
                                onClick={() => action(c.id, "unhide")}
                                title="Unhide"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {!c.deletedAt && (
                              <button
                                onClick={() => action(c.id, "delete")}
                                title="Delete"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {c.deletedAt && (
                              <button
                                onClick={() => action(c.id, "restore")}
                                title="Restore"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 50 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                <span>Page {page} · {total} total</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                    Prev
                  </button>
                  <button disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
