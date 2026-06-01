import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { apiUrl } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Bell, Save, Loader2 } from "lucide-react";

type AlertEvent =
  | "new_user"
  | "ticket_pack_purchase"
  | "subscription_start"
  | "subscription_cancel"
  | "account_delete"
  | "hunch_reminder_3d"
  | "hunch_reminder_1d"
  | "hunch_reminder_1h";

interface AlertEventPrefs { email: boolean; sms: boolean }
interface AlertPrefs {
  adminEmail: string;
  adminPhone: string;
  events: Record<AlertEvent, AlertEventPrefs>;
}

const EVENT_LABELS: Record<AlertEvent, { label: string; description: string; group: string }> = {
  new_user:             { label: "New user registered",         description: "Triggered each time a new account is created",                group: "Users" },
  account_delete:       { label: "Account deleted",             description: "Triggered when a user deletes their account",                  group: "Users" },
  ticket_pack_purchase: { label: "Ticket pack purchased",       description: "Triggered on every successful ticket pack payment",            group: "Payments" },
  subscription_start:   { label: "Monthly pass started",        description: "Triggered when a user subscribes to a monthly plan",          group: "Payments" },
  subscription_cancel:  { label: "Monthly pass cancelled",      description: "Triggered when a subscription is cancelled or lapses",        group: "Payments" },
  hunch_reminder_3d:    { label: "Hunch closing — 3 days",      description: "Sent when a hunch is ~3 days from closing",                   group: "Hunches" },
  hunch_reminder_1d:    { label: "Hunch closing — 1 day",       description: "Sent when a hunch is ~24 hours from closing",                 group: "Hunches" },
  hunch_reminder_1h:    { label: "Hunch closing — 1 hour",      description: "Sent when a hunch is ~1 hour from closing",                   group: "Hunches" },
};

const GROUPS: { label: string; events: AlertEvent[] }[] = [
  { label: "Users",    events: ["new_user", "account_delete"] },
  { label: "Payments", events: ["ticket_pack_purchase", "subscription_start", "subscription_cancel"] },
  { label: "Hunches",  events: ["hunch_reminder_3d", "hunch_reminder_1d", "hunch_reminder_1h"] },
];

const DEFAULT_PREFS: AlertPrefs = {
  adminEmail: "",
  adminPhone: "",
  events: {
    new_user:             { email: true,  sms: false },
    ticket_pack_purchase: { email: true,  sms: false },
    subscription_start:   { email: true,  sms: false },
    subscription_cancel:  { email: true,  sms: true  },
    account_delete:       { email: true,  sms: false },
    hunch_reminder_3d:    { email: true,  sms: false },
    hunch_reminder_1d:    { email: true,  sms: false },
    hunch_reminder_1h:    { email: false, sms: false },
  },
};

function adminFetch(path: string, options?: RequestInit) {
  return fetch(apiUrl(`/api${path}`), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...options?.headers },
  });
}

function Toggle({
  checked,
  onChange,
  icon: Icon,
  label,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: typeof Mail;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        checked
          ? `${color} shadow-sm`
          : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function AdminAlertsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: prefs, isLoading } = useQuery<AlertPrefs>({
    queryKey: ["admin-alert-prefs"],
    queryFn: async () => {
      const res = await adminFetch("/admin/alert-prefs");
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Unauthorized"); }
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<AlertPrefs>;
    },
  });

  const [form, setForm] = useState<AlertPrefs | null>(null);
  const current = form ?? prefs ?? DEFAULT_PREFS;

  const setEvent = (event: AlertEvent, channel: "email" | "sms", value: boolean) => {
    const base = form ?? prefs ?? DEFAULT_PREFS;
    setForm({
      ...base,
      events: {
        ...base.events,
        [event]: { ...base.events[event], [channel]: value },
      },
    });
  };

  const setContact = (field: "adminEmail" | "adminPhone", value: string) => {
    const base = form ?? prefs ?? DEFAULT_PREFS;
    setForm({ ...base, [field]: value });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: AlertPrefs) => {
      const res = await adminFetch("/admin/alert-prefs", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { window.location.href = "/backstage/login"; throw new Error("Unauthorized"); }
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-alert-prefs"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setForm(null);
    },
    onError: (err: Error) => { alert(`Error: ${err.message}`); },
  });

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Bell className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin Alerts</h1>
            <p className="text-sm text-gray-500">Choose which events trigger email or SMS notifications to you.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Contact settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Where to send alerts</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="flex items-center gap-1.5 text-xs">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> Admin email
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={current.adminEmail}
                    onChange={(e) => setContact("adminEmail", e.target.value)}
                    placeholder="you@example.com"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-phone" className="flex items-center gap-1.5 text-xs">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" /> Admin phone (SMS)
                  </Label>
                  <Input
                    id="admin-phone"
                    type="tel"
                    value={current.adminPhone}
                    onChange={(e) => setContact("adminPhone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Event groups */}
            {GROUPS.map((group) => (
              <div key={group.label} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.events.map((event) => {
                    const meta = EVENT_LABELS[event];
                    const evPrefs = current.events[event];
                    return (
                      <div key={event} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Toggle
                            checked={evPrefs.email}
                            onChange={(v) => setEvent(event, "email", v)}
                            icon={Mail}
                            label="Email"
                            color="bg-sky-50 text-sky-700 border-sky-200"
                          />
                          <Toggle
                            checked={evPrefs.sms}
                            onChange={(v) => setEvent(event, "sms", v)}
                            icon={MessageSquare}
                            label="SMS"
                            color="bg-emerald-50 text-emerald-700 border-emerald-200"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Save */}
            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium">Settings saved</span>
              )}
              <Button
                onClick={() => saveMutation.mutate(current)}
                disabled={saveMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              >
                {saveMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <><Save className="w-4 h-4" /> Save settings</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
