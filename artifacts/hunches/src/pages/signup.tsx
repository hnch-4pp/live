import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Search, ChevronDown } from "lucide-react";

// ── Country data ─────────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico",              dial: "+52",  flag: "🇲🇽" },
  { code: "US", name: "United States",       dial: "+1",   flag: "🇺🇸" },
  { code: "CA", name: "Canada",              dial: "+1",   flag: "🇨🇦" },
  { code: "AR", name: "Argentina",           dial: "+54",  flag: "🇦🇷" },
  { code: "BR", name: "Brazil",              dial: "+55",  flag: "🇧🇷" },
  { code: "CL", name: "Chile",              dial: "+56",  flag: "🇨🇱" },
  { code: "CO", name: "Colombia",            dial: "+57",  flag: "🇨🇴" },
  { code: "PE", name: "Peru",               dial: "+51",  flag: "🇵🇪" },
  { code: "VE", name: "Venezuela",           dial: "+58",  flag: "🇻🇪" },
  { code: "EC", name: "Ecuador",             dial: "+593", flag: "🇪🇨" },
  { code: "BO", name: "Bolivia",             dial: "+591", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay",            dial: "+595", flag: "🇵🇾" },
  { code: "UY", name: "Uruguay",             dial: "+598", flag: "🇺🇾" },
  { code: "GT", name: "Guatemala",           dial: "+502", flag: "🇬🇹" },
  { code: "CU", name: "Cuba",               dial: "+53",  flag: "🇨🇺" },
  { code: "DO", name: "Dominican Republic",  dial: "+1",   flag: "🇩🇴" },
  { code: "HN", name: "Honduras",           dial: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador",        dial: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua",          dial: "+505", flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica",         dial: "+506", flag: "🇨🇷" },
  { code: "PA", name: "Panama",             dial: "+507", flag: "🇵🇦" },
  { code: "GB", name: "United Kingdom",     dial: "+44",  flag: "🇬🇧" },
  { code: "ES", name: "Spain",              dial: "+34",  flag: "🇪🇸" },
  { code: "FR", name: "France",             dial: "+33",  flag: "🇫🇷" },
  { code: "DE", name: "Germany",            dial: "+49",  flag: "🇩🇪" },
  { code: "IT", name: "Italy",              dial: "+39",  flag: "🇮🇹" },
  { code: "PT", name: "Portugal",           dial: "+351", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands",        dial: "+31",  flag: "🇳🇱" },
  { code: "SE", name: "Sweden",             dial: "+46",  flag: "🇸🇪" },
  { code: "NO", name: "Norway",             dial: "+47",  flag: "🇳🇴" },
  { code: "CH", name: "Switzerland",        dial: "+41",  flag: "🇨🇭" },
  { code: "AU", name: "Australia",          dial: "+61",  flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand",        dial: "+64",  flag: "🇳🇿" },
  { code: "JP", name: "Japan",              dial: "+81",  flag: "🇯🇵" },
  { code: "KR", name: "South Korea",        dial: "+82",  flag: "🇰🇷" },
  { code: "CN", name: "China",              dial: "+86",  flag: "🇨🇳" },
  { code: "IN", name: "India",              dial: "+91",  flag: "🇮🇳" },
  { code: "SG", name: "Singapore",          dial: "+65",  flag: "🇸🇬" },
  { code: "ZA", name: "South Africa",       dial: "+27",  flag: "🇿🇦" },
  { code: "NG", name: "Nigeria",            dial: "+234", flag: "🇳🇬" },
  { code: "IL", name: "Israel",             dial: "+972", flag: "🇮🇱" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia",       dial: "+966", flag: "🇸🇦" },
];

// ── Country picker component ──────────────────────────────────────────────────

function CountryPicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className="flex items-center gap-1.5 h-11 px-3 bg-background border border-border rounded-xl hover:bg-muted/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
      >
        <span className="text-xl leading-none">{value.flag}</span>
        <span className="text-sm font-medium text-foreground">{value.dial}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No results</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-violet-50 transition-colors text-left ${
                  c.code === value.code ? "bg-violet-50 text-violet-700 font-medium" : "text-foreground"
                }`}
              >
                <span className="text-lg leading-none w-6 text-center">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

type Step = "email" | "email-otp" | "phone" | "phone-otp" | "address" | "dob";

const STEP_TITLES: Record<Step, string> = {
  email: "Create your account",
  "email-otp": "Verify your email",
  phone: "Add your phone",
  "phone-otp": "Verify your phone",
  address: "Your address",
  dob: "Date of birth",
};

const STEP_SUBS: Record<Step, string> = {
  email: "Enter your email to get started",
  "email-otp": "We sent a 6-digit code to your email",
  phone: "We'll send a verification code via SMS",
  "phone-otp": "We sent a 6-digit code to your phone",
  address: "Required to ship prizes",
  dob: "You must be 18 or older to participate",
};

const STEPS: Step[] = ["email", "email-otp", "phone", "phone-otp", "address", "dob"];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const groups = [
    ["email", "email-otp"],
    ["phone", "phone-otp"],
    ["address"],
    ["dob"],
  ] as Step[][];
  return (
    <div className="flex items-center gap-1.5 justify-center mb-8">
      {groups.map((g, i) => {
        const done = g.every((s) => STEPS.indexOf(s) < idx);
        const active = g.includes(current);
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? "w-6 bg-primary" : done ? "w-3 bg-primary/40" : "w-3 bg-border"
            }`}
          />
        );
      })}
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            const arr = value.split("");
            arr[i] = v;
            onChange(arr.join("").slice(0, 6));
            if (v && e.target.nextElementSibling) {
              (e.target.nextElementSibling as HTMLInputElement).focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && e.currentTarget.previousElementSibling) {
              (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            onChange(pasted);
          }}
          className="w-11 h-13 text-center text-lg font-bold border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          style={{ height: "3.25rem" }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Signup() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]); // Mexico default
  const [localPhone, setLocalPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devHint, setDevHint] = useState("");

  // Full E.164 phone number for sending
  const fullPhone = country.dial + localPhone.replace(/^0+/, "").replace(/\D/g, "");
  // Display version for confirmation screen
  const displayPhone = `${country.flag} ${country.dial} ${localPhone}`;

  const post = async (path: string, body: object) => {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  };

  const handle = async () => {
    setError("");
    setDevHint("");
    setLoading(true);
    try {
      if (step === "email") {
        const d = await post("/auth/signup/send-email-otp", { email });
        if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
        setStep("email-otp");
      } else if (step === "email-otp") {
        await post("/auth/signup/verify-email-otp", { code: emailOtp });
        setStep("phone");
      } else if (step === "phone") {
        const d = await post("/auth/signup/send-phone-otp", { phone: fullPhone });
        if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
        setStep("phone-otp");
      } else if (step === "phone-otp") {
        await post("/auth/signup/verify-phone-otp", { code: phoneOtp });
        setStep("address");
      } else if (step === "address") {
        setStep("dob");
      } else if (step === "dob") {
        await post("/auth/signup/complete", { address, dateOfBirth: dob });
        await refetch();
        setLocation("/");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canBack = step !== "email";
  const back = () => {
    setError("");
    setDevHint("");
    const prev: Record<Step, Step | null> = {
      email: null,
      "email-otp": "email",
      phone: "email-otp",
      "phone-otp": "phone",
      address: "phone-otp",
      dob: "address",
    };
    const p = prev[step];
    if (p) setStep(p);
  };

  const isValid = () => {
    if (step === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (step === "email-otp") return emailOtp.length === 6;
    if (step === "phone") return localPhone.replace(/\D/g, "").length >= 6;
    if (step === "phone-otp") return phoneOtp.length === 6;
    if (step === "address") return address.trim().length >= 5;
    if (step === "dob") return dob.length > 0;
    return false;
  };

  const CTALabel: Record<Step, string> = {
    email: "Send verification code",
    "email-otp": "Verify email",
    phone: "Send SMS code",
    "phone-otp": "Verify phone",
    address: "Continue",
    dob: loading ? "Creating account..." : "Create account",
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-12 bg-muted/30 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-sm">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
              {step === "email" || step === "email-otp" ? <Mail className="w-5 h-5 text-white" /> :
               step === "phone" || step === "phone-otp" ? <Phone className="w-5 h-5 text-white" /> :
               step === "address" ? <MapPin className="w-5 h-5 text-white" /> :
               <Calendar className="w-5 h-5 text-white" />}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{STEP_TITLES[step]}</h1>
            <p className="text-muted-foreground text-sm mt-1.5">{STEP_SUBS[step]}</p>
          </div>

          <StepDots current={step} />

          <div className="bg-card border border-border rounded-2xl p-7 card-shadow space-y-5">

            {/* Email */}
            {step === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                  placeholder="you@example.com"
                  className="rounded-xl h-11 bg-background border-border"
                />
              </div>
            )}

            {/* Email OTP */}
            {step === "email-otp" && (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{email}</span>
                </p>
                <OtpInput value={emailOtp} onChange={setEmailOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

            {/* Phone with country picker */}
            {step === "phone" && (
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <div className="flex gap-2 items-stretch">
                  <CountryPicker value={country} onChange={(c) => { setCountry(c); setLocalPhone(""); }} />
                  <Input
                    type="tel"
                    autoFocus
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                    placeholder="55 6899 2044"
                    className="flex-1 rounded-xl h-11 bg-background border-border"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your number without the country code
                </p>
              </div>
            )}

            {/* Phone OTP */}
            {step === "phone-otp" && (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{displayPhone}</span>
                </p>
                <OtpInput value={phoneOtp} onChange={setPhoneOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

            {/* Address */}
            {step === "address" && (
              <div className="space-y-1.5">
                <Label htmlFor="address">Full address</Label>
                <textarea
                  id="address"
                  autoFocus
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State, ZIP, Country"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                />
                <p className="text-xs text-muted-foreground">Used only to ship prizes if you win</p>
              </div>
            )}

            {/* Date of birth */}
            {step === "dob" && (
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  autoFocus
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  className="rounded-xl h-11 bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">You must be at least 18 years old</p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                {error}
              </p>
            )}

            <Button
              className="w-full bg-primary text-white font-semibold rounded-xl h-11 shadow-sm hover:bg-primary/90"
              onClick={handle}
              disabled={loading || !isValid()}
            >
              {loading ? "Please wait..." : CTALabel[step]}
            </Button>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {canBack ? (
              <button
                onClick={back}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-semibold">Log in</Link>
              </p>
            )}
            {step === "email-otp" && (
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const d = await post("/auth/signup/send-email-otp", { email });
                    if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
                    setEmailOtp("");
                  } catch (e: any) { setError(e.message); }
                  finally { setLoading(false); }
                }}
              >
                Resend code
              </button>
            )}
            {step === "phone-otp" && (
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const d = await post("/auth/signup/send-phone-otp", { phone: fullPhone });
                    if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
                    setPhoneOtp("");
                  } catch (e: any) { setError(e.message); }
                  finally { setLoading(false); }
                }}
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
