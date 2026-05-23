import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { useUpload } from "@workspace/object-storage-web";
import {
  AtSign, Check, X, Loader2, Mail, Phone, Calendar,
  MapPin, Lock, Trash2, AlertTriangle, ChevronRight, Camera,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
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

// ── Avatar section ─────────────────────────────────────────────────────────────

function AvatarUpload({
  avatarUrl,
  initials,
  onUploaded,
}: {
  avatarUrl: string | null;
  initials: string;
  onUploaded: (objectPath: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: ({ objectPath }) => {
      onUploaded(objectPath);
    },
  });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    uploadFile(file);
  };

  const imgSrc = preview ?? (avatarUrl ? `/api/storage${avatarUrl}` : null);

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
          disabled={isUploading}
          className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          aria-label="Change avatar"
        >
          {isUploading ? (
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
        <p className="text-sm font-medium text-foreground">Profile photo</p>
        <p className="text-xs text-muted-foreground mt-0.5">Click the photo to upload a new one</p>
      </div>
    </div>
  );
}

// ── Username section ───────────────────────────────────────────────────────────

function UsernameSection({
  current,
  onSaved,
}: {
  current: string | null;
  onSaved: (u: string) => void;
}) {
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
        const res = await fetch(`/api/auth/signup/check-username?username=${encodeURIComponent(raw)}`, { credentials: "include" });
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
      const res = await fetch("/api/auth/me", {
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="acc-username">Username</Label>
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? "Saved" : "Save"}
        </Button>
      </div>
      <p className={`text-xs ${
        status === "available" || status === "same" ? "text-green-600" :
        status === "taken" || status === "invalid" ? "text-destructive" :
        "text-muted-foreground"
      }`}>
        {status === "idle" && "3–20 characters: letters, numbers, _ or ."}
        {status === "checking" && "Checking availability..."}
        {status === "available" && `@${value.trim().toLowerCase()} is available`}
        {status === "same" && "This is your current username"}
        {status === "taken" && `@${value.trim().toLowerCase()} is already taken`}
        {status === "invalid" && "3–20 characters: letters, numbers, _ or ."}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Address section ────────────────────────────────────────────────────────────

function AddressSection({ current, onSaved }: { current: string | null; onSaved: (a: string) => void }) {
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
      const res = await fetch("/api/auth/me", {
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
    } catch (e: any) {
      setError(e.message);
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
        <Label>New street address</Label>
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
        <Label htmlFor="acc-apt">Apt / Suite / Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
          <Label htmlFor="acc-city">City</Label>
          <Input id="acc-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded-xl h-11 bg-background border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-state">State / Province</Label>
          <Input id="acc-state" type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className="rounded-xl h-11 bg-background border-border" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-postal">ZIP / Postal code</Label>
          <Input id="acc-postal" type="text" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="00000" className="rounded-xl h-11 bg-background border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-country">Country</Label>
          <Input id="acc-country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded-xl h-11 bg-background border-border" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        onClick={save}
        disabled={!canSave || saving || saved}
        className="w-full rounded-xl h-11 bg-primary text-white hover:bg-primary/90 font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {saved ? "Address saved" : "Save address"}
      </Button>
    </div>
  );
}

// ── Delete account dialog ──────────────────────────────────────────────────────

function DeleteDialog({
  email,
  onClose,
  onDeleted,
}: {
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete account");
      onDeleted();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Delete your account</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This action is permanent and cannot be undone. All your data, predictions, and progress will be erased.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type your email to confirm: <span className="font-mono text-foreground">{email}</span>
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
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">{error}</p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl h-11 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!confirmed || loading}
              className="flex-1 rounded-xl h-11 bg-destructive text-white hover:bg-destructive/90 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Account() {
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
    await fetch("/api/auth/me", {
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

          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Account Settings</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Profile */}
          <SectionCard title="Profile">
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
              <ReadOnlyField icon={Mail} label="Email address" value={user.email} note="Contact support to change your email" />
            </div>
          </SectionCard>

          {/* Personal info */}
          <SectionCard title="Personal Information">
            <ReadOnlyField
              icon={Phone}
              label="Phone number"
              value={user.phone ?? "—"}
              note="Contact support to update your phone"
            />
            <ReadOnlyField
              icon={Calendar}
              label="Date of birth"
              value={formatDate(user.dateOfBirth)}
            />
          </SectionCard>

          {/* Shipping address */}
          <SectionCard title="Shipping Address">
            <p className="text-xs text-muted-foreground -mt-1">Used to ship prizes to you when you win.</p>
            <AddressSection
              current={user.address}
              onSaved={async () => { await refetch(); }}
            />
          </SectionCard>

          {/* Danger zone */}
          <div className="bg-card border border-destructive/30 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-destructive/20">
              <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently erase all your data. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDelete(true)}
                  className="shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/5 hover:border-destructive font-semibold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
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
