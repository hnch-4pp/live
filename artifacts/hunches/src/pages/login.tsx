import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Mail } from "lucide-react";

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
          className="w-11 text-center text-lg font-bold border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          style={{ height: "3.25rem" }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
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

  const handleEmail = async () => {
    setError("");
    setDevHint("");
    setLoading(true);
    try {
      const d = await post("/auth/login/send-otp", { email });
      if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
      setStep("otp");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await post("/auth/login/verify-otp", { code: otp });
      await refetch();
      setLocation("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-16 bg-muted/30 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {step === "email" ? "Welcome back" : "Check your email"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {step === "email" ? "Enter your email to receive a sign-in code" : `We sent a code to ${email}`}
            </p>
          </div>

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
                  onKeyDown={(e) => e.key === "Enter" && email && handleEmail()}
                  placeholder="you@example.com"
                  className="rounded-xl h-11 bg-background border-border"
                />
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-4">
                <OtpInput value={otp} onChange={setOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                {error}
              </p>
            )}

            {step === "email" ? (
              <Button
                className="w-full bg-primary text-white font-semibold rounded-xl h-11 shadow-sm hover:bg-primary/90"
                onClick={handleEmail}
                disabled={loading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              >
                {loading ? "Sending..." : "Send sign-in code"}
              </Button>
            ) : (
              <Button
                className="w-full bg-primary text-white font-semibold rounded-xl h-11 shadow-sm hover:bg-primary/90"
                onClick={handleOtp}
                disabled={loading || otp.length < 6}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            {step === "otp" ? (
              <>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setStep("email"); setOtp(""); setError(""); setDevHint(""); }}
                >
                  ← Change email
                </button>
                <button
                  className="text-sm text-primary hover:underline font-medium"
                  onClick={handleEmail}
                >
                  Resend code
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground w-full text-center">
                No account yet?{" "}
                <Link href="/signup" className="text-primary hover:underline font-semibold">Sign up</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
