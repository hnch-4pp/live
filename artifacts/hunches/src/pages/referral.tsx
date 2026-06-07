import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiFetch";
import { Gift, Copy, Check, Users, Ticket, ArrowRight, ChevronRight } from "lucide-react";

interface ReferralInfo {
  referralCode: string | null;
  referredCount: number;
  referrals: Array<{ id: number; username: string | null; createdAt: string }>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReferralPage() {
  const { t, i18n } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  const isES = i18n.language === "es";

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const { data: info, isLoading } = useQuery<ReferralInfo>({
    queryKey: ["me-referral"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/auth/me/referral"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load referral info");
      return res.json() as Promise<ReferralInfo>;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const handleCopy = () => {
    if (!info?.referralCode) return;
    navigator.clipboard.writeText(info.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (authLoading || isLoading || !user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-muted rounded-xl w-48" />
            <div className="h-4 bg-muted rounded w-72" />
            <div className="h-40 bg-muted rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-2xl space-y-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {isES ? "Invita a tus amigos" : "Refer a Friend"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isES
              ? "Comparte tu código. Ganen tickets juntos."
              : "Share your code. Earn tickets together."}
          </p>
        </div>

        {/* How it works */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {isES ? "Cómo funciona" : "How it works"}
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isES ? "Comparte tu código" : "Share your code"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isES
                    ? "Envía tu código único a tus amigos por WhatsApp, redes sociales o directamente."
                    : "Send your unique code to friends via WhatsApp, social media, or directly."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-emerald-700">2</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isES ? "Tu amigo se registra" : "Your friend signs up"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isES
                    ? "Cuando crea su cuenta, ingresa tu código en el paso de código promo o de referido."
                    : "When they create their account, they enter your code at the promo or referral code step."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Ticket className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isES ? "Ambos ganan tickets" : "Both earn tickets"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isES
                    ? "Tu amigo recibe +5 tickets de bienvenida extra. Tú recibes +10 tickets por cada referido."
                    : "Your friend gets +5 extra welcome tickets. You get +10 tickets for every successful referral."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-display font-bold text-emerald-700">+5</p>
            <p className="text-xs font-semibold text-emerald-600 mt-1">
              {isES ? "tickets para tu amigo" : "tickets for your friend"}
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-display font-bold text-primary">+10</p>
            <p className="text-xs font-semibold text-primary/80 mt-1">
              {isES ? "tickets para ti por referido" : "tickets for you per referral"}
            </p>
          </div>
        </div>

        {/* Your referral code */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            {isES ? "Tu código de referido" : "Your referral code"}
          </h2>
          {info?.referralCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3 border border-border">
                <span className="font-mono text-xl font-bold tracking-widest text-foreground flex-1 select-all">
                  {info.referralCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {isES ? "Copiado" : "Copied"}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      {isES ? "Copiar" : "Copy"}
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isES
                  ? "Comparte este código con tus amigos para que lo ingresen al registrarse."
                  : "Share this code with friends so they can enter it when signing up."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isES ? "Generando tu código..." : "Generating your code..."}
            </p>
          )}
        </div>

        {/* Referrals list */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              {isES ? "Mis Referidos" : "My Referrals"}
            </h2>
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
              <Users className="w-3 h-3" />
              {info?.referredCount ?? 0}
            </div>
          </div>

          {!info?.referrals.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {isES ? "Todavía no tienes referidos" : "No referrals yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isES
                  ? "Comparte tu código y cuando alguien se registre aparecerá aquí."
                  : "Share your code and your referrals will appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {info.referrals.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(r.username ?? "?").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {r.username ? `@${r.username}` : isES ? "Usuario" : "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                    <Ticket className="w-3 h-3" />
                    +10
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center pb-4">
          {isES
            ? "Los tickets se acreditan automáticamente cuando tu referido complete el registro."
            : "Tickets are credited automatically when your referral completes their registration."}
        </p>

      </div>
    </Layout>
  );
}
