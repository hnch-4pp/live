import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Plus, Pencil, X, Check, ToggleLeft, ToggleRight } from "lucide-react";

interface AdminCategory {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  hunchCount: number;
  enabled: boolean;
}

const ICON_OPTIONS = [
  { value: "trophy",        label: "Trophy" },
  { value: "music",         label: "Music" },
  { value: "film",          label: "Entertainment" },
  { value: "trending-up",   label: "Finance" },
  { value: "star",          label: "Star" },
  { value: "zap",           label: "Zap" },
  { value: "globe",         label: "Globe" },
  { value: "heart",         label: "Heart" },
];

const COLOR_OPTIONS = [
  { value: "violet", label: "Violet",  cls: "bg-violet-500" },
  { value: "blue",   label: "Blue",    cls: "bg-blue-500" },
  { value: "green",  label: "Green",   cls: "bg-green-500" },
  { value: "yellow", label: "Yellow",  cls: "bg-yellow-400" },
  { value: "red",    label: "Red",     cls: "bg-red-500" },
  { value: "pink",   label: "Pink",    cls: "bg-pink-500" },
  { value: "orange", label: "Orange",  cls: "bg-orange-500" },
  { value: "teal",   label: "Teal",    cls: "bg-teal-500" },
];

const EMPTY = { slug: "", name: "", icon: "trophy", color: "violet", enabled: true };

export default function AdminCategories() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<AdminCategory | null>(null);
  const [form, setForm]             = useState({ ...EMPTY });
  const [saving, setSaving]         = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useAdminAuth();

  const load = () =>
    adminFetch("/admin/categories")
      .then((r) => r.json() as Promise<AdminCategory[]>)
      .then(setCategories)
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  };

  const openEdit = (cat: AdminCategory) => {
    setEditing(cat);
    setForm({ slug: cat.slug, name: cat.name, icon: cat.icon, color: cat.color, enabled: cat.enabled });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = editing
        ? { name: form.name, icon: form.icon, color: form.color, enabled: form.enabled }
        : form;
      const res = await adminFetch(
        editing ? `/admin/categories/${editing.id}` : "/admin/categories",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (res.ok) { closeForm(); load(); }
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (cat: AdminCategory) => {
    setTogglingId(cat.id);
    try {
      const res = await adminFetch(`/admin/categories/${cat.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !cat.enabled }),
      });
      if (res.ok) load();
    } finally {
      setTogglingId(null);
    }
  };

  const colorCls = (color: string) =>
    COLOR_OPTIONS.find((c) => c.value === color)?.cls ?? "bg-gray-400";

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-500 mt-0.5">Control which categories appear in the top navigation bar</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            New category
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3 text-left font-semibold">Category</th>
                <th className="px-6 py-3 text-left font-semibold">Slug</th>
                <th className="px-6 py-3 text-left font-semibold">Color</th>
                <th className="px-6 py-3 text-left font-semibold">Hunches</th>
                <th className="px-6 py-3 text-left font-semibold">Visible in nav</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorCls(cat.color)}`} />
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-500">{cat.slug}</td>
                  <td className="px-6 py-3 text-gray-600 capitalize">{cat.color}</td>
                  <td className="px-6 py-3 text-gray-600">{cat.hunchCount}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleEnabled(cat)}
                      disabled={togglingId === cat.id}
                      title={cat.enabled ? "Click to hide from nav" : "Click to show in nav"}
                      className="flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                    >
                      {cat.enabled ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-violet-600" />
                          <span className="text-xs font-medium text-violet-700">Enabled</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400">Disabled</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => openEdit(cat)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                    No categories yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit category" : "New category"}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="e.g. sports"
                    required
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sports"
                  required
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Visible in top nav</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                  className="transition-colors"
                >
                  {form.enabled ? (
                    <ToggleRight className="w-6 h-6 text-violet-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
                <span className={`text-xs font-medium ${form.enabled ? "text-violet-700" : "text-gray-400"}`}>
                  {form.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? "Saving..." : <><Check className="w-4 h-4" /> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
