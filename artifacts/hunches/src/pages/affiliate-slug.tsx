import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, User, ArrowRight, Tag, CheckCircle } from "lucide-react";

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

export default function AffiliateSlugPage() {
  const params = useParams<{ affiliateSlug: string }>();
  const slug = params.affiliateSlug ?? "";
  const [, setLocation] = useLocation();

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
        // Track click
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

  function handleCTA() {
    setLocation(`/signup?ref=${encodeURIComponent(slug)}`);
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
        {/* Hero */}
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
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 mb-3">
                <Tag className="w-3 h-3" /> {affiliate.niche}
              </span>
            )}

            <h1 className="text-3xl md:text-4xl font-black text-foreground mb-3">{affiliate.name}</h1>

            {affiliate.bio && (
              <p className="text-muted-foreground text-base mb-4 max-w-lg mx-auto">{affiliate.bio}</p>
            )}

            {affiliate.customMessage && (
              <blockquote className="italic text-muted-foreground border-l-4 border-violet-400 pl-4 text-left max-w-md mx-auto mb-6">
                {affiliate.customMessage}
              </blockquote>
            )}

            {/* Benefit callout */}
            <div className="inline-flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-left mb-8 max-w-md">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-900">
                <strong>Registrate con este link y recibe 50% de descuento</strong> en tu primer mes de monthly pass en Hunch.
              </p>
            </div>

            <Button
              onClick={handleCTA}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3.5 h-auto rounded-xl text-base shadow-lg shadow-violet-200"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Sin apuestas de dinero real. Solo predicciones con tickets.
            </p>
          </div>
        </div>

        {/* What is Hunch */}
        <div className="py-16 px-4 bg-muted/30 border-y border-border">
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
