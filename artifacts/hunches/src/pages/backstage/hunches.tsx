import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch, StatusBadge } from "./dashboard";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface AdminHunch {
  id: number;
  title: string;
  status: string;
  featured: boolean;
  endsAt: string;
  participantCount: number;
  answerType: string;
}

export default function AdminHunches() {
  const [hunches, setHunches] = useState<AdminHunch[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [, setLocation] = useLocation();

  useAdminAuth();

  const load = () => {
    adminFetch("/admin/hunches")
      .then((r) => r.json() as Promise<AdminHunch[]>)
      .then(setHunches)
      .catch(() => {});
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/hunches/${id}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  const ANSWER_TYPE_LABEL: Record<string, string> = {
    integer: "Integer",
    decimal: "Decimal",
    date:    "Date",
    time:    "Time",
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hunches</h1>
          <button
            onClick={() => setLocation("/backstage/hunches/new")}
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
                <th className="px-5 py-3 text-left font-semibold">Answer type</th>
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                      {ANSWER_TYPE_LABEL[h.answerType] ?? h.answerType}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {h.featured ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{h.participantCount?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(h.endsAt).toLocaleDateString()}</td>
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
              {hunches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">
                    No hunches yet
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
