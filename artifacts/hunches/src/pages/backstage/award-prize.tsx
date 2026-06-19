import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { ChevronLeft, Gift, Loader2, CheckCircle2, Upload, X, Link as LinkIcon } from "lucide-react";

interface HunchDetail {
  id: number;
  title: string;
  prizeTiers: Array<{ rank: number; prizeLabel: string; prizeValue: string }>;
}

interface UserDetail {
  id: number;
  username: string | null;
  email: string;
}

const CODE_TYPES = [
  { value: "alphanumeric", label: "Alfanumérico" },
  { value: "qr",           label: "QR" },
  { value: "barcode",      label: "Barras" },
  { value: "link",         label: "Link" },
];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition ${props.className ?? ""}`}
    />
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition resize-none ${props.className ?? ""}`}
    />
  );
}

export default function AwardPrize() {
  useAdminAuth();

  const params = useParams<{ id: string; userId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(search);
  const rankParam = searchParams.get("rank") ? parseInt(searchParams.get("rank")!) : null;
  const prizeLabelParam = searchParams.get("prizeLabel") ?? "";
  const prizeValueParam = searchParams.get("prizeValue") ?? "";

  const [hunch, setHunch] = useState<HunchDetail | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [awardType, setAwardType] = useState<"digital" | "physical">("digital");
  const [codeType, setCodeType] = useState("alphanumeric");
  const [code, setCode] = useState("");
  const [codeFileUrl, setCodeFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pin, setPin] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageInstructions, setUsageInstructions] = useState("");
  const [terms, setTerms] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!params.id || !params.userId) return;
    Promise.all([
      adminFetch(`/admin/hunches/${params.id}`).then((r) => r.json()),
      adminFetch(`/admin/users/${params.userId}`).then((r) => r.json()),
    ]).then(([h, u]) => {
      setHunch(h as HunchDetail);
      setUser(u as UserDetail);
    }).catch(() => setError("No se pudo cargar la información."))
      .finally(() => setLoading(false));
  }, [params.id, params.userId]);

  const prizeLabel = prizeLabelParam || (hunch?.prizeTiers.find((t) => t.rank === rankParam)?.prizeLabel ?? hunch?.prizeTiers[0]?.prizeLabel ?? "");
  const prizeValue = prizeValueParam || (hunch?.prizeTiers.find((t) => t.rank === rankParam)?.prizeValue ?? hunch?.prizeTiers[0]?.prizeValue ?? "");

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const res = await fetch("/api/storage/uploads", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { objectPath?: string; publicUrl?: string };
      setCodeFileUrl(data.publicUrl ?? data.objectPath ?? "");
    } catch {
      setError("No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        rank: rankParam,
        prizeLabel,
        prizeValue,
        awardType,
        terms: terms.trim() || null,
      };
      if (awardType === "digital") {
        body["codeType"] = codeType;
        if (codeType === "qr" || codeType === "barcode") {
          body["codeFileUrl"] = codeFileUrl || null;
        } else {
          body["code"] = code.trim() || null;
        }
        body["pin"] = pin.trim() || null;
        body["expiresAt"] = expiresAt || null;
        body["usageInstructions"] = usageInstructions.trim() || null;
      } else {
        body["trackingNumber"] = trackingNumber.trim() || null;
        body["courier"] = courier.trim() || null;
        body["estimatedDelivery"] = estimatedDelivery || null;
      }

      const res = await adminFetch(`/admin/hunches/${params.id}/award/${params.userId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Error al guardar");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      </AdminLayout>
    );
  }

  if (saved) {
    return (
      <AdminLayout>
        <div className="max-w-lg mx-auto py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Premio enviado</h2>
          <p className="text-sm text-gray-500 mb-6">
            Se notificó a <strong>{user?.username ? `@${user.username}` : user?.email}</strong> por correo con los detalles de su premio. El ganador puede verlo en la sección "Premios" de su cuenta.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => setLocation(`/backstage/hunches/${params.id}/participants`)}
              className="text-sm font-semibold text-gray-600 border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Volver a participantes
            </button>
            <button
              type="button"
              onClick={() => { setSaved(false); setCode(""); setCodeFileUrl(""); setPin(""); setExpiresAt(""); setUsageInstructions(""); setTerms(""); setTrackingNumber(""); setCourier(""); setEstimatedDelivery(""); }}
              className="text-sm font-semibold text-violet-600 border border-violet-200 px-5 py-2.5 rounded-xl hover:bg-violet-50 transition-colors"
            >
              Premiar otro
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setLocation(`/backstage/hunches/${params.id}/participants`)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Gift className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Premiar ganador</h1>
            <p className="text-xs text-gray-400 truncate max-w-xs">{hunch?.title}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Winner + Prize summary */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Ganador</span>
              <span className="text-sm font-bold text-gray-900">
                {user?.username ? `@${user.username}` : user?.email ?? `Usuario ${params.userId}`}
              </span>
              {rankParam && (
                <span className="ml-auto text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                  {rankParam === 1 ? "1er" : rankParam === 2 ? "2do" : rankParam === 3 ? "3er" : `${rankParam}°`} lugar
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Premio</span>
              <span className="text-sm font-bold text-gray-900">{prizeLabel}</span>
              {prizeValue && prizeValue !== prizeLabel && (
                <span className="text-sm text-gray-500">{prizeValue}</span>
              )}
            </div>
          </div>

          {/* Award type toggle */}
          <div>
            <Label>Tipo de entrega</Label>
            <div className="flex gap-2">
              {(["digital", "physical"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAwardType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    awardType === t
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {t === "digital" ? "Digital" : "Físico"}
                </button>
              ))}
            </div>
          </div>

          {awardType === "digital" ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detalles del premio digital</p>

              {/* Code type */}
              <div>
                <Label>Tipo de código</Label>
                <select
                  value={codeType}
                  onChange={(e) => { setCodeType(e.target.value); setCode(""); setCodeFileUrl(""); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
                >
                  {CODE_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {/* Code input depending on type */}
              {codeType === "link" ? (
                <div>
                  <Label>URL / Link</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              ) : codeType === "qr" || codeType === "barcode" ? (
                <div>
                  <Label>Archivo de imagen ({codeType === "qr" ? "QR" : "Código de barras"})</Label>
                  {codeFileUrl ? (
                    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50">
                      <img src={codeFileUrl} alt="code" className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-white" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 truncate">{codeFileUrl}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCodeFileUrl("")}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-6 justify-center text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors disabled:opacity-60"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? "Subiendo..." : "Haz clic para subir imagen"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Código alfanumérico</Label>
                  <Input
                    type="text"
                    placeholder="Ej. ABC123-XYZ456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              )}

              {/* PIN */}
              <div>
                <Label>PIN <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Input
                  type="text"
                  placeholder="Alfanumérico"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>

              {/* Expiry */}
              <div>
                <Label>Vigencia <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              {/* Instructions */}
              <div>
                <Label>Instrucciones de uso <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Textarea
                  rows={3}
                  placeholder="Cómo canjear el premio..."
                  value={usageInstructions}
                  onChange={(e) => setUsageInstructions(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detalles del envío físico</p>

              <div>
                <Label>Número de guía <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Input
                  type="text"
                  placeholder="Ej. 1Z999AA10123456784"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              <div>
                <Label>Mensajería <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Input
                  type="text"
                  placeholder="Ej. FedEx, DHL, Estafeta..."
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                />
              </div>

              <div>
                <Label>Fecha estimada de llegada <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Input
                  type="date"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Terms & conditions (shared) */}
          <div>
            <Label>Términos y condiciones <span className="font-normal text-gray-400">(opcional)</span></Label>
            <Textarea
              rows={3}
              placeholder="Restricciones, condiciones de uso..."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setLocation(`/backstage/hunches/${params.id}/participants`)}
              className="text-sm font-semibold text-gray-600 border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-violet-600 px-6 py-2.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60 ml-auto"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Gift className="w-3.5 h-3.5" />
              Enviar premio
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
