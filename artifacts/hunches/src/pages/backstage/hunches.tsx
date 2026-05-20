import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch, StatusBadge } from "./dashboard";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface AdminHunch {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  status: string;
  featured: boolean;
  endsAt: string;
  categoryId: number;
  prizeId: number;
  participantCount: number;
  winnerOption: string | null;
}

interface Category { id: number; name: string; slug: string; }
interface Prize    { id: number; label: string; value: string; }

const EMPTY: Omit<AdminHunch, "id" | "participantCount"> = {
  title: "",
  description: "",
  imageUrl: "",
  status: "open",
  featured: false,
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  categoryId: 0,
  prizeId: 0,
  winnerOption: null,
};

export default function AdminHunches() {
  const [hunches, setHunches]       = useState<AdminHunch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prizes, setPrizes]         = useState<Prize[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<AdminHunch | null>(null);
  const [form, setForm]             = useState({ ...EMPTY });
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState<number | null>(null);

  useAdminAuth();

  const load = () => {
    adminFetch("/admin/hunches").then((r) => r.json() as Promise<AdminHunch[]>).then(setHunches).catch(() => {});
    adminFetch("/admin/categories").then((r) => r.json() as Promise<Category[]>).then(setCategories).catch(() => {});
    adminFetch("/admin/prizes").then((r) => r.json() as Promise<Prize[]>).then(setPrizes).catch(() => {});
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, categoryId: categories[0]?.id ?? 0, prizeId: prizes[0]?.id ?? 0 });
    setShowForm(true);
  };

  const openEdit = (h: AdminHunch) => {
    setEditing(h);
    setForm({
      title: h.title,
      description: h.description,
      imageUrl: h.imageUrl ?? "",
      status: h.status,
      featured: h.featured,
      endsAt: new Date(h.endsAt).toISOString().slice(0, 16),
      categoryId: h.categoryId,
      prizeId: h.prizeId,
      winnerOption: h.winnerOption,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        endsAt: new Date(form.endsAt).toISOString(),
        imageUrl: form.imageUrl || null,
      };
      if (editing) {
        await adminFetch(`/admin/hunches/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await adminFetch("/admin/hunches", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      load();
    } catch {
      /* show nothing for now */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/hunches/${id}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hunches</h1>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New hunch
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Title</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Featured</th>
                <th className="px-5 py-3 text-left font-semibold">Predictions</th>
                <th className="px-5 py-3 text-left font-semibold">Ends</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hunches.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">{h.title}</td>
                  <td className="px-5 py-3"><StatusBadge status={h.status} /></td>
                  <td className="px-5 py-3">
                    {h.featured ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{h.participantCount?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(h.endsAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(h.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? "Edit hunch" : "New hunch"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <Field label="Title" required>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input" />
              </Field>
              <Field label="Description" required>
                <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input resize-none" />
              </Field>
              <Field label="Image URL">
                <input value={form.imageUrl ?? ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="input" placeholder="https://..." />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category" required>
                  <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                    className="input">
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Prize" required>
                  <select required value={form.prizeId} onChange={(e) => setForm({ ...form, prizeId: Number(e.target.value) })}
                    className="input">
                    {prizes.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.value})</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Status" required>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </Field>
                <Field label="Ends at" required>
                  <input required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    className="input" />
                </Field>
              </div>

              {form.status === "resolved" && (
                <Field label="Winner option">
                  <input value={form.winnerOption ?? ""} onChange={(e) => setForm({ ...form, winnerOption: e.target.value || null })}
                    className="input" placeholder="Exact text of the winning answer" />
                </Field>
              )}

              <div className="flex items-center gap-2">
                <input id="featured" type="checkbox" checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                <label htmlFor="featured" className="text-sm font-medium text-gray-700">Featured hunch</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Save changes" : "Create hunch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
