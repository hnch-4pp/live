import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";

interface TrendingTopic {
  id: number;
  name: string;
  tag: string;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all";

function TopicForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<TrendingTopic>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!initial?.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const method = isEdit ? "PATCH" : "POST";
      const url = isEdit ? `/admin/trending-topics/${initial!.id}` : "/admin/trending-topics";
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify({ name, tag, imageUrl: imageUrl || null, sortOrder: Number(sortOrder), active }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      onSave();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onCancel()}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900">{isEdit ? "Edit topic" : "New trending topic"}</h3>
          <button type="button" onClick={onCancel}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="World Cup" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tag slug <span className="text-red-500">*</span></label>
          <input required value={tag} onChange={e => setTag(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))} placeholder="world-cup" className={`${inputCls} font-mono`} />
          <p className="mt-1 text-xs text-gray-400">Hunches with this tag will appear in this section.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          {imageUrl && <img src={imageUrl} alt="" className="mt-2 h-14 w-14 rounded-full object-cover border border-gray-200" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sort order</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Active</label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`mt-0.5 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${active ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}
            >
              {active ? <><Check className="w-4 h-4" /> Active</> : "Inactive"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminTrending() {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrendingTopic | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useAdminAuth();

  const load = () => {
    adminFetch("/admin/trending-topics")
      .then(r => r.json() as Promise<TrendingTopic[]>)
      .then(setTopics)
      .catch(() => {});
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/trending-topics/${id}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trending Topics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Shown as a pill strip on the home page. Hunches are filtered by tag.</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New topic
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Image</th>
                <th className="px-5 py-3 text-left font-semibold">Name</th>
                <th className="px-5 py-3 text-left font-semibold">Tag</th>
                <th className="px-5 py-3 text-left font-semibold">Order</th>
                <th className="px-5 py-3 text-left font-semibold">Active</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topics.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="pl-5 pr-2 py-3">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100 border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200" />
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 bg-gray-50">{t.tag}</td>
                  <td className="px-5 py-3 text-gray-500">{t.sortOrder}</td>
                  <td className="px-5 py-3">
                    {t.active ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {topics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">No trending topics yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <TopicForm
          initial={editing ?? undefined}
          onSave={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Delete topic?</h3>
            <p className="text-sm text-gray-500 mb-5">This will remove it from the home page. Hunches keep their tags.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
