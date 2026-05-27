import { Link } from "wouter";
import { formatDistanceToNow, isPast, type Locale } from "date-fns";
import {
  enUS, es, de, fr, pt, it, ja, ko, zhCN, id, tr,
} from "date-fns/locale";
import { Users, Clock, Trophy, Award, Gift, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Hunch } from "@workspace/api-client-react";

interface HunchCardProps {
  hunch: Hunch;
  featured?: boolean;
}

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
  es,
  de,
  fr,
  pt,
  it,
  ja,
  ko,
  zh: zhCN,
  id,
  tr,
  /* hi and bn don't have date-fns locales — fallback to enUS */
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  sports:        "from-blue-900/80 to-blue-700/60",
  music:         "from-purple-900/80 to-pink-700/60",
  entertainment: "from-rose-900/80 to-orange-700/60",
  finance:       "from-emerald-900/80 to-teal-700/60",
  crypto:        "from-orange-900/80 to-yellow-700/60",
  politics:      "from-slate-900/80 to-slate-700/60",
};

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  sports:        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=480&fit=crop&auto=format&q=80",
  music:         "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=480&fit=crop&auto=format&q=80",
  entertainment: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=480&fit=crop&auto=format&q=80",
  finance:       "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=480&fit=crop&auto=format&q=80",
  crypto:        "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=480&fit=crop&auto=format&q=80",
  politics:      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=480&fit=crop&auto=format&q=80",
};

const STATUS_DOT: Record<string, string> = {
  open:     "bg-emerald-400",
  closed:   "bg-gray-400",
  resolved: "bg-primary",
  ending:   "bg-orange-400",
};

const STATUS_BADGE: Record<string, string> = {
  open:     "bg-white/90 text-emerald-700",
  closed:   "bg-white/90 text-gray-600",
  resolved: "bg-white/90 text-primary",
  ending:   "bg-white/90 text-orange-600",
};

const getPrizeIcon = (type: string) => {
  switch (type) {
    case "gift_card":       return <Gift className="w-3 h-3" />;
    case "merch":           return <Award className="w-3 h-3" />;
    case "cash_equivalent": return <DollarSign className="w-3 h-3" />;
    default:                return <Trophy className="w-3 h-3" />;
  }
};

export function HunchCard({ hunch, featured = false }: HunchCardProps) {
  const { t, i18n } = useTranslation();

  const dateFnsLocale = DATE_FNS_LOCALES[i18n.language] ?? enUS;

  const categorySlug = hunch.categoryName?.toLowerCase() || "sports";
  const gradient = CATEGORY_GRADIENTS[categorySlug] ?? "from-slate-900/80 to-slate-700/60";
  const imgSrc = hunch.imageUrl || CATEGORY_PLACEHOLDER[categorySlug] || CATEGORY_PLACEHOLDER.sports;

  const isExpired = isPast(new Date(hunch.endsAt));
  const effectiveStatus = (hunch.status === "open" && isExpired) ? "closed" : hunch.status;
  const statusKey = effectiveStatus;

  const statusLabel = (() => {
    if (effectiveStatus === "closed")   return t("status_closed");
    if (effectiveStatus === "resolved") return t("status_resolved");
    return t("status_open");
  })();

  const topOption = hunch.options.length > 0
    ? hunch.options.reduce((a, b) => a.percentage > b.percentage ? a : b)
    : null;

  const imgHeight = featured ? "h-56" : "h-44";

  const timeLeft = effectiveStatus === "open"
    ? t("time_left", {
        time: formatDistanceToNow(new Date(hunch.endsAt), { locale: dateFnsLocale }),
      })
    : t("ended");

  return (
    <Link href={`/hunch/${hunch.slug || hunch.id}`}>
      <article className={`group bg-card rounded-2xl border border-border overflow-hidden cursor-pointer hover-elevate card-shadow flex flex-col h-full ${featured ? "ring-2 ring-primary/20" : ""}`}>

        {/* ── Photo ── */}
        <div className={`relative ${imgHeight} overflow-hidden bg-muted flex-shrink-0`}>
          <img
            src={imgSrc}
            alt={hunch.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            style={{ objectPosition: hunch.imageFocalPoint ?? "center" }}
            loading="lazy"
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

          {/* Status — top left */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm ${STATUS_BADGE[statusKey] ?? STATUS_BADGE.open}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[statusKey] ?? STATUS_DOT.open}`} />
              {statusLabel}
            </span>
          </div>

          {/* Prize — top right */}
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm text-foreground">
              {getPrizeIcon(hunch.prize.type)}
              {hunch.prize.value}
            </span>
          </div>

          {/* Category — bottom left */}
          <div className="absolute bottom-3 left-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              {t(`cat_${categorySlug}`, { defaultValue: hunch.categoryName })}
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex flex-col flex-1 p-5">
          <h3 className={`font-display font-bold text-foreground leading-snug group-hover:text-primary transition-colors mb-4 line-clamp-4 overflow-hidden ${featured ? "text-xl h-[7rem]" : "text-base h-[5.5rem]"}`}>
            {hunch.title}
          </h3>

          {/* Options */}
          <div className="space-y-2.5 mb-4 flex-1">
            {hunch.options.slice(0, 3).map((option) => {
              const isWinner  = hunch.status === "resolved" && hunch.winnerOption === option.label;
              const isLeading = topOption?.id === option.id && hunch.status !== "resolved";
              return (
                <div key={option.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-sm truncate pr-3 ${isWinner ? "text-primary font-semibold" : "text-foreground font-medium"}`}>
                      {option.label}
                    </span>
                    <span className={`text-sm font-semibold font-mono tabular-nums flex-shrink-0 ${isLeading || isWinner ? "text-primary" : "text-muted-foreground"}`}>
                      {Math.round(option.percentage)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-primary" : isLeading ? "bg-primary/60" : "bg-border"}`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3.5 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{t("predictions_count", { count: hunch.participantCount.toLocaleString() })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
