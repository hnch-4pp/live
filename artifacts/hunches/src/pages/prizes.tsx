import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/apiFetch";
import {
  Gift, ChevronDown, ChevronUp, Loader2, QrCode, BarChart2,
  Link as LinkIcon, Key, Calendar, Truck, Package, ExternalLink, Copy, Check,
} from "lucide-react";
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
      aria-label="Copiar"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

function PrizeCard({ award }: { award: PrizeAward }) {
  const [open, setOpen] = useState(false);

  const rankLabel = award.rank
    ? ({ 1: "1er lugar", 2: "2do lugar", 3: "3er lugar" }[award.rank] ?? `${award.rank}° lugar`)
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

      {/* ── Header — always visible ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Gift className="w-5 h-5 text-primary" />
          </div>

          {/* Text block */}
          <div className="flex-1 min-w-0">
            {/* Prize name + value */}
            <p className="text-sm font-bold text-foreground leading-snug">
              {award.prizeLabel}
              {award.prizeValue && award.prizeValue !== award.prizeLabel && (
                <span className="ml-1.5 text-primary">{award.prizeValue}</span>
              )}
            </p>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {rankLabel && (
                <span className="text-[10px] font-bold tracking-wide text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full uppercase">
                  {rankLabel}
                </span>
              )}
              <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full uppercase ${
                award.awardType === "digital"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {award.awardType === "digital" ? "Digital" : "Físico"}
              </span>
            </div>

            {/* Hunch name — wraps instead of truncating */}
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug line-clamp-2">
              {award.hunchTitle}
            </p>
          </div>

          {/* Chevron */}
          <div className="shrink-0 mt-1">
            {open
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {/* ── Expanded details ───────────────────────────────────── */}
      {open && (
        <div className="border-t border-border">

          {award.awardType === "digital" ? (
            <div className="p-4 space-y-4">

              {/* QR / Barcode image */}
              {(award.codeType === "qr" || award.codeType === "barcode") && award.codeFileUrl && (
                <div className="flex flex-col items-center gap-2 bg-muted/40 rounded-xl p-4">
                  <img
                    src={award.codeFileUrl}
                    alt="código"
                    className="h-36 w-auto object-contain"
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    {award.codeType === "qr" ? "Código QR" : "Código de barras"}
                  </p>
                </div>
              )}

              {/* Link type */}
              {award.codeType === "link" && award.code && (
                <a
                  href={award.code}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3"
                >
                  <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-primary font-medium break-all flex-1">{award.code}</span>
                </a>
              )}

              {/* Text code */}
              {award.code && award.codeType !== "qr" && award.codeType !== "barcode" && award.codeType !== "link" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> Codigo
                  </p>
                  <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-3">
                    <span className="font-mono text-base font-bold tracking-[0.2em] text-foreground flex-1 select-all">
                      {award.code}
                    </span>
                    <CopyButton value={award.code} />
                  </div>
                </div>
              )}

              {/* PIN */}
              {award.pin && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">PIN</p>
                  <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-3">
                    <span className="font-mono text-base font-bold tracking-[0.2em] text-foreground flex-1 select-all">
                      {award.pin}
                    </span>
                    <CopyButton value={award.pin} />
                  </div>
                </div>
              )}

              {/* Expiry */}
              {award.expiresAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  Vigencia hasta el {format(new Date(award.expiresAt), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              )}

              {/* Usage instructions */}
              {award.usageInstructions && (
                <div className="bg-muted/40 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Instrucciones de uso</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {award.usageInstructions}
                  </p>
                </div>
              )}
            </div>

          ) : (
            /* Physical */
            <div className="p-4 space-y-3">
              {award.trackingNumber && (
                <div className="bg-muted rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Número de guía
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground flex-1 select-all">
                      {award.trackingNumber}
                    </span>
                    <CopyButton value={award.trackingNumber} />
                  </div>
                  {award.courier && (
                    <p className="text-xs text-muted-foreground mt-1">{award.courier}</p>
                  )}
                </div>
              )}
              {award.estimatedDelivery && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  Llegada estimada: {format(new Date(award.estimatedDelivery), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              )}
              {!award.trackingNumber && !award.estimatedDelivery && (
                <p className="text-xs text-muted-foreground">Sin datos de envío por el momento.</p>
              )}
            </div>
          )}

          {/* Footer: terms + link + date */}
          <div className="px-4 pb-4 space-y-3">
            {award.terms && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Términos y condiciones</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{award.terms}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Link href={`/hunch/${award.hunchSlug}`}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <LinkIcon className="w-3 h-3" /> Ver el hunch
                </span>
              </Link>
              <span className="text-[11px] text-muted-foreground/60">
                {formatDistanceToNow(new Date(award.awardedAt), { addSuffix: true, locale: es })}
              </span>
            </div>
          </div>
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
      <div className="max-w-lg mx-auto px-4 py-6 sm:py-10">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground leading-tight">Mis Premios</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {awards.length > 0
                  ? `${awards.length} ${awards.length === 1 ? "premio recibido" : "premios recibidos"}`
                  : "Aquí verás tus premios"}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : awards.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Gift className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">Sin premios aún</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aquí aparecerán tus premios cuando resultes ganador de un Hunch.
            </p>
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
