import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Loader2, User, ArrowRight, Tag, CheckCircle,
  Ticket, Package, Star, Zap, Crown, ChevronDown,
} from "lucide-react";

interface AffiliatePublic {
  id: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  bio: string | null;
  niche: string | null;
  customMessage: string | null;
}

const AFFILIATE_COOKIE_KEY = "hunch_affiliate_ref";
const AFFILIATE_COOKIE_TTL = 30 * 24 * 60 * 60 * 1000;

function saveAffiliateRef(slug: string) {
  try {
    const data = JSON.stringify({ slug, ts: Date.now() });
    localStorage.setItem(AFFILIATE_COOKIE_KEY, data);
    const exp = new Date(Date.now() + AFFILIATE_COOKIE_TTL).toUTCString();
    document.cookie = `${AFFILIATE_COOKIE_KEY}=${encodeURIComponent(slug)}; expires=${exp}; path=/; SameSite=Lax`;
  } catch {}
}

export function getAffiliateRef(): string | null {
  try {
    const raw = localStorage.getItem(AFFILIATE_COOKIE_KEY);
    if (!raw) return null;
    const { slug, ts } = JSON.parse(raw) as { slug: string; ts: number };
    if (Date.now() - ts > AFFILIATE_COOKIE_TTL) {
      localStorage.removeItem(AFFILIATE_COOKIE_KEY);
      return null;
    }
    return slug;
  } catch {
    return null;
  }
}

