import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, CheckCircle2 } from "lucide-react";

type Step =
  | "email"
  | "email-otp"
  | "phone"
  | "phone-otp"
  | "address"
  | "dob";

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
  phone: "We'll send a verification code",
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

export default function Signup() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devHint, setDevHint] = useState("");

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
        const d = await post("/auth/signup/send-phone-otp", { phone });
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
    if (step === "phone") return phone.replace(/\D/g, "").length >= 7;
    if (step === "phone-otp") return phoneOtp.length === 6;
    if (step === "address") return address.trim().length >= 5;
    if (step === "dob") return dob.length > 0;
    return false;
  };

  const CTALabel: Record<Step, string> = {
    email: "Send verification code",
    "email-otp": "Verify email",
    phone: "Send verification code",
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

            {step === "phone" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                  placeholder="+1 555 000 0000"
                  className="rounded-xl h-11 bg-background border-border"
                />
              </div>
            )}

            {step === "phone-otp" && (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{phone}</span>
                </p>
                <OtpInput value={phoneOtp} onChange={setPhoneOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

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
                    const d = await post("/auth/signup/send-phone-otp", { phone });
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
