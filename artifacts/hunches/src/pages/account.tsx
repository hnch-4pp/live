import { useState, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/apiFetch";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { useUpload } from "@workspace/object-storage-web";
import { useTranslation } from "react-i18next";
import {
  Check, X, Loader2, Mail, Phone, Calendar,
  MapPin, Lock, Trash2, AlertTriangle, Camera,
  KeyRound, MessageSquare, Eye, EyeOff,
} from "lucide-react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
      <Lock className="w-3.5 h-3.5 text-border mt-2 shrink-0" />
    </div>
  );
}

function AvatarUpload({
  avatarUrl,
  initials,
  onUploaded,
}: {
  avatarUrl: string | null;
  initials: string;
  onUploaded: (objectPath: string) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const { uploadFile, isUploading } = useUpload({
    basePath: apiUrl("/api/storage"),
    onSuccess: async ({ publicUrl }) => {
      setUploadStatus("saving");
      try {
        await onUploaded(publicUrl);
        setUploadStatus("saved");
        setTimeout(() => setUploadStatus("idle"), 2500);
      } catch {
        setUploadStatus("error");
        setTimeout(() => setUploadStatus("idle"), 3000);
      }
    },
    onError: () => {
      setPreview(null);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
    },
  });

  const handleFile = (file: File) => {
    setUploadStatus("idle");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    uploadFile(file);
  };

  const resolveAvatarSrc = (url: string) =>
    url.startsWith("http://") || url.startsWith("https://") ? url : `${apiUrl("/api/storage")}${url}`;

  const imgSrc = preview ?? (avatarUrl ? resolveAvatarSrc(avatarUrl) : null);
  const busy = isUploading || uploadStatus === "saving";

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-sm overflow-hidden shrink-0">
          {imgSrc ? (
            <img src={imgSrc} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-xl">{initials}</span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          aria-label="Change avatar"
        >
          {busy ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </button>
        <input
          ref={fileInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{t("acc_photo_label")}</p>
        {uploadStatus === "saved" ? (
          <p className="text-xs text-green-600 mt-0.5 font-medium">{t("acc_photo_saved", { defaultValue: "Photo saved" })}</p>
        ) : uploadStatus === "error" ? (
          <p className="text-xs text-destructive mt-0.5">{t("acc_photo_error", { defaultValue: "Upload failed. Try again." })}</p>
        ) : busy ? (
          <p className="text-xs text-muted-foreground mt-0.5">{t("acc_photo_uploading", { defaultValue: "Saving..." })}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">{t("acc_photo_hint")}</p>
        )}
      </div>
    </div>
  );
}

function UsernameSection({
  current,
  onSaved,
}: {
  current: string | null;
  onSaved: (u: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(current ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "same">("idle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = value.trim();
    if (!raw) { setStatus("idle"); return; }
    if (raw === current) { setStatus("same"); return; }
    const FORMAT_RE = /^[a-zA-Z0-9_.]{3,20}$/;
    if (!FORMAT_RE.test(raw)) { setStatus("invalid"); return; }
    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/auth/signup/check-username?username=${encodeURIComponent(raw)}`), { credentials: "include" });
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, current]);

  const canSave = status === "available" || status === "same";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: value.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved(data.username);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const statusText = () => {
    const lower = value.trim().toLowerCase();
    if (status === "idle")      return t("username_hint");
    if (status === "checking")  return t("checking_avail");
    if (status === "available") return t("username_available", { username: lower });
    if (status === "same")      return t("username_same");
    if (status === "taken")     return t("username_taken", { username: lower });
    if (status === "invalid")   return t("username_invalid");
    return "";
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="acc-username">{t("acc_username_label")}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
          <Input
            id="acc-username"
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value.replace(/\s/g, "")); setSaved(false); }}
            onKeyDown={(e) => e.key === "Enter" && canSave && !saving && save()}
            placeholder="your_username"
            className="rounded-xl h-11 bg-background border-border pl-7 pr-10"
            maxLength={20}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
            {(status === "available" || status === "same") && <Check className="w-4 h-4 text-green-500" />}
            {(status === "taken" || status === "invalid") && <X className="w-4 h-4 text-destructive" />}
          </span>
        </div>
        <Button
          onClick={save}
          disabled={!canSave || saving || saved}
          className="rounded-xl h-11 px-5 bg-primary text-white hover:bg-primary/90 font-semibold shrink-0"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? t("saved_btn") : t("save_btn")}
        </Button>
      </div>
      <p className={`text-xs ${
        status === "available" || status === "same" ? "text-green-600" :
        status === "taken" || status === "invalid" ? "text-destructive" :
        "text-muted-foreground"
      }`}>
        {statusText()}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function NameSection({
  currentFirst,
  currentLast,
  onSaved,
}: {
  currentFirst: string | null;
  currentLast: string | null;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(currentFirst ?? "");
  const [lastName, setLastName] = useState(currentLast ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const canSave =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    (firstName.trim() !== (currentFirst ?? "") || lastName.trim() !== (currentLast ?? ""));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-first-name">Nombre(s)</Label>
          <Input
            id="acc-first-name"
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); setSaved(false); }}
            onKeyDown={(e) => e.key === "Enter" && canSave && !saving && save()}
            placeholder="Tu nombre"
            className="rounded-xl h-11 bg-background border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-last-name">Apellidos</Label>
          <Input
            id="acc-last-name"
            type="text"
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); setSaved(false); }}
            onKeyDown={(e) => e.key === "Enter" && canSave && !saving && save()}
            placeholder="Tus apellidos"
            className="rounded-xl h-11 bg-background border-border"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        onClick={save}
        disabled={!canSave || saving || saved}
        className="w-full rounded-xl h-11 bg-primary text-white hover:bg-primary/90 font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {saved ? "Guardado" : "Guardar nombre"}
      </Button>
    </div>
  );
}

function AddressSection({ current, onSaved }: { current: string | null; onSaved: (a: string) => void }) {
  const { t } = useTranslation();
  const [street, setStreet] = useState("");
  const [apt, setApt] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fullAddress = [street, apt, city, state, postal, country].filter(Boolean).join(", ");
  const canSave = street.trim().length >= 2 && city.trim().length >= 1 && country.trim().length >= 1;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: fullAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved(data.address);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {current && (
        <div className="bg-muted/50 rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{current}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>{t("new_street_label")}</Label>
        <AddressAutocomplete
          value={street}
          onChange={setStreet}
          onSelect={(p) => {
            setStreet(p.street);
            setCity(p.city);
            setState(p.state);
            setPostal(p.postal);
            setCountry(p.country);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acc-apt">
          {t("apt_label")} <span className="text-muted-foreground font-normal">{t("apt_opt")}</span>
        </Label>
        <Input
          id="acc-apt"
          type="text"
          autoComplete="off"
          value={apt}
          onChange={(e) => setApt(e.target.value)}
          placeholder="Apt 4B, Suite 100..."
          className="rounded-xl h-11 bg-background border-border"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-city">{t("city_label")}</Label>
          <Input id="acc-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("city_label")} className="rounded-xl h-11 bg-background border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-state">{t("state_label")}</Label>
          <Input id="acc-state" type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder={t("state_label")} className="rounded-xl h-11 bg-background border-border" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-postal">{t("zip_label")}</Label>
          <Input id="acc-postal" type="text" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="00000" className="rounded-xl h-11 bg-background border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-country">{t("country_label")}</Label>
          <Input id="acc-country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("country_label")} className="rounded-xl h-11 bg-background border-border" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        onClick={save}
        disabled={!canSave || saving || saved}
        className="w-full rounded-xl h-11 bg-primary text-white hover:bg-primary/90 font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {saved ? t("address_saved") : t("save_address")}
      </Button>
    </div>
  );
}

function LoginMethodSection({
  current,
  hasPassword,
  onSaved,
}: {
  current: "password" | "otp";
  hasPassword: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<"password" | "otp">(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);

  const changed = selected !== current;

  const saveMethod = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginMethod: selected }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPwd !== confirmPwd) { setPwdError(t("pw_no_match")); return; }
    if (newPwd.length < 8) { setPwdError(t("pw_too_short")); return; }
    setPwdSaving(true);
    setPwdError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me/set-password"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd || undefined, newPassword: newPwd }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to set password");
      setPwdSaved(true);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setTimeout(() => { setPwdSaved(false); setShowPwdForm(false); }, 2000);
      onSaved();
    } catch (e: unknown) {
      setPwdError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setPwdSaving(false);
    }
  };

  const options: Array<{ id: "password" | "otp"; icon: React.ElementType; titleKey: string; descKey: string }> = [
    { id: "password", icon: KeyRound, titleKey: "login_pw_option", descKey: "login_pw_desc" },
    { id: "otp",      icon: MessageSquare, titleKey: "login_otp_option", descKey: "login_otp_desc" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => { setSelected(opt.id); setError(""); setSaved(false); }}
              className={`relative text-left rounded-xl border p-4 transition-all ${
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-background hover:border-muted-foreground/30"
              }`}
            >
              {active && (
                <span className="absolute top-2.5 right-2.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </span>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t(opt.titleKey)}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{t(opt.descKey)}</p>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {changed && (
        <Button
          onClick={saveMethod}
          disabled={saving || saved}
          className="w-full rounded-xl h-11 bg-primary text-white hover:bg-primary/90 font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {saved ? t("saved_btn") : t("save_method")}
        </Button>
      )}

      {/* Change / Set password */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {hasPassword ? t("change_pw_title") : t("set_pw_title")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasPassword ? t("change_pw_sub") : t("set_pw_sub")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => { setShowPwdForm((v) => !v); setPwdError(""); setPwdSaved(false); }}
            className="shrink-0 rounded-xl text-sm font-semibold"
          >
            {showPwdForm ? t("cancel_btn") : hasPassword ? t("change_btn") : t("set_pw_btn")}
          </Button>
        </div>

        {showPwdForm && (
          <div className="mt-4 space-y-3">
            {hasPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="current-pwd">{t("current_pw")}</Label>
                <Input
                  id="current-pwd"
                  type="password"
                  autoComplete="current-password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder={t("current_pw_ph")}
                  className="rounded-xl h-11 bg-background border-border"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">{t("new_pw")}</Label>
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder={t("new_pw_ph")}
                  className="rounded-xl h-11 bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd">{t("confirm_pw")}</Label>
              <div className="relative">
                <Input
                  id="confirm-pwd"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder={t("confirm_pw_ph")}
                  className="rounded-xl h-11 bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
            <Button
              onClick={savePassword}
              disabled={pwdSaving || pwdSaved || !newPwd || !confirmPwd}
              className="w-full rounded-xl h-11 bg-primary text-white hover:bg-primary/90 font-semibold"
            >
              {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {pwdSaved ? t("pw_updated") : hasPassword ? t("update_pw") : t("set_pw_btn")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface AccountStatus {
  tickets: number;
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return "al final de tu periodo de suscripcion";
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

function DeleteDialog({
  email,
  onClose,
  onDeleted,
}: {
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/auth/me/account-status"), { credentials: "include" })
      .then((r) => r.json())
      .then((d: AccountStatus) => setAccountStatus(d))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();
  const hasSub = !!accountStatus?.subscription;
  const hasTickets = (accountStatus?.tickets ?? 0) > 0;
  const ticketCount = accountStatus?.tickets ?? 0;
  const periodEnd = accountStatus?.subscription?.currentPeriodEnd ?? null;

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json() as { ok?: boolean; deleted?: boolean; scheduled?: boolean; deletionDate?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete account");
      if (data.scheduled && data.deletionDate) {
        setScheduledDate(data.deletionDate);
      } else {
        onDeleted();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setLoading(false);
    }
  };

  // Scheduled confirmation screen (paid plan — account will be deleted at period end)
  if (scheduledDate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Cuenta programada para cierre</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tu suscripcion ha sido cancelada. Perdera tu acceso el{" "}
                <span className="font-semibold text-foreground">{formatPeriodEnd(scheduledDate)}</span>,
                cuando tu cuenta y todos tus datos seran eliminados definitivamente.
              </p>
            </div>
          </div>
          <Button onClick={onClose} className="w-full rounded-xl h-11 font-semibold">
            Entendido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Eliminar cuenta</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasSub
                ? "Tu suscripcion sera cancelada y perdera tu acceso al terminar el periodo actual."
                : "Esta accion es permanente e irreversible. Todos tus datos y predicciones seran eliminados."}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {statusLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Scenario warnings */}
              {!hasSub && hasTickets && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Tienes <span className="font-semibold">{ticketCount} {ticketCount === 1 ? "ticket" : "tickets"}</span> disponibles que perderacc al eliminar tu cuenta.
                  </p>
                </div>
              )}
              {hasSub && hasTickets && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Tienes <span className="font-semibold">{ticketCount} {ticketCount === 1 ? "ticket" : "tickets"}</span> disponibles que perderacc.
                    Tu acceso terminara el <span className="font-semibold">{formatPeriodEnd(periodEnd)}</span>.
                  </p>
                </div>
              )}
              {hasSub && !hasTickets && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Tu acceso terminara el <span className="font-semibold">{formatPeriodEnd(periodEnd)}</span>, al vencer tu periodo de suscripcion.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-email">
                  Escribe tu correo para confirmar:{" "}
                  <span className="font-mono text-foreground">{email}</span>
                </Label>
                <Input
                  id="confirm-email"
                  type="text"
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmed && !loading && handleDelete()}
                  placeholder={email}
                  className="rounded-xl h-11 bg-background border-border font-mono text-sm"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-xl h-11 font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={!confirmed || loading}
                  className="flex-1 rounded-xl h-11 bg-destructive text-white hover:bg-destructive/90 font-semibold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {hasSub ? "Confirmar cierre" : "Eliminar cuenta"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading, refetch, logout } = useAuth();
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const initials = (user.username ?? user.email).slice(0, 2).toUpperCase();

  const saveAvatarUrl = async (objectPath: string) => {
    await fetch(apiUrl("/api/auth/me"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: objectPath }),
    });
    await refetch();
  };

  return (
    <Layout>
      <div className="flex-1 bg-muted/30 py-10 px-4">
        <div className="max-w-lg mx-auto space-y-6">

          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{t("acc_settings_title")}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <SectionCard title={t("acc_profile")}>
            <AvatarUpload
              avatarUrl={user.avatarUrl}
              initials={initials}
              onUploaded={saveAvatarUrl}
            />
            <div className="border-t border-border pt-4 space-y-4">
              <UsernameSection
                current={user.username}
                onSaved={async () => { await refetch(); }}
              />
              <ReadOnlyField icon={Mail} label={t("acc_email_label")} value={user.email} note={t("acc_email_note")} />
            </div>
          </SectionCard>

          <SectionCard title={t("acc_personal")}>
            <NameSection
              currentFirst={user.firstName}
              currentLast={user.lastName}
              onSaved={async () => { await refetch(); }}
            />
            <div className="border-t border-border pt-4 space-y-4">
              <ReadOnlyField
                icon={Phone}
                label={t("acc_phone")}
                value={user.phone ?? "—"}
                note={t("acc_phone_note")}
              />
              <ReadOnlyField
                icon={Calendar}
                label={t("acc_dob")}
                value={formatDate(user.dateOfBirth)}
              />
            </div>
          </SectionCard>

          <SectionCard title={t("acc_security")}>
            <p className="text-xs text-muted-foreground -mt-1">{t("acc_security_sub")}</p>
            <LoginMethodSection
              current={user.loginMethod ?? "password"}
              hasPassword={user.hasPassword ?? false}
              onSaved={async () => { await refetch(); }}
            />
          </SectionCard>

          <SectionCard title={t("acc_shipping")}>
            <p className="text-xs text-muted-foreground -mt-1">{t("acc_shipping_sub")}</p>
            <AddressSection
              current={user.address}
              onSaved={async () => { await refetch(); }}
            />
          </SectionCard>

          <div className="bg-card border border-destructive/30 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-destructive/20">
              <h2 className="text-sm font-semibold text-destructive">{t("danger_zone")}</h2>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("delete_acct")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("delete_acct_sub")}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDelete(true)}
                  className="shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/5 hover:border-destructive font-semibold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("delete_acct")}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showDelete && (
        <DeleteDialog
          email={user.email}
          onClose={() => setShowDelete(false)}
          onDeleted={async () => {
            await logout();
            setLocation("/");
          }}
        />
      )}
    </Layout>
  );
}