const PASSES = [
  { id: "free",    Icon: Ticket,  label: "Free",    tickets: 5,   amountCents: 0,    featured: false },
  { id: "starter", Icon: Package, label: "Starter", tickets: 10,  amountCents: 699,  featured: false },
  { id: "plus",    Icon: Star,    label: "Plus",     tickets: 25,  amountCents: 1399, featured: false },
  { id: "pro",     Icon: Zap,     label: "Pro",      tickets: 100, amountCents: 2999, featured: true  },
  { id: "elite",   Icon: Crown,   label: "Elite",    tickets: 250, amountCents: 4999, featured: false },
];

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}/mo`;
}

export default function AffiliateSlugPage() {
  const params = useParams<{ affiliateSlug: string }>();
  const slug = params.affiliateSlug ?? "";
  const [, setLocation] = useLocation();
  const plansRef = useRef<HTMLDivElement>(null);

  const [affiliate, setAffiliate] = useState<AffiliatePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(apiUrl(`/api/affiliates/public/${slug}`))
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        const data = await r.json() as AffiliatePublic;
        setAffiliate(data);
        saveAffiliateRef(slug);
        fetch(apiUrl("/api/affiliates/click"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            visitorId: (() => {
              try {
                let vid = localStorage.getItem("hunch_vid");
                if (!vid) { vid = Math.random().toString(36).slice(2); localStorage.setItem("hunch_vid", vid); }
                return vid;
              } catch { return undefined; }
            })(),
            landingPage: window.location.href,
          }),
        }).catch(() => {});
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  function scrollToPlans() {
    plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubscribe(planId: string) {
    setLocation(`/signup?ref=${encodeURIComponent(slug)}&plan=${planId}`);
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (notFound || !affiliate) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-xl font-bold">Este link no existe</p>
          <p className="text-muted-foreground">El afiliado que buscas no existe o fue desactivado.</p>
          <Button onClick={() => setLocation("/")} variant="outline">Volver al inicio</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-background to-indigo-50 pointer-events-none" />
          <div className="relative max-w-2xl mx-auto text-center">

            {/* Avatar */}
            {affiliate.avatarUrl ? (
              <img
                src={affiliate.avatarUrl}
                alt={affiliate.name}
                className="w-24 h-24 rounded-full object-cover mx-auto mb-5 border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-5 border-4 border-white shadow-lg">
                <User className="w-10 h-10 text-violet-500" />
              </div>
            )}

            {affiliate.niche && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 mb-4">
                <Tag className="w-3 h-3" /> {affiliate.niche}
              </span>
            )}

            {/* Title: Name x Hunch */}
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2 tracking-tight">
              {affiliate.name}{" "}
              <span className="text-violet-500">x</span>{" "}
              <span className="text-violet-600">Hunch</span>
            </h1>

            {affiliate.bio && (
              <p className="text-muted-foreground text-base mb-3 max-w-lg mx-auto">{affiliate.bio}</p>
            )}

            {/* Invite tagline */}
            <p className="text-foreground/70 text-base mb-5 max-w-lg mx-auto leading-relaxed">
              You have been invited by{" "}
              <span className="font-semibold text-foreground">{affiliate.name}</span>{" "}
              to Hunch, the only platform where you win prizes for predicting the outcome of an event.
            </p>

            {affiliate.customMessage && (
              <blockquote className="italic text-muted-foreground border-l-4 border-violet-400 pl-4 text-left max-w-md mx-auto mb-6">
                {affiliate.customMessage}
              </blockquote>
            )}

            {/* ── Redesigned offer callout ──────────────────────────────────── */}
            <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-left mb-8 max-w-md mx-auto shadow-lg shadow-green-200 overflow-hidden">
              <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1.5 rounded-full rotate-6 shadow-md">
                50% OFF
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white/20 rounded-xl p-2 shrink-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-snug mb-1">
                    Oferta exclusiva por invitacion
                  </p>
                  <p className="text-green-100 text-sm leading-relaxed">
                    Registrate con este link y recibe <strong className="text-white">50% de descuento</strong> en tu primer mes de monthly pass en Hunch.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Sin tarjeta requerida
                </span>
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Cancela cuando quieras
                </span>
              </div>
            </div>

            {/* ── Mini pass preview cards ───────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-2 max-w-md mx-auto mb-8">
              {PASSES.map(({ id, Icon, label, tickets, amountCents, featured }) => (
                <div
                  key={id}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-2.5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    featured
                      ? "border-violet-400 bg-violet-50 shadow-sm shadow-violet-100"
                      : "border-border bg-card"
                  }`}
                  onClick={scrollToPlans}
                >
                  {featured && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Top
                    </span>
                  )}
                  <Icon className={`w-4 h-4 ${featured ? "text-violet-600" : "text-muted-foreground"}`} />
                  <span className={`text-[11px] font-bold leading-none ${featured ? "text-violet-700" : "text-foreground"}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none">{tickets}t/mo</span>
                  <span className={`text-[10px] font-semibold leading-none ${featured ? "text-violet-600" : "text-foreground"}`}>
                    {formatPrice(amountCents)}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              onClick={scrollToPlans}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3.5 h-auto rounded-xl text-base shadow-lg shadow-violet-200"
            >
              Elige tu Pass y crea tu cuenta <ChevronDown className="w-4 h-4 ml-1.5" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Sin apuestas de dinero real. Solo predicciones con tickets.
            </p>
          </div>
        </div>

        {/* ── Plans section ────────────────────────────────────────────────── */}
        <div ref={plansRef} className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-2">Monthly Passes</p>
            <h2 className="text-2xl md:text-3xl font-black text-center mb-2">Elige tu plan</h2>
            <p className="text-muted-foreground text-center text-sm mb-10 max-w-md mx-auto">
              Empieza gratis o suscribete a un pass mensual para jugar mas y ganar mas premios.
              <strong className="text-green-600"> Tu primer mes con 50% OFF.</strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {PASSES.map(({ id, Icon, label, tickets, amountCents, featured }) => (
                <div
                  key={id}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                    featured
                      ? "border-violet-400 bg-violet-50 shadow-lg shadow-violet-100 scale-[1.03]"
                      : "border-border bg-card"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                      Top Choice
                    </span>
                  )}
                  <Icon className={`w-6 h-6 mb-3 ${featured ? "text-violet-600" : "text-muted-foreground"}`} />
                  <p className={`text-lg font-black mb-0.5 ${featured ? "text-violet-700" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground mb-3">{tickets} tickets/mo</p>
                  {amountCents === 0 ? (
                    <p className="text-2xl font-black text-foreground mb-4">Free</p>
                  ) : (
                    <p className={`text-2xl font-black mb-4 ${featured ? "text-violet-600" : "text-foreground"}`}>
                      ${(amountCents / 100).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  )}
                  <Button
                    onClick={() => handleSubscribe(id)}
                    className={`w-full h-9 rounded-xl font-semibold text-sm mt-auto ${
                      featured
                        ? "bg-violet-600 hover:bg-violet-700 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    }`}
                  >
                    {amountCents === 0 ? "Empezar gratis" : "Suscribirse"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── What is Hunch ─────────────────────────────────────────────────── */}
        <div className="py-16 px-4 bg-muted/30 border-t border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold mb-3">Que es Hunch?</h2>
            <p className="text-muted-foreground">
              Hunch es una plataforma de predicciones basada en habilidades. Predice resultados de deportes,
              musica, entretenimiento y finanzas para ganar premios reales — gift cards, merch y mas.
              No se apuesta dinero. Solo tus conocimientos y tus hunches.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
