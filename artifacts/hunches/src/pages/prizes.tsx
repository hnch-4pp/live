import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/apiFetch";
import { Gift, ChevronDown, ChevronUp, Loader2, QrCode, BarChart2, Link as LinkIcon, Key, Calendar, Truck, Package } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

interface PrizeAward {
  id: number;
  hunchId: number;
  hunchTitle: string;
  hunchSlug: string;
  rank: number | null;
  prizeLabel: string;
  prizeValue: string;
  awardType: "digital" | "physical";
  codeType: string | null;
  code: string | null;
  codeFileUrl: string | null;
  pin: string | null;
  expiresAt: string | null;
  usageInstructions: string | null;
  trackingNumber: string | null;
  courier: string | null;
  estimatedDelivery: string | null;
  terms: string | null;
  awardedAt: string;
}

function RankLabel({ rank }: { rank: number | null }) {
  if (!rank) return null;
  const map: Record<number, string> = { 1: "1er lugar", 2: "2do lugar", 3: "3er lugar" };
  return (
    <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full">
      {map[rank] ?? `${rank}° lugar`}
    </span>
  );
}

function CodeTypeIcon({ codeType }: { codeType: string | null }) {
  if (codeType === "qr") return <QrCode className="w-3.5 h-3.5 text-muted-foreground" />;
  if (codeType === "barcode") return <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />;
  if (codeType === "link") return <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Key className="w-3.5 h-3.5 text-muted-foreground" />;
}

function PrizeCard({ award }: { award: PrizeAward }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{award.prizeLabel}</p>
            {award.prizeValue && award.prizeValue !== award.prizeLabel && (
              <span className="text-sm font-bold text-primary">{award.prizeValue}</span>
            )}
            <RankLabel rank={award.rank} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{award.hunchTitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${award.awardType === "digital" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
            {award.awardType === "digital" ? "Digital" : "Físico"}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border space-y-4">
          <div className="pt-4">
            <Link href={`/hunch/${award.hunchSlug}`}>
              <span className="text-xs text-primary hover:underline font-medium">Ver el hunch</span>
            </Link>
          </div>

          {award.awardType === "digital" ? (
            <div className="space-y-3">
              {/* Code */}
              {award.codeType === "qr" || award.codeType === "barcode" ? (
                award.codeFileUrl && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <CodeTypeIcon codeType={award.codeType} />
                      {award.codeType === "qr" ? "Código QR" : "Código de barras"}
                    </p>
                    <img
                      src={award.codeFileUrl}
                      alt="código"
                      className="h-32 w-auto object-contain rounded-xl border border-border bg-white p-2"
                    />
                  </div>
                )
              ) : award.code ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <CodeTypeIcon codeType={award.codeType} />
                    {award.codeType === "link" ? "Link" : "Código"}
                  </p>
                  {award.codeType === "link" ? (
                    <a
                      href={award.code}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all font-mono"
                    >
                      {award.code}
                    </a>
                  ) : (
                    <div className="bg-muted rounded-xl px-4 py-3 font-mono text-sm tracking-widest text-foreground select-all">
                      {award.code}
                    </div>
                  )}
                </div>
              ) : null}

              {/* PIN */}
              {award.pin && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">PIN</p>
                  <div className="bg-muted rounded-xl px-4 py-2 font-mono text-sm tracking-widest text-foreground select-all inline-block">
                    {award.pin}
                  </div>
                </div>
              )}

              {/* Expiry */}
              {award.expiresAt && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  Vigencia: {format(new Date(award.expiresAt), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              )}

              {/* Usage instructions */}
              {award.usageInstructions && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Instrucciones de uso</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{award.usageInstructions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {award.trackingNumber && (
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Número de guía</p>
                    <p className="text-sm font-mono font-semibold text-foreground select-all">{award.trackingNumber}</p>
                  </div>
                </div>
              )}
              {award.courier && (
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Mensajería</p>
                    <p className="text-sm font-semibold text-foreground">{award.courier}</p>
                  </div>
                </div>
              )}
              {award.estimatedDelivery && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  Llegada estimada: {format(new Date(award.estimatedDelivery), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              )}
            </div>
          )}

          {/* Terms */}
          {award.terms && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Términos y condiciones</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{award.terms}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">
            Premiado {formatDistanceToNow(new Date(award.awardedAt), { addSuffix: true, locale: es })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PrizesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [awards, setAwards] = useState<PrizeAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { setLocation("/login"); return; }
  }, [authLoading, user, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch(apiUrl("/api/prizes/me"), { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d: PrizeAward[]) => setAwards(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Mis Premios</h1>
            {!loading && awards.length > 0 && (
              <p className="text-xs text-muted-foreground">{awards.length} {awards.length === 1 ? "premio" : "premios"} recibido{awards.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : awards.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Gift className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Sin premios aún</p>
            <p className="text-xs text-muted-foreground">Aquí aparecerán tus premios cuando resultes ganador de un Hunch.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {awards.map((a) => <PrizeCard key={a.id} award={a} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
