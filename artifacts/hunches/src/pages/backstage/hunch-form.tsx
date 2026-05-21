import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Check, ChevronLeft, Hash, Percent, Calendar, Clock, Plus, Trash2, Gift } from "lucide-react";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function parsePrizeAmount(value: string): number {
  const m = value.match(/\$?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

interface Category { id: number; name: string; slug: string; }
interface Prize    { id: number; label: string; value: string; }

const ANSWER_TYPES = [
  { value: "integer", label: "Integer",       description: "Whole number (e.g. 42)",             Icon: Hash },
  { value: "decimal", label: "Decimal",        description: "Number with decimals (e.g. 3.14)",   Icon: Percent },
  { value: "date",    label: "Date",           description: "Date in dd/mm/yyyy format",           Icon: Calendar },
  { value: "time",    label: "Time",           description: "Duration in hh:mm:ss format",         Icon: Clock },
];

const EMPTY = {
  title: "",
  description: "",
  imageUrl: "",
  rules: "",
  status: "open",
  featured: false,
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  categoryId: 0,
  prizeId: 0,
  winnerOption: "",
  answerType: "integer",
};

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function HunchForm() {
  useAdminAuth();

  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const isEditing = !!params.id;

  const [form, setForm]           = useState({ ...EMPTY });
  const [prizeTiers, setPrizeTiers] = useState<{ rank: number; prizeId: number }[]>([{ rank: 1, prizeId: 0 }]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prizes, setPrizes]       = useState<Prize[]>([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(isEditing);
  const [error, setError]         = useState("");

  useEffect(() => {
    adminFetch("/admin/categories").then((r) => r.json() as Promise<Category[]>).then(setCategories).catch(() => {});
    adminFetch("/admin/prizes").then((r) => r.json() as Promise<Prize[]>).then(setPrizes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    adminFetch(`/admin/hunches/${params.id}`)
      .then((r) => r.json())
      .then((h) => {
        setForm({
          title: h.title ?? "",
          description: h.description ?? "",
          imageUrl: h.imageUrl ?? "",
          status: h.status ?? "open",
          featured: h.featured ?? false,
          endsAt: new Date(h.endsAt).toISOString().slice(0, 16),
          categoryId: h.categoryId ?? 0,
          prizeId: h.prizeId ?? 0,
          winnerOption: h.winnerOption ?? "",
          rules: h.rules ?? "",
          answerType: h.answerType ?? "integer",
        });
        if (Array.isArray(h.prizeTiers) && h.prizeTiers.length > 0) {
          setPrizeTiers(h.prizeTiers);
        } else if (h.prizeId) {
          setPrizeTiers([{ rank: 1, prizeId: h.prizeId }]);
        }
      })
      .catch(() => setError("Failed to load hunch"))
      .finally(() => setLoading(false));
  }, [isEditing, params.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const validTiers = prizeTiers.filter((t) => t.prizeId > 0);
      const body = {
        ...form,
        endsAt: new Date(form.endsAt).toISOString(),
        imageUrl: form.imageUrl || null,
        winnerOption: form.winnerOption || null,
        prizeTiers: validTiers,
        prizeId: validTiers[0]?.prizeId ?? form.prizeId,
      };
      const res = isEditing
        ? await adminFetch(`/admin/hunches/${params.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await adminFetch("/admin/hunches", { method: "POST", body: JSON.stringify(body) });

      if (res.ok) {
        setLocation("/backstage/hunches");
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-sm text-gray-500">Loading...</div>
      </AdminLayout>
    );
  }

  const inputCls = "w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all";

  return (
    <AdminLayout>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/backstage/hunches")}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Hunches
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? "Edit hunch" : "New hunch"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing ? "Update the details below and save." : "Fill in the details to create a new prediction."}
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {/* Content section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Content</h2>

            <Field label="Title" required>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Will the Warriors win their next home game?"
                className={inputCls}
              />
            </Field>

            <Field label="Description" required>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Provide context that helps users make their prediction..."
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field label="Image URL" hint="Optional — shown as the hunch's cover photo">
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..."
                className={inputCls}
              />
            </Field>

            <Field label="Rules" hint="Displayed on the hunch detail page where users can read how the prediction will be resolved">
              <textarea
                rows={5}
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="Explain how this hunch will be resolved, what counts as a valid answer, and any special conditions..."
                className={`${inputCls} resize-none`}
              />
            </Field>
          </section>

          {/* Answer type section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Answer type</h2>
              <p className="text-xs text-gray-400 mt-0.5">Determines what kind of input users will see when submitting their prediction</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ANSWER_TYPES.map(({ value, label, description, Icon }) => {
                const active = form.answerType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, answerType: value })}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      active
                        ? "border-violet-500 bg-violet-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg ${active ? "bg-violet-100" : "bg-gray-100"}`}>
                      <Icon className={`w-4 h-4 ${active ? "text-violet-600" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-violet-700" : "text-gray-700"}`}>{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Prize Pool section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Gift className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Prize Pool</h2>
              </div>
              <p className="text-xs text-gray-400">Add one or more prizes. The 1st place prize is required.</p>
            </div>

            <div className="space-y-3">
              {prizeTiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 w-20 text-center shrink-0">
                    {ordinal(tier.rank)} place
                  </span>
                  <select
                    value={tier.prizeId}
                    onChange={(e) => {
                      const updated = prizeTiers.map((t, i) =>
                        i === idx ? { ...t, prizeId: Number(e.target.value) } : t
                      );
                      setPrizeTiers(updated);
                    }}
                    className={`${inputCls} flex-1`}
                  >
                    <option value={0} disabled>Select prize...</option>
                    {prizes.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.value})</option>)}
                  </select>
                  {prizeTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPrizeTiers(
                        prizeTiers
                          .filter((_, i) => i !== idx)
                          .map((t, i) => ({ ...t, rank: i + 1 }))
                      )}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPrizeTiers([...prizeTiers, { rank: prizeTiers.length + 1, prizeId: 0 }])}
                className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add prize tier
              </button>
              {prizeTiers.filter((t) => t.prizeId > 0).length > 1 && (
                <div className="text-sm font-semibold text-gray-700">
                  Total:{" "}
                  <span className="text-violet-700">
                    ${prizeTiers
                      .filter((t) => t.prizeId > 0)
                      .reduce((sum, t) => {
                        const p = prizes.find((p) => p.id === t.prizeId);
                        return sum + (p ? parsePrizeAmount(p.value) : 0);
                      }, 0)
                      .toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Settings section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Settings</h2>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Category" required>
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                  className={inputCls}
                >
                  <option value={0} disabled>Select category...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="resolved">Resolved</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Ends at" required>
                <input
                  required
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            {form.status === "resolved" && (
              <Field label="Winner option" hint="Exact text of the winning answer">
                <input
                  value={form.winnerOption}
                  onChange={(e) => setForm({ ...form, winnerOption: e.target.value })}
                  placeholder="Exact winning answer..."
                  className={inputCls}
                />
              </Field>
            )}

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Featured hunch</span>
                <p className="text-xs text-gray-400">Shown in the featured carousel on the homepage</p>
              </div>
            </label>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => setLocation("/backstage/hunches")}
              className="border border-gray-300 text-gray-700 text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? "Saving..." : <><Check className="w-4 h-4" />{isEditing ? "Save changes" : "Create hunch"}</>}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
