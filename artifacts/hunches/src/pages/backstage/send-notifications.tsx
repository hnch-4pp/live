import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Send, Users, CheckCircle2 } from "lucide-react";
import { apiUrl } from "@/lib/apiFetch";

type Segment =
  | "all"
  | "subscribers"
  | "free"
  | "active_30d"
  | "has_predictions"
  | "has_referrals";

const SEGMENTS: { value: Segment; label: string; description: string }[] = [
  { value: "all",             label: "Todos los usuarios",          description: "Todos los usuarios registrados" },
  { value: "subscribers",     label: "Suscriptores activos",        description: "Usuarios con plan de suscripción activo" },
  { value: "free",            label: "Plan gratuito",               description: "Usuarios sin suscripción activa" },
  { value: "active_30d",      label: "Activos (últimos 30 días)",   description: "Usuarios que han iniciado sesión en los últimos 30 días" },
  { value: "has_predictions",  label: "Con predicciones",            description: "Usuarios que han participado en al menos un Hunch" },
  { value: "has_referrals",   label: "Con referidos",               description: "Usuarios que han referido al menos a una persona" },
];

function adminFetch(path: string, options?: RequestInit) {
  return fetch(apiUrl(`/api${path}`), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...options?.headers },
  });
}

const EMPTY_FORM = { title: "", body: "", link: "", segment: "all" as Segment };

export default function SendNotificationsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sent, setSent] = useState<{ count: number } | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/admin/notifications/push", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          link: form.link.trim() || null,
          segment: form.segment,
        }),
      });
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Session expired"); }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? "Error al enviar"); }
      return res.json() as Promise<{ ok: boolean; count: number }>;
    },
    onSuccess: (data) => {
      setSent({ count: data.count });
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) => {
      alert(`Error: ${err.message}`);
    },
  });

  const segmentMeta = SEGMENTS.find((s) => s.value === form.segment)!;
  const canSend = form.title.trim() && form.body.trim();

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Bell className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Enviar Notificación</h1>
            <p className="text-sm text-gray-500">Envía una notificación a un segmento de usuarios.</p>
          </div>
        </div>

        {/* Success */}
        {sent && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Notificación enviada</p>
              <p className="text-xs text-emerald-700 mt-0.5">Entregada a {sent.count} usuario{sent.count !== 1 ? "s" : ""}.</p>
            </div>
            <button onClick={() => setSent(null)} className="ml-auto text-xs text-emerald-700 hover:underline">Enviar otra</button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">

          {/* Segment */}
          <div className="space-y-2">
            <Label>Destinatarios</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEGMENTS.map((seg) => (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => set("segment", seg.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border-2 transition-all text-sm ${
                    form.segment === seg.value
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">{seg.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{seg.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Título <span className="text-red-500">*</span></Label>
            <Input
              id="notif-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="¡Nuevo Hunch disponible!"
              maxLength={100}
            />
            <p className="text-xs text-gray-400">{form.title.length}/100</p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-body">Mensaje <span className="text-red-500">*</span></Label>
            <textarea
              id="notif-body"
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="Escribe aquí el contenido de la notificación..."
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-gray-400">{form.body.length}/500</p>
          </div>

          {/* Link */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-link">Enlace <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input
              id="notif-link"
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
              placeholder="/tickets o https://..."
            />
          </div>

          {/* Preview */}
          {(form.title || form.body) && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vista previa</p>
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{form.title || "Título"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{form.body || "Mensaje..."}</p>
                  {form.link && <p className="text-xs text-primary mt-1">{form.link}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Send */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{segmentMeta.label}</span>
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              <Send className="w-4 h-4" />
              {sendMutation.isPending ? "Enviando..." : "Enviar notificación"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
