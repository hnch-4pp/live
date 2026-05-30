import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Check, ChevronLeft, Hash, Percent, Calendar, Clock, Plus, Trash2, Gift, Layers, List } from "lucide-react";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

interface Category { id: number; name: string; slug: string; }

const ANSWER_TYPES = [
  { value: "integer", label: "Integer",  description: "Whole number (e.g. 42)",            Icon: Hash },
  { value: "decimal", label: "Decimal",  description: "With decimals (e.g. 3.14)",          Icon: Percent },
  { value: "date",    label: "Date",     description: "Date in dd/mm/yyyy",                 Icon: Calendar },
  { value: "time",    label: "Time",     description: "Duration in hh:mm:ss",               Icon: Clock },
];

interface Question {
  prompt: string;
  answerType: string;
  placeholder: string;
  sortOrder: number;
}

interface WinnerAnswer {
  questionId: number;
  prompt: string;
  answer: string;
}

const EMPTY = {
  title: "",
  slug: "",
  description: "",
  imageUrl: "",
  imageFocalPoint: "50% 50%",
  rules: "",
  status: "open",
  featured: false,
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  categoryId: 0,
  prizeId: 0,
  winnerOption: "",
  answerType: "integer",
  ticketCost: 1,
  isMulti: false,
};

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

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

