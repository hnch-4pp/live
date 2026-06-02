import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Loader2, User, CheckCircle,
  Ticket, Package, Star, Zap, Crown, ChevronDown, Gift,
  Trophy, Music, Clapperboard, TrendingUp, Globe,
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
  { id: "plus",    Icon: Star,    label: "Plus",    tickets: 25,  amountCents: 1399, featured: false },
  { id: "pro",     Icon: Zap,     label: "Pro",     tickets: 100, amountCents: 2999, featured: true  },
  { id: "elite",   Icon: Crown,   label: "Elite",   tickets: 250, amountCents: 4999, featured: false },
];

const EXAMPLE_PREDICTIONS = [
  { Icon: Trophy,      category: "Sports",      color: "bg-orange-50 border-orange-200 text-orange-700",  dot: "bg-orange-400", text: "NBA Finals MVP 2025?" },
  { Icon: Music,       category: "Music",       color: "bg-pink-50 border-pink-200 text-pink-700",        dot: "bg-pink-400",   text: "Billboard #1 este viernes?" },
  { Icon: Clapperboard,category: "Entertainment",color: "bg-violet-50 border-violet-200 text-violet-700",dot: "bg-violet-400", text: "Oscar Mejor Pelicula?" },
  { Icon: TrendingUp,  category: "Finance",     color: "bg-emerald-50 border-emerald-200 text-emerald-700",dot:"bg-emerald-400",text: "Bitcoin supera $120k?" },
  { Icon: Trophy,      category: "Sports",      color: "bg-orange-50 border-orange-200 text-orange-700",  dot: "bg-orange-400", text: "Super Bowl LX Champion?" },
  { Icon: Music,       category: "Music",       color: "bg-pink-50 border-pink-200 text-pink-700",        dot: "bg-pink-400",   text: "Grammy Album del Ano?" },
  { Icon: Globe,       category: "World",       color: "bg-sky-50 border-sky-200 text-sky-700",           dot: "bg-sky-400",    text: "Ganador del Mundial 2026?" },
  { Icon: Clapperboard,category: "Entertainment",color: "bg-violet-50 border-violet-200 text-violet-700",dot: "bg-violet-400", text: "Serie mas vista de Netflix?" },
];

