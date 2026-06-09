import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { apiUrl } from "@/lib/apiFetch";
import { Check, ChevronLeft, Hash, Percent, Calendar, Clock, Plus, Trash2, Gift, Layers, List, Users, Trophy, ChevronDown, Link as LinkIcon, Image, Video, X, Upload } from "lucide-react";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const RANK_CONFIG: Record<number, { label: string; bg: string; border: string; badge: string; btn: string }> = {
  1: { label: "1st", bg: "bg-amber-50/60",  border: "border-amber-300",  badge: "bg-amber-100 text-amber-800 border-amber-200",  btn: "border-amber-300 text-amber-700 hover:bg-amber-50"  },
  2: { label: "2nd", bg: "bg-slate-50/60",  border: "border-slate-300",  badge: "bg-slate-100 text-slate-700 border-slate-200",  btn: "border-slate-300 text-slate-600 hover:bg-slate-50"  },
  3: { label: "3rd", bg: "bg-orange-50/60", border: "border-orange-300", badge: "bg-orange-100 text-orange-800 border-orange-200", btn: "border-orange-200 text-orange-700 hover:bg-orange-50" },
  4: { label: "4th", bg: "bg-purple-50/60", border: "border-purple-300", badge: "bg-purple-100 text-purple-800 border-purple-200", btn: "border-purple-200 text-purple-700 hover:bg-purple-50" },
  5: { label: "5th", bg: "bg-blue-50/60",   border: "border-blue-300",   badge: "bg-blue-100 text-blue-800 border-blue-200",     btn: "border-blue-200 text-blue-700 hover:bg-blue-50"    },
};

interface Category { id: number; name: string; slug: string; }

const ANSWER_TYPES = [
  { value: "integer", label: "Integer",  description: "Whole number (e.g. 42)",            Icon: Hash },
  { value: "decimal", label: "Decimal",  description: "With decimals (e.g. 3.14)",          Icon: Percent },
  { value: "date",    label: "Date",     description: "Date in dd/mm/yyyy",                 Icon: Calendar },
  { value: "time",    label: "Time",     description: "Duration in hh:mm:ss",               Icon: Clock },
];

interface Question {
  id?: number;
  prompt: string;
  answerType: string;
  placeholder: string;
  sortOrder: number;
}


interface PredParticipant { id: number; userId: number | null; username: string | null; phone: string | null; createdAt: string; }
interface PredGroup { label: string; count: number; pct: number; participants: PredParticipant[]; }
interface UserAnswer { questionId: number; questionPrompt: string; answerLabel: string; }
interface UserPredGroup { userId: number; username: string | null; phone: string | null; answers: UserAnswer[]; firstAt: string; }
interface PredData { total: number; byOption: PredGroup[]; byUser: UserPredGroup[]; }

interface ResultSource {
  type: "link" | "image" | "video";
  url: string;
  label: string;
}