function AnswerTypePicker({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`}>
      {ANSWER_TYPES.map(({ value: v, label, description, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-all ${
              active ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${active ? "bg-violet-100" : "bg-gray-100"}`}>
              <Icon className={`w-3.5 h-3.5 ${active ? "text-violet-600" : "text-gray-500"}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${active ? "text-violet-700" : "text-gray-700"}`}>{label}</p>
              {!compact && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{description}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function HunchForm() {
  useAdminAuth();

  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const isEditing = !!params.id;

  const [form, setForm]           = useState({ ...EMPTY });
  const [prizeTiers, setPrizeTiers] = useState<{ rank: number; prizeLabel: string }[]>([{ rank: 1, prizeLabel: "" }]);
  const [questions, setQuestions] = useState<Question[]>([
    { prompt: "", answerType: "integer", placeholder: "", sortOrder: 0 },
    { prompt: "", answerType: "integer", placeholder: "", sortOrder: 1 },
  ]);
  const [winnerAnswers, setWinnerAnswers] = useState<WinnerAnswer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(isEditing);
  const [error, setError]         = useState("");

  useEffect(() => {
    adminFetch("/admin/categories").then((r) => r.json() as Promise<Category[]>).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    adminFetch(`/admin/hunches/${params.id}`)
      .then((r) => r.json())
      .then((h) => {
        setForm({
          title: h.title ?? "",
          slug: h.slug ?? "",
          description: h.description ?? "",
          imageUrl: h.imageUrl ?? "",
          imageFocalPoint: h.imageFocalPoint ?? "50% 50%",
          status: h.status ?? "open",
          featured: h.featured ?? false,
          endsAt: new Date(h.endsAt).toISOString().slice(0, 16),
          categoryId: h.categoryId ?? 0,
          prizeId: h.prizeId ?? 0,
          winnerOption: h.winnerOption ?? "",
          rules: h.rules ?? "",
          answerType: h.answerType ?? "integer",
          ticketCost: h.ticketCost ?? 1,
          isMulti: h.isMulti ?? false,
        });
        if (Array.isArray(h.prizeTiers) && h.prizeTiers.length > 0) {
          setPrizeTiers(h.prizeTiers.map((t: { rank: number; prizeLabel?: string }) => ({ rank: t.rank, prizeLabel: t.prizeLabel ?? "" })));
        }
        if (Array.isArray(h.questions) && h.questions.length > 0) {
          setQuestions(h.questions.map((q: { id: number; prompt: string; answerType: string; placeholder?: string; sortOrder: number }) => ({
            prompt: q.prompt,
            answerType: q.answerType,
            placeholder: q.placeholder ?? "",
            sortOrder: q.sortOrder,
          })));
          // Pre-fill winner answers for resolved multi hunches
          if (h.status === "resolved" && h.isMulti) {
            const existingWA: Array<{ questionId: number; answer: string }> = (() => {
              try { return h.winnerAnswers ? JSON.parse(h.winnerAnswers) : []; } catch { return []; }
            })();
            const waMap = new Map(existingWA.map((wa: { questionId: number; answer: string }) => [wa.questionId, wa.answer]));
            setWinnerAnswers(h.questions.map((q: { id: number; prompt: string }) => ({
              questionId: q.id,
              prompt: q.prompt,
              answer: waMap.get(q.id) ?? "",
            })));
          }
        } else if (h.isMulti) {
          setQuestions([
            { prompt: "", answerType: "integer", placeholder: "", sortOrder: 0 },
            { prompt: "", answerType: "integer", placeholder: "", sortOrder: 1 },
          ]);
        }
      })
      .catch(() => setError("Failed to load hunch"))
      .finally(() => setLoading(false));
  }, [isEditing, params.id]);

  // Update winnerAnswers list when questions change (for resolved multi hunches)
  useEffect(() => {
    if (form.status === "resolved" && form.isMulti) {
      setWinnerAnswers((prev) => {
        const prevMap = new Map(prev.map((wa) => [wa.prompt, wa.answer]));
        return questions.map((q, i) => ({
          questionId: i,
          prompt: q.prompt,
          answer: prevMap.get(q.prompt) ?? "",
        }));
      });
    }
  }, [form.status, form.isMulti, questions]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const validTiers = prizeTiers.filter((t) => t.prizeLabel.trim());
      const body: Record<string, unknown> = {
        ...form,
        endsAt: new Date(form.endsAt).toISOString(),
        imageUrl: form.imageUrl || null,
        imageFocalPoint: form.imageFocalPoint || null,
        winnerOption: form.isMulti ? null : (form.winnerOption || null),
        prizeTiers: validTiers,
        isMulti: form.isMulti,
      };

      if (form.isMulti) {
        body["questions"] = questions.map((q, i) => ({ ...q, sortOrder: i }));
        if (form.status === "resolved" && winnerAnswers.length > 0) {
          body["winnerAnswers"] = JSON.stringify(winnerAnswers);
        }
      }

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

  const updateQuestion = (idx: number, field: keyof Question, value: string) => {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { prompt: "", answerType: "integer", placeholder: "", sortOrder: prev.length }]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 2) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, sortOrder: i })));
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
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({ ...f, title, slug: f.slug || toSlug(title) }));
                }}
                placeholder="e.g. Will the Warriors win their next home game?"
                className={inputCls}
              />
            </Field>

            <Field label="URL slug" hint="Used in the public URL: /hunch/your-slug-here">
              <div className="flex gap-2">
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })}
                  placeholder="e.g. warriors-next-home-game"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, slug: toSlug(form.title) })}
                  className="px-3 py-2 text-xs font-medium text-violet-600 border border-violet-200 rounded-xl hover:bg-violet-50 transition-colors whitespace-nowrap"
                >
                  Auto-generate
                </button>
              </div>
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

            {form.imageUrl && (
              <Field label="Focal point" hint="Click on the image to set the crop focus point">
                <div
                  className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 cursor-crosshair select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setForm({ ...form, imageFocalPoint: `${x}% ${y}%` });
                  }}
                >
                  <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: form.imageFocalPoint }} />
                  {(() => {
                    const [px, py] = (form.imageFocalPoint || "50% 50%").split(" ").map((v) => parseFloat(v));
                    return (
                      <div
                        className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg bg-violet-500/60 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ left: `${px}%`, top: `${py}%` }}
                      />
                    );
                  })()}
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {form.imageFocalPoint}
                  </div>
                </div>
              </Field>
            )}

            <Field label="Rules" hint="How will this hunch be resolved?">
              <textarea
                rows={5}
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="Explain how this hunch will be resolved, what counts as a valid answer, and any special conditions..."
                className={`${inputCls} resize-none`}
              />
            </Field>
          </section>

          {/* Prediction mode section */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Prediction type</h2>
              <p className="text-xs text-gray-400 mt-0.5">Choose between a single question or multiple criteria to win</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: false, Icon: List, label: "Single question", desc: "One prediction to make — classic hunch format." },
                { value: true,  Icon: Layers, label: "Multi-prediction", desc: "Two or more criteria — users answer each one. Must get all right to win." },
              ].map(({ value, Icon, label, desc }) => {
                const active = form.isMulti === value;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isMulti: value }))}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      active ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${active ? "bg-violet-100" : "bg-gray-100"}`}>
                      <Icon className={`w-4 h-4 ${active ? "text-violet-600" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-violet-700" : "text-gray-700"}`}>{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Single question answer type */}
            {!form.isMulti && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Answer type</p>
                <p className="text-xs text-gray-400 mb-3">Determines what kind of input users will see when submitting</p>
                <AnswerTypePicker value={form.answerType} onChange={(v) => setForm({ ...form, answerType: v })} />
              </div>
            )}

            {/* Multi-prediction question editor */}
            {form.isMulti && (
              <div className="space-y-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prediction criteria</p>
                <p className="text-xs text-gray-400">Each criterion is a separate question the user must answer. They need to get all of them right to win.</p>
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1">
                          Criterion {idx + 1}
                        </span>
                        {questions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Question / prompt <span className="text-red-500">*</span></label>
                        <input
                          required={form.isMulti}
                          value={q.prompt}
                          onChange={(e) => updateQuestion(idx, "prompt", e.target.value)}
                          placeholder={`e.g. How many yellow cards in the match?`}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Answer type</label>
                        <AnswerTypePicker value={q.answerType} onChange={(v) => updateQuestion(idx, "answerType", v)} compact />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder hint <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input
                          value={q.placeholder}
                          onChange={(e) => updateQuestion(idx, "placeholder", e.target.value)}
                          placeholder="e.g. Enter a whole number..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add criterion
                </button>
              </div>
            )}
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
                  <input
                    type="text"
                    value={tier.prizeLabel}
                    onChange={(e) => {
                      const updated = prizeTiers.map((t, i) => i === idx ? { ...t, prizeLabel: e.target.value } : t);
                      setPrizeTiers(updated);
                    }}
                    placeholder="e.g. Amazon Gift Card $50"
                    className={`${inputCls} flex-1`}
                  />
                  {prizeTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPrizeTiers(
                        prizeTiers.filter((_, i) => i !== idx).map((t, i) => ({ ...t, rank: i + 1 }))
                      )}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPrizeTiers([...prizeTiers, { rank: prizeTiers.length + 1, prizeLabel: "" }])}
              className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add prize tier
            </button>
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

              <Field label="Ticket cost" hint="Tickets required to participate (default: 1)">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.ticketCost}
                  onChange={(e) => setForm({ ...form, ticketCost: Math.max(1, parseInt(e.target.value) || 1) })}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Winner resolution */}
            {form.status === "resolved" && !form.isMulti && (
              <Field label="Winner option" hint="Exact text of the winning answer">
                <input
                  value={form.winnerOption}
                  onChange={(e) => setForm({ ...form, winnerOption: e.target.value })}
                  placeholder="Exact winning answer..."
                  className={inputCls}
                />
              </Field>
            )}

            {form.status === "resolved" && form.isMulti && winnerAnswers.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Correct answers per criterion</label>
                {winnerAnswers.map((wa, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-40 shrink-0 truncate" title={wa.prompt}>
                      {wa.prompt || `Criterion ${idx + 1}`}
                    </span>
                    <input
                      value={wa.answer}
                      onChange={(e) => {
                        const updated = [...winnerAnswers];
                        updated[idx] = { ...updated[idx], answer: e.target.value };
                        setWinnerAnswers(updated);
                      }}
                      placeholder="Exact correct answer..."
                      className={`${inputCls} flex-1`}
                    />
                  </div>
                ))}
              </div>
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
