import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { apiUrl } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Pencil, Trash2, Bell, Info, AlertTriangle, CheckCircle2,
  Sparkles, ExternalLink, Power, PowerOff, X, Check,
} from "lucide-react";

interface TopNotification {
  id: number;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  type: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const TYPE_OPTIONS = [
  { value: "info",    label: "Info",    color: "bg-sky-100 text-sky-700 border-sky-200",    dot: "bg-sky-500" },
  { value: "warning", label: "Warning", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { value: "success", label: "Success", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { value: "promo",   label: "Promo",   color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
];

const PREVIEW_STYLES: Record<string, string> = {
  info:    "bg-sky-600 text-white",
  warning: "bg-amber-500 text-white",
  success: "bg-emerald-600 text-white",
  promo:   "bg-violet-600 text-white",
};

function TypeBadge({ type }: { type: string }) {
  const opt = TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${opt.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
      {opt.label}
    </span>
  );
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "w-4 h-4";
  switch (type) {
    case "warning": return <AlertTriangle className={cls} />;
    case "success": return <CheckCircle2 className={cls} />;
    case "promo":   return <Sparkles className={cls} />;
    default:        return <Info className={cls} />;
  }
}

const EMPTY_FORM = {
  message: "",
  linkUrl: "",
  linkLabel: "",
  type: "info",
  isActive: true,
  expiresAt: "",
};

type FormState = typeof EMPTY_FORM;

function adminFetch(path: string, options?: RequestInit) {
  return fetch(apiUrl(`/api${path}`), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...options?.headers },
  });
}

function NotificationPreview({ form }: { form: FormState }) {
  const barCls = PREVIEW_STYLES[form.type] ?? PREVIEW_STYLES.info;
  return (
    <div className={`rounded-lg px-4 py-2.5 flex items-center justify-center gap-2.5 text-sm relative ${barCls}`}>
      <TypeIcon type={form.type} className="w-4 h-4 opacity-80 shrink-0" />
      <span className="text-center leading-snug">
        {form.message || <span className="opacity-50">Your message will appear here</span>}
        {form.linkUrl && (
          <>
            {" "}
            <span className="underline font-semibold">
              {form.linkLabel || "Learn more"}
            </span>
          </>
        )}
      </span>
      <span className="absolute right-2 opacity-60"><X className="w-3.5 h-3.5" /></span>
    </div>
  );
}

function NotificationForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {/* Preview */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
        <NotificationPreview form={form} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Message */}
        <div className="space-y-1.5">
          <Label htmlFor="notif-message">Message <span className="text-red-500">*</span></Label>
          <Input
            id="notif-message"
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="New hunches available! Check out this week's predictions."
            maxLength={300}
          />
          <p className="text-xs text-gray-400">{form.message.length}/300</p>
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("type", opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  form.type === opt.value
                    ? `${opt.color} border-current shadow-sm`
                    : "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Link */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="notif-link">Link URL <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              id="notif-link"
              value={form.linkUrl}
              onChange={(e) => set("linkUrl", e.target.value)}
              placeholder="https://... or /tickets"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-link-label">Link label</Label>
            <Input
              id="notif-link-label"
              value={form.linkLabel}
              onChange={(e) => set("linkLabel", e.target.value)}
              placeholder="Learn more"
            />
          </div>
        </div>

        {/* Expiry + Active */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="notif-expires">Expires at <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              id="notif-expires"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => set("isActive", true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                  form.isActive
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Power className="w-3.5 h-3.5" /> Active
              </button>
              <button
                type="button"
                onClick={() => set("isActive", false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                  !form.isActive
                    ? "bg-gray-100 border-gray-300 text-gray-700 shadow-sm"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <PowerOff className="w-3.5 h-3.5" /> Inactive
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.message.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving ? "Saving..." : "Save notification"}
        </Button>
      </div>
    </div>
  );
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return "Expired";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: notifications = [], isLoading } = useQuery<TopNotification[]>({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const res = await adminFetch("/admin/notifications");
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<TopNotification[]>;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-notifications"] });

  const createMutation = useMutation({
    mutationFn: async (form: FormState) => {
      const res = await adminFetch("/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          message: form.message,
          linkUrl: form.linkUrl || null,
          linkLabel: form.linkLabel || null,
          type: form.type,
          isActive: form.isActive,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to create");
    },
    onSuccess: () => { invalidate(); setShowForm(false); },
    onError: (err: Error) => { alert(`Error saving notification: ${err.message}`); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: number; form: FormState }) => {
      const res = await adminFetch(`/admin/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          message: form.message,
          linkUrl: form.linkUrl || null,
          linkLabel: form.linkLabel || null,
          type: form.type,
          isActive: form.isActive,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => { invalidate(); setEditingId(null); },
    onError: (err: Error) => { alert(`Error updating notification: ${err.message}`); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/admin/notifications/${id}`, { method: "DELETE" });
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { invalidate(); setDeletingId(null); },
    onError: (err: Error) => { alert(`Error deleting notification: ${err.message}`); },
  });

  const toggleActive = async (n: TopNotification) => {
    await adminFetch(`/admin/notifications/${n.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !n.isActive }),
    });
    invalidate();
  };

  function initialFromNotif(n: TopNotification): FormState {
    let expiresAt = "";
    if (n.expiresAt) {
      const d = new Date(n.expiresAt);
      expiresAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return {
      message: n.message,
      linkUrl: n.linkUrl ?? "",
      linkLabel: n.linkLabel ?? "",
      type: n.type,
      isActive: n.isActive,
      expiresAt,
    };
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">Manage the top banner shown to all users.</p>
            </div>
          </div>
          {!showForm && (
            <Button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New notification
            </Button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">New notification</p>
            <NotificationForm
              initial={EMPTY_FORM}
              saving={createMutation.isPending}
              onCancel={() => setShowForm(false)}
              onSave={(form) => createMutation.mutate(form)}
            />
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-1">Create one to show a banner to all users.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const isExpired = n.expiresAt ? new Date(n.expiresAt) < new Date() : false;
              const isEditing = editingId === n.id;

              if (isEditing) {
                return (
                  <div key={n.id}>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Editing notification #{n.id}</p>
                    <NotificationForm
                      initial={initialFromNotif(n)}
                      saving={updateMutation.isPending}
                      onCancel={() => setEditingId(null)}
                      onSave={(form) => updateMutation.mutate({ id: n.id, form })}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={n.id}
                  className={`bg-white border rounded-xl p-4 transition-all ${
                    n.isActive && !isExpired
                      ? "border-violet-200 shadow-sm"
                      : "border-gray-200 opacity-60"
                  }`}
                >
                  {/* Preview bar */}
                  <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm mb-3 ${PREVIEW_STYLES[n.type] ?? PREVIEW_STYLES.info}`}>
                    <TypeIcon type={n.type} className="w-3.5 h-3.5 opacity-80 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{n.message}</span>
                    {n.linkUrl && (
                      <a href={n.linkUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="underline font-semibold flex items-center gap-0.5 shrink-0 text-xs">
                        {n.linkLabel ?? "Learn more"} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                    <TypeBadge type={n.type} />
                    <span className={`inline-flex items-center gap-1 font-medium ${
                      n.isActive && !isExpired ? "text-emerald-600" : "text-gray-400"
                    }`}>
                      {n.isActive && !isExpired ? <><Check className="w-3 h-3" /> Active</> : <><X className="w-3 h-3" /> {isExpired ? "Expired" : "Inactive"}</>}
                    </span>
                    <span>Expires: {formatExpiry(n.expiresAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleActive(n)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {n.isActive ? <><PowerOff className="w-3.5 h-3.5" /> Deactivate</> : <><Power className="w-3.5 h-3.5" /> Activate</>}
                    </button>
                    <button
                      onClick={() => { setEditingId(n.id); setShowForm(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <div className="ml-auto">
                      {deletingId === n.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-600 font-medium">Delete?</span>
                          <button
                            onClick={() => deleteMutation.mutate(n.id)}
                            disabled={deleteMutation.isPending}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(n.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