const EMPTY = {
  title: "",
  slug: "",
  description: "",
  imageUrl: "",
  imageFocalPoint: "50% 50%",
  rules: "",
  tags: "",
  status: "open",
  featured: false,
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  categoryId: 0,
  prizeId: 0,
  winnerOption: "",
  resultText: "",
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

function ImageUploadField({ value, onChange, compact = false }: { value: string; onChange: (url: string) => void; compact?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploadError("");
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch(apiUrl("/api/storage/uploads"), {
        method: "POST",
        credentials: "include",
        headers: {
          "X-Admin-Request": "1",
          "content-type": file.type || "application/octet-stream",
          "x-file-name": file.name,
        },
        body: arrayBuffer,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { publicUrl: string };
      onChange(data.publicUrl);
    } catch {
      setUploadError("Upload failed — try again");
    } finally {
      setUploading(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
    />
  );

  if (compact) {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {fileInput}
        {value ? (
          <>
            <img src={value} alt="" className="h-7 w-12 object-cover rounded border border-gray-200 shrink-0" />
            <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{value.split("/").pop()}</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium shrink-0 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Change"}
            </button>
            <button type="button" onClick={() => onChange("")} className="text-gray-400 hover:text-red-500 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 text-xs border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Click to upload image"}
          </button>
        )}
        {uploadError && <span className="text-xs text-red-500 shrink-0">{uploadError}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {fileInput}
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
          <img src={value} alt="cover preview" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="bg-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Change image"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="bg-white text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg shadow hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors disabled:opacity-50"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload cover image"}</span>
          <span className="text-xs">JPG, PNG, WebP — up to 10 MB</span>
        </button>
      )}
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
    </div>
  );
}

export default function HunchForm() {
  useAdminAuth();

  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const isEditing = !!params.id;

  const [form, setForm]           = useState({ ...EMPTY });
  const [prizeTiers, setPrizeTiers] = useState<{ rank: number; prizeLabel: string; prizeValue: string; prizeImageUrl: string }[]>([{ rank: 1, prizeLabel: "", prizeValue: "", prizeImageUrl: "" }]);
  const [prizeConditions, setPrizeConditions] = useState("");
  const [prizeConditionsOpen, setPrizeConditionsOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { prompt: "", answerType: "integer", placeholder: "", sortOrder: 0 },
    { prompt: "", answerType: "integer", placeholder: "", sortOrder: 1 },
  ]);
  const [winnerUserId, setWinnerUserId] = useState<number | null>(null);
  const [winnerRanks, setWinnerRanks] = useState<Array<{ rank: number; userId: number }>>([]);
  const [resultSources, setResultSources] = useState<ResultSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(isEditing);
  const [error, setError]         = useState("");
  const [predData, setPredData]   = useState<PredData | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  useEffect(() => {
    adminFetch("/admin/categories").then((r) => r.json() as Promise<Category[]>).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing || !params.id) return;
    setPredLoading(true);
    adminFetch(`/admin/hunches/${params.id}/predictions`)
      .then((r) => r.json() as Promise<PredData>)
      .then((d) => { setPredData(d); setPredLoading(false); })
      .catch(() => setPredLoading(false));
  }, [isEditing, params.id]);

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
          resultText: h.resultText ?? "",
          rules: h.rules ?? "",
          tags: h.tags ?? "",
          answerType: h.answerType ?? "integer",
          ticketCost: h.ticketCost ?? 1,
          isMulti: h.isMulti ?? false,
        });
        if (h.resultSources) {
          try { setResultSources(JSON.parse(h.resultSources) as ResultSource[]); } catch { /* ignore */ }
        }
        if (Array.isArray(h.prizeTiers) && h.prizeTiers.length > 0) {
          setPrizeTiers(h.prizeTiers.map((t: { rank: number; prizeLabel?: string; prizeValue?: string; prizeImageUrl?: string }) => ({
            rank: t.rank,
            prizeLabel: t.prizeLabel ?? "",
            prizeValue: t.prizeValue ?? "",
            prizeImageUrl: t.prizeImageUrl ?? "",
          })));
        }
        if (h.prizeConditions) {
          setPrizeConditions(h.prizeConditions as string);
          setPrizeConditionsOpen(true);
        }
        if (h.winnerUserId) setWinnerUserId(h.winnerUserId as number);
        if (h.winnerRanks) {
          try { setWinnerRanks(JSON.parse(h.winnerRanks) as Array<{ rank: number; userId: number }>); }
          catch { /* ignore */ }
        }
        if (Array.isArray(h.questions) && h.questions.length > 0) {
          setQuestions(h.questions.map((q: { id: number; prompt: string; answerType: string; placeholder?: string; sortOrder: number }) => ({
            id: q.id,
            prompt: q.prompt,
            answerType: q.answerType,
            placeholder: q.placeholder ?? "",
            sortOrder: q.sortOrder,
          })));
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

  function buildBody(overrideStatus?: string): Record<string, unknown> {
    const parsedEndsAt = form.endsAt ? new Date(form.endsAt) : null;
    const validTiers = prizeTiers
      .filter((t) => t.prizeLabel?.trim())
      .map((t) => ({ rank: t.rank, prizeLabel: t.prizeLabel, prizeValue: t.prizeValue || t.prizeLabel, prizeImageUrl: t.prizeImageUrl || null }));
    const body: Record<string, unknown> = {
      ...form,
      status: overrideStatus ?? form.status,
      endsAt: parsedEndsAt?.toISOString() ?? form.endsAt,
      imageUrl: form.imageUrl || null,
      prizeConditions: prizeConditions.trim() || null,
      imageFocalPoint: form.imageFocalPoint || null,
      winnerOption: form.winnerOption || null,
      resultText: form.resultText || null,
      resultSources: resultSources.length > 0 ? JSON.stringify(resultSources) : null,
      prizeTiers: validTiers,
      isMulti: form.isMulti,
    };
    if (form.isMulti) {
      body["questions"] = questions.map((q, i) => ({ ...q, sortOrder: i }));
      body["winnerOption"] = null;
      if (prizeTiers.length > 1) {
        body["winnerRanks"] = winnerRanks.length > 0 ? winnerRanks : null;
        body["winnerUserId"] = null;
      } else {
        body["winnerUserId"] = winnerUserId ?? null;
        body["winnerRanks"] = null;
      }
    }
    return body;
  }

  async function sendSave(body: Record<string, unknown>): Promise<void> {
    const res = isEditing
      ? await adminFetch(`/admin/hunches/${params.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : await adminFetch("/admin/hunches", { method: "POST", body: JSON.stringify(body) });
    if (res.ok) {
      setLocation("/backstage/hunches");
    } else {
      let errMsg = "Failed to save";
      try {
        const data = await res.json() as { error?: string };
        errMsg = data.error ?? errMsg;
      } catch {
        errMsg = `Server error (HTTP ${res.status})`;
      }
      setError(errMsg);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const parsedEndsAt = new Date(form.endsAt);
      if (!form.endsAt || isNaN(parsedEndsAt.getTime())) {
        setError("Please enter a valid end date.");
        setSaving(false);
        return;
      }
      // Draft → submit = publish (set status to "open")
      const overrideStatus = form.status === "draft" ? "open" : undefined;
      await sendSave(buildBody(overrideStatus));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Unexpected error — check console for details");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!form.title.trim()) { setError("A title is required to save a draft."); return; }
    setSaving(true);
    setError("");
    try {
      await sendSave(buildBody("draft"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Unexpected error — check console for details");
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? "Edit hunch" : "New hunch"}
            </h1>
            {form.status === "draft" && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">Draft</span>
            )}
          </div>
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

            <Field label="Cover image" hint="Optional — shown as the hunch's cover photo">
              <ImageUploadField
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
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

            <Field label="Tags" hint="Comma-separated slugs (e.g. world-cup,tennis). Used by Trending Topics to filter hunches.">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="world-cup,roland-garros"
                className={inputCls}
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
                <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 w-20 text-center shrink-0">
                      {ordinal(tier.rank)} place
                    </span>
                    {prizeTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPrizeTiers(
                          prizeTiers.filter((_, i) => i !== idx).map((t, i) => ({ ...t, rank: i + 1 }))
                        )}
                        className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Image upload */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Prize image</label>
                    <ImageUploadField
                      value={tier.prizeImageUrl}
                      onChange={(url) => setPrizeTiers((prev) => prev.map((t, i) => i === idx ? { ...t, prizeImageUrl: url } : t))}
                    />
                  </div>

                  {/* Label + Value side by side */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Title <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={tier.prizeLabel}
                        onChange={(e) => setPrizeTiers((prev) => prev.map((t, i) => i === idx ? { ...t, prizeLabel: e.target.value } : t))}
                        placeholder="e.g. Amazon Gift Card"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Value</label>
                      <input
                        type="text"
                        value={tier.prizeValue}
                        onChange={(e) => setPrizeTiers((prev) => prev.map((t, i) => i === idx ? { ...t, prizeValue: e.target.value } : t))}
                        placeholder="e.g. $50"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            {prizeTiers.length > 1 && (() => {
              const total = prizeTiers.reduce((sum, t) => {
                const m = t.prizeValue.match(/\$?(\d+(?:\.\d+)?)/);
                return sum + (m ? parseFloat(m[1]) : 0);
              }, 0);
              return total > 0 ? (
                <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                  <span className="text-gray-500">Total prize pool</span>
                  <span className="font-bold text-gray-900">${total.toLocaleString()}</span>
                </div>
              ) : null;
            })()}

            {prizeTiers.length > 1 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                When multiple prizes are awarded, the prize pool is divided among the top finishers — one prize per place.
              </p>
            )}

            <button
              type="button"
              onClick={() => setPrizeTiers([...prizeTiers, { rank: prizeTiers.length + 1, prizeLabel: "", prizeValue: "", prizeImageUrl: "" }])}
              className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add prize tier
            </button>

            {/* Prize conditions — collapsible */}
            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setPrizeConditionsOpen((o) => !o)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium w-full text-left"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${prizeConditionsOpen ? "rotate-180" : ""}`} />
                Prize conditions
                {prizeConditions && !prizeConditionsOpen && (
                  <span className="ml-auto text-xs text-gray-400 font-normal">(set)</span>
                )}
              </button>
              {prizeConditionsOpen && (
                <div className="mt-3">
                  <textarea
                    value={prizeConditions}
                    onChange={(e) => setPrizeConditions(e.target.value)}
                    placeholder="e.g. Prize must be claimed within 30 days. Only valid for US residents."
                    rows={4}
                    className={`${inputCls} w-full resize-y`}
                  />
                  <p className="text-xs text-gray-400 mt-1">Shown to participants alongside the prize details.</p>
                </div>
              )}
            </div>
          </section>

          {/* Participants section — editing only */}
          {isEditing && (
            <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants
                  {predData && (
                    <span className="text-gray-400 font-normal normal-case tracking-normal text-xs">
                      — {predData.total} total
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  {predLoading && <span className="text-xs text-gray-400">Loading...</span>}
                  {predData && predData.total > 0 && (
                    <button
                      type="button"
                      onClick={() => setLocation(`/backstage/hunches/${params.id}/participants`)}
                      className="text-xs font-semibold text-violet-600 border border-violet-200 bg-white px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                    >
                      Ver todos
                    </button>
                  )}
                </div>
              </div>

              {!predLoading && predData?.total === 0 && (
                <p className="text-sm text-gray-400">No predictions yet.</p>
              )}

              {/* Multi-prediction: last 5 users, no winner buttons */}
              {predData && form.isMulti && predData.byUser.slice(-5).reverse().map((u) => {
                const displayName = u.username ? `@${u.username}` : (u.phone ?? `User ${u.userId}`);
                return (
                  <div key={u.userId} className="border border-gray-100 rounded-xl">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                          {u.answers.map((a) => (
                            <span key={a.questionId} className="text-xs text-gray-500">
                              <span className="text-gray-400">{a.questionPrompt}:</span>{" "}
                              <span className="font-semibold text-gray-800">{a.answerLabel}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 tabular-nums hidden sm:block">
                        {new Date(u.firstAt).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Single-prediction: flat individual rows (last 5 by date), no winner buttons */}
              {predData && !form.isMulti && (() => {
                const flat = predData.byOption
                  .flatMap((g) => g.participants.map((p) => ({ ...p, optionLabel: g.label })))
                  .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
                  .slice(0, 5);
                return flat.map((p) => {
                  const displayName = p.username ? `@${p.username}` : (p.phone ?? (p.userId != null ? `User ${p.userId}` : "Anonymous"));
                  return (
                    <div key={p.id} className="border border-gray-100 rounded-xl">
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400">Predicted:</span>
                            <span className="text-xs font-semibold text-gray-800">{p.optionLabel}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 tabular-nums hidden sm:block">
                          {new Date(String(p.createdAt)).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </section>
          )}

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

            {/* Results */}
            {form.status === "resolved" && (
              <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">Results</span>
                </div>

                <Field label="Result summary" hint="Explain what happened — shown publicly on the hunch page">
                  <textarea
                    value={form.resultText}
                    onChange={(e) => setForm({ ...form, resultText: e.target.value })}
                    placeholder="e.g. The final score was 3–1. Manchester City won the Premier League..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>

                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Sources <span className="font-normal text-gray-400">(links, images or videos where users can verify the result)</span></p>
                  <div className="space-y-2">
                    {resultSources.map((src, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={src.type}
                          onChange={(e) => setResultSources((s) => s.map((x, i) => i === idx ? { ...x, type: e.target.value as ResultSource["type"], url: "" } : x))}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white shrink-0"
                        >
                          <option value="link">Link</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                        {src.type === "image" ? (
                          <ImageUploadField
                            compact
                            value={src.url}
                            onChange={(url) => setResultSources((s) => s.map((x, i) => i === idx ? { ...x, url } : x))}
                          />
                        ) : (
                          <input
                            value={src.url}
                            onChange={(e) => setResultSources((s) => s.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                            placeholder="https://..."
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                        )}
                        {src.type !== "image" && (
                          <input
                            value={src.label}
                            onChange={(e) => setResultSources((s) => s.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                            placeholder="Label (optional)"
                            className="w-32 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setResultSources((s) => s.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setResultSources((s) => [...s, { type: "link", url: "", label: "" }])}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add source
                  </button>
                </div>
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
          <div className="flex items-center justify-between gap-3 pb-4">
            <button
              type="button"
              onClick={() => setLocation("/backstage/hunches")}
              className="border border-gray-300 text-gray-700 text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              {/* Save as draft — only shown for new hunches or existing drafts */}
              {(!isEditing || form.status === "draft") && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="border border-gray-300 text-gray-600 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save as draft"}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? "Saving..." : <><Check className="w-4 h-4" />{isEditing ? (form.status === "draft" ? "Publish hunch" : "Save changes") : "Create hunch"}</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
