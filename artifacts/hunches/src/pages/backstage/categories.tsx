import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AdminCategory {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  hunchCount: number;
  enabled: boolean;
  sortOrder: number;
}

const EMPTY = { slug: "", name: "", icon: "trophy", color: "violet", enabled: true };

interface SortableRowProps {
  cat: AdminCategory;
  confirmDeleteId: number | null;
  togglingId: number | null;
  onEdit: (cat: AdminCategory) => void;
  onToggle: (cat: AdminCategory) => void;
  onDeleteClick: (id: number) => void;
  onDeleteConfirm: (id: number) => void;
  onDeleteCancel: () => void;
}

function SortableRow({
  cat,
  confirmDeleteId,
  togglingId,
  onEdit,
  onToggle,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-gray-50 transition-colors"
    >
      <td className="px-3 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{cat.name}</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{cat.slug}</td>
      <td className="px-4 py-3 text-gray-600">{cat.hunchCount}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(cat)}
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
      <td className="px-4 py-3 text-right">
        {confirmDeleteId === cat.id ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-gray-500">Delete?</span>
            <button
              onClick={() => onDeleteConfirm(cat.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Check className="w-3 h-3" /> Yes
            </button>
            <button
              onClick={onDeleteCancel}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-3 h-3" /> No
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => onEdit(cat)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => onDeleteClick(cat.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<AdminCategory | null>(null);
  const [form, setForm]             = useState({ ...EMPTY });
  const [saving, setSaving]         = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useAdminAuth();

  const sensors = useSensors(useSensor(PointerSensor));

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

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/categories/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    load();
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);

    await adminFetch("/admin/categories/reorder", {
      method: "POST",
      body: JSON.stringify({ order: reordered.map((c) => c.id) }),
    });
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-500 mt-0.5">Drag rows to reorder — order here matches the top navigation bar</p>
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
                <th className="px-3 py-3 w-8" />
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Slug</th>
                <th className="px-4 py-3 text-left font-semibold">Hunches</th>
                <th className="px-4 py-3 text-left font-semibold">Visible in nav</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      cat={cat}
                      confirmDeleteId={confirmDeleteId}
                      togglingId={togglingId}
                      onEdit={openEdit}
                      onToggle={toggleEnabled}
                      onDeleteClick={setConfirmDeleteId}
                      onDeleteConfirm={handleDelete}
                      onDeleteCancel={() => setConfirmDeleteId(null)}
                    />
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                        No categories yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
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
