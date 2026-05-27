import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { ChevronUp, ChevronDown, GripVertical, Star, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface FeaturedHunch {
  id: number;
  title: string;
  status: string;
  imageUrl: string | null;
  featuredOrder: number | null;
  endsAt: string;
}

export default function AdminHero() {
  const [hunches, setHunches] = useState<FeaturedHunch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useAdminAuth();

  const load = useCallback(() => {
    adminFetch("/admin/featured")
      .then((r) => r.json() as Promise<FeaturedHunch[]>)
      .then(setHunches)
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...hunches];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setHunches(next);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await adminFetch("/admin/featured-order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: hunches.map((h) => h.id) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hero Order</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Drag or use the arrows to reorder featured hunches in the home carousel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm font-medium text-emerald-600">
                Saved
              </span>
            )}
            <button
              onClick={save}
              disabled={saving || hunches.length === 0}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {saving ? "Saving..." : "Save order"}
            </button>
          </div>
        </div>

        {hunches.length === 0 ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-5 h-5 text-violet-500" />
            </div>
            <p className="font-semibold text-gray-800 mb-1">No featured hunches</p>
            <p className="text-sm text-gray-500 mb-4">
              Mark hunches as featured in the{" "}
              <Link href="/backstage/hunches" className="text-violet-600 hover:underline">
                Hunches
              </Link>{" "}
              section to add them to the hero carousel.
            </p>
          </div>
        ) : (
          <div className="mt-6 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 flex items-center gap-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <span className="w-6" />
              <span className="w-6 text-center">#</span>
              <span className="w-12" />
              <span className="flex-1">Title</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-24 text-right">Ends</span>
              <span className="w-16" />
            </div>

            <ul className="divide-y divide-gray-100">
              {hunches.map((h, idx) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />

                  <span className="w-6 text-center text-sm font-bold text-violet-600">
                    {idx + 1}
                  </span>

                  {h.imageUrl ? (
                    <img
                      src={h.imageUrl}
                      alt=""
                      className="w-12 h-8 object-cover rounded-lg shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="w-12 h-8 rounded-lg bg-gray-100 shrink-0" />
                  )}

                  <span className="flex-1 text-sm font-medium text-gray-900 truncate min-w-0">
                    {h.title}
                  </span>

                  <span className="w-20 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        h.status === "open"
                          ? "bg-emerald-50 text-emerald-700"
                          : h.status === "resolved"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {h.status}
                    </span>
                  </span>

                  <span className="w-24 text-right text-xs text-gray-500 shrink-0">
                    {new Date(h.endsAt).toLocaleDateString()}
                  </span>

                  <div className="w-16 flex items-center justify-end gap-1 shrink-0">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-25 transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === hunches.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-25 transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </button>
                    <Link
                      href={`/backstage/hunches/${h.id}/edit`}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Edit hunch"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Only open hunches marked as featured appear in the home hero carousel.
          Close or unfeature a hunch to remove it.
        </p>
      </div>
    </AdminLayout>
  );
}
