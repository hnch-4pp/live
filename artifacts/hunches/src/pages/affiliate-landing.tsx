import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { apiUrl } from "@/lib/apiFetch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, DollarSign, Zap, CheckCircle, ArrowRight, Copy, Check } from "lucide-react";

const TIER_COLORS = [
  "bg-zinc-100 text-zinc-700",
  "bg-violet-100 text-violet-700",
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
];

interface Tier {
  id: number;
  name: string;
  minActivePremiumUsers: number;
  maxActivePremiumUsers: number | null;
  commissionPercentage: number;
}

function tierRange(t: Tier): string {
  if (t.maxActivePremiumUsers == null) return `${t.minActivePremiumUsers}+ premium users`;
  return `${t.minActivePremiumUsers} – ${t.maxActivePremiumUsers} premium users`;
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4 p-5 rounded-2xl bg-muted/40 border border-border">
      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 text-violet-700">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-muted-foreground text-sm mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function AffiliateLanding() {
  const [, setLocation] = useLocation();

  const { data: tiersData } = useQuery<{ tiers: Tier[] }>({
    queryKey: ["affiliate-tiers-public"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/affiliates/tiers"));
      if (!res.ok) throw new Error("Failed to load tiers");
      return res.json() as Promise<{ tiers: Tier[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const tiers = tiersData?.tiers ?? [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  const preview = slug.trim()
    ? `hunch.fan/${slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")}`
    : "";

  function copySlug() {
    if (!preview) return;
    navigator.clipboard.writeText(`https://${preview}`).then(() => {
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 2000);
    });
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/affiliates/apply"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, slug, bio }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero */}
        <section className="relative py-20 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-background to-indigo-50 pointer-events-none" />
          <div className="relative max-w-3xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 mb-6 tracking-wide uppercase">
              Affiliate Program
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-foreground leading-tight mb-4">
              Convierte tu comunidad en una<br className="hidden md:block" /> comunidad de prediccion
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Invita a tus seguidores a jugar Hunch, crea tu propio link personalizado
              y gana comisiones recurrentes por los usuarios premium que generes.
            </p>
            <a
              href="#apply"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-violet-600 text-white font-bold text-base hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200"
            >
              Aplicar al programa de afiliados <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-muted/30 border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Como funciona</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: "01", title: "Crea tu cuenta", desc: "Aplica al programa y recibe tu link personalizado tipo hunch.fan/tunombre." },
                { n: "02", title: "Comparte tu link", desc: "Tus seguidores se registran en Hunch y reciben 50% de descuento en su primer mes." },
                { n: "03", title: "Cobra comisiones", desc: "Recibes comisiones recurrentes por cada usuario premium que generes." },
              ].map(s => (
                <div key={s.n} className="text-center p-6 rounded-2xl bg-background border border-border">
                  <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center mx-auto mb-4 text-sm">
                    {s.n}
                  </div>
                  <p className="font-bold text-foreground mb-2">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Por que unirte</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Feature icon={<DollarSign className="w-5 h-5" />} title="Comisiones recurrentes" desc="Gana cada mes que tus usuarios mantengan su suscripcion premium." />
              <Feature icon={<TrendingUp className="w-5 h-5" />} title="Tiers de comision" desc="A mas usuarios premium generes, mayor es tu porcentaje de comision." />
              <Feature icon={<Users className="w-5 h-5" />} title="Dashboard en tiempo real" desc="Ve tus clicks, signups, conversiones y revenue en un solo lugar." />
              <Feature icon={<Zap className="w-5 h-5" />} title="Link personalizado" desc="Tu propio link hunch.fan/tunombre para compartir con tu comunidad." />
            </div>

            {/* User benefit callout */}
            <div className="mt-8 p-6 rounded-2xl bg-green-50 border border-green-200">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-green-900">Beneficio para tus seguidores</p>
                  <p className="text-sm text-green-800 mt-1">
                    Cada usuario que se registre desde tu link recibe <strong>50% de descuento en su primer mes</strong> de monthly pass.
                    Ganas mas afiliados, ellos pagan menos. Todo el mundo gana.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Commission tiers */}
        <section className="py-16 px-4 bg-muted/30 border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Modelo de comisiones</h2>
            <p className="text-muted-foreground text-center mb-10">Tu tier sube automaticamente conforme crece tu comunidad premium.</p>
            {tiers.length > 0 ? (
              <div className={`grid gap-4 ${tiers.length <= 2 ? "sm:grid-cols-2" : tiers.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                {tiers.map((t, i) => (
                  <div key={t.id} className="p-5 rounded-2xl bg-background border border-border text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-3 ${TIER_COLORS[i % TIER_COLORS.length]}`}>{t.name}</span>
                    <p className="text-3xl font-black text-foreground mb-1">{t.commissionPercentage}%</p>
                    <p className="text-xs text-muted-foreground">{tierRange(t)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-5 rounded-2xl bg-background border border-border text-center animate-pulse">
                    <div className="h-5 w-16 rounded-full bg-muted mx-auto mb-3" />
                    <div className="h-8 w-12 rounded bg-muted mx-auto mb-2" />
                    <div className="h-3 w-24 rounded bg-muted mx-auto" />
                  </div>
                ))}
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground mt-6">
              Las comisiones se calculan sobre el revenue neto generado por tus usuarios premium activos.
              Tickets: 10% de comision fija.
            </p>
          </div>
        </section>

        {/* Application form */}
        <section id="apply" className="py-16 px-4">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Aplicar al programa</h2>
            <p className="text-muted-foreground text-center mb-8">
              Completa el formulario y revisaremos tu solicitud en los proximos dias habiles.
            </p>

            {success ? (
              <div className="text-center p-10 rounded-2xl bg-green-50 border border-green-200">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-bold text-green-900 mb-2">Solicitud enviada</p>
                <p className="text-sm text-green-800">Revisaremos tu aplicacion y te contactaremos por email pronto.</p>
              </div>
            ) : (
              <form onSubmit={apply} className="space-y-5 bg-background rounded-2xl border border-border p-6 shadow-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="aff-name">Nombre o alias</Label>
                  <Input id="aff-name" value={name} onChange={e => setName(e.target.value)} placeholder="Escorpion Dorado" required className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-email">Email</Label>
                  <Input id="aff-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-slug">Tu slug personalizado</Label>
                  <Input
                    id="aff-slug"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
                    placeholder="escorpiondorado"
                    required
                    className="rounded-xl h-11 font-mono"
                  />
                  {preview && (
                    <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg bg-muted text-sm font-mono text-muted-foreground">
                      <span className="flex-1 truncate">{preview}</span>
                      <button type="button" onClick={copySlug} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        {slugCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-bio">Bio / descripcion breve <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <textarea
                    id="aff-bio"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Cuéntanos sobre tu comunidad..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">{error}</p>
                )}
                <Button type="submit" disabled={loading || !name.trim() || !email.trim() || !slug.trim()} className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</> : "Aplicar al programa de afiliados"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ya tienes cuenta? <Link href="/login" className="text-primary underline">Inicia sesion</Link> y ve a tu dashboard.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