const FEATURES = [
  "Sin dinero real",
  "Premios reales: gift cards y merch",
  "Cancela cuando quieras",
  "5 tickets gratis cada mes",
];

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
    try {
      localStorage.setItem("hunch_pending_plan", JSON.stringify({ planId, ts: Date.now() }));
    } catch {}
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

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/40 to-white">
          {/* Subtle background orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-100/60 blur-3xl pointer-events-none" />
          <div className="absolute -top-16 -right-32 w-80 h-80 rounded-full bg-indigo-100/50 blur-3xl pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">

            {/* Top pill — influencer gift badge */}
            <div className="inline-flex items-center gap-2.5 bg-white border border-violet-200 rounded-full px-4 py-2 shadow-sm mb-10">
              {affiliate.avatarUrl ? (
                <img src={affiliate.avatarUrl} alt={affiliate.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-violet-200" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-violet-500" />
                </div>
              )}
              <Gift className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm font-semibold text-foreground">
                <span className="text-violet-600">{affiliate.name}</span> te manda un regalo
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl md:text-7xl font-black text-foreground leading-[1.05] tracking-tight mb-4">
              Predice y <span className="text-violet-600">Gana</span> Premios Reales.
            </h1>

            {/* Discount callout line */}
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <span className="text-3xl md:text-5xl font-black text-foreground">Tu primer mes</span>
              <span className="inline-block bg-violet-600 text-white text-3xl md:text-5xl font-black px-5 py-1.5 rounded-2xl leading-tight -rotate-1 shadow-lg shadow-violet-300">
                50% OFF
              </span>
            </div>

            {/* Sub-description */}
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
              Hunch es la unica plataforma donde ganas{" "}
              <span className="font-semibold text-foreground">gift cards, merch y premios reales</span>{" "}
              prediciendo resultados de deportes, musica, entretenimiento y finanzas.{" "}
              <span className="font-semibold text-foreground">Sin apostar dinero.</span>
            </p>

            {/* CTA button */}
            <Button
              onClick={scrollToPlans}
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-10 py-4 h-auto rounded-2xl text-lg shadow-xl shadow-violet-200 transition-transform hover:scale-[1.02] active:scale-[0.99] mb-6"
            >
              Elige tu Pass y crea tu cuenta
              <ChevronDown className="w-5 h-5 ml-2" />
            </Button>

            {/* Feature checkmarks */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12">
              {FEATURES.map(f => (
                <span key={f} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />
                  {f}
                </span>
              ))}
            </div>

            {/* ── Prediction example pills ─────────────────────────────────── */}
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-4">
                Ejemplos de predicciones activas
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PREDICTIONS.map((p, i) => (
                  <div
                    key={i}
                    className={`inline-flex items-center gap-2 border rounded-full px-4 py-2 text-sm font-medium ${p.color} cursor-default`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} />
                    <p.Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    {p.text}
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Y cientos mas en deportes, musica, entretenimiento, finanzas y world events.
              </p>
            </div>

          </div>
        </div>

        {/* ── PLANS SECTION ────────────────────────────────────────────────── */}
        <div ref={plansRef} className="py-20 px-4 bg-muted/30 border-y border-border">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-2">Monthly Passes</p>
            <h2 className="text-3xl md:text-4xl font-black text-center mb-2 tracking-tight">Elige tu plan</h2>
            <p className="text-muted-foreground text-center text-base mb-10 max-w-lg mx-auto">
              Empieza gratis o suscribete a un pass mensual.
              Con el link de {affiliate.name} tu primer mes tiene{" "}
              <strong className="text-violet-600">50% de descuento.</strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
              {PASSES.map(({ id, Icon, label, tickets, amountCents, featured }) => (
                <div
                  key={id}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                    featured
                      ? "border-violet-400 bg-white shadow-xl shadow-violet-100 lg:scale-[1.06]"
                      : "border-border bg-card"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-3 py-1 rounded-full shadow whitespace-nowrap">
                      Top Choice
                    </span>
                  )}
                  <Icon className={`w-6 h-6 mb-3 ${featured ? "text-violet-600" : "text-muted-foreground"}`} />
                  <p className={`text-lg font-black mb-0.5 ${featured ? "text-violet-700" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground mb-4">{tickets} tickets/mes</p>
                  {amountCents === 0 ? (
                    <p className="text-2xl font-black text-foreground mb-5">Gratis</p>
                  ) : (
                    <div className="mb-5">
                      <p className={`text-2xl font-black ${featured ? "text-violet-600" : "text-foreground"}`}>
                        ${(amountCents / 200).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">/primer mes</span>
                      </p>
                      <p className="text-xs text-muted-foreground line-through">
                        ${(amountCents / 100).toFixed(2)}/mo despues
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => handleSubscribe(id)}
                    className={`w-full h-10 rounded-xl font-semibold text-sm mt-auto ${
                      featured
                        ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    }`}
                  >
                    {amountCents === 0 ? "Empezar gratis" : "Suscribirse"}
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Sin apuestas de dinero real. Solo predicciones con tickets. Cancela en cualquier momento.
            </p>
          </div>
        </div>

        {/* ── WHAT IS HUNCH ────────────────────────────────────────────────── */}
        <div className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-10 tracking-tight">Como funciona Hunch</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  n: "01",
                  title: "Crea tu cuenta",
                  body: "Registrate gratis y recibe 5 tickets mensuales automaticamente. Sin tarjeta requerida.",
                },
                {
                  n: "02",
                  title: "Haz tus predicciones",
                  body: "Usa tus tickets para predecir resultados de deportes, musica, entretenimiento y finanzas.",
                },
                {
                  n: "03",
                  title: "Gana premios reales",
                  body: "Los mejores predictores ganan Amazon gift cards, Starbucks cards y merch exclusivo de Hunch.",
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex flex-col gap-3 p-6 rounded-2xl border border-border bg-card">
                  <span className="text-4xl font-black text-violet-200 leading-none">{n}</span>
                  <p className="font-bold text-foreground text-lg">{title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
