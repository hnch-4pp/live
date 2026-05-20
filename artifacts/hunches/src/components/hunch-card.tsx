import { Link } from "wouter";
import { formatDistanceToNow, isPast } from "date-fns";
import { Users, Clock, Trophy, Award, Gift, DollarSign, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Hunch } from "@workspace/api-client-react";

interface HunchCardProps {
  hunch: Hunch;
  featured?: boolean;
}

const getPrizeIcon = (type: string) => {
  switch (type) {
    case "gift_card": return <Gift className="w-3.5 h-3.5" />;
    case "merch": return <Award className="w-3.5 h-3.5" />;
    case "cash_equivalent": return <DollarSign className="w-3.5 h-3.5" />;
    default: return <Trophy className="w-3.5 h-3.5" />;
  }
};

const getStatusConfig = (status: string, endsAt: string) => {
  if (status === "closed") return { color: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
  if (status === "resolved") return { color: "bg-primary/10 text-primary", dot: "bg-primary" };
  if (isPast(new Date(endsAt))) return { color: "bg-orange-50 text-orange-600", dot: "bg-orange-500" };
  return { color: "bg-accent/10 text-accent", dot: "bg-accent" };
};

export function HunchCard({ hunch, featured = false }: HunchCardProps) {
  const { t } = useTranslation();

  const statusConfig = getStatusConfig(hunch.status, hunch.endsAt);

  const statusLabel = (() => {
    if (hunch.status === "closed") return t("status_closed");
    if (hunch.status === "resolved") return t("status_resolved");
    if (isPast(new Date(hunch.endsAt))) return t("status_ending");
    return t("status_open");
  })();

  const topOption = hunch.options.reduce((a, b) => a.percentage > b.percentage ? a : b, hunch.options[0]);

  return (
    <Link href={`/hunch/${hunch.id}`}>
      <div className={`group bg-card rounded-2xl border border-border overflow-hidden cursor-pointer hover-elevate card-shadow ${featured ? 'ring-2 ring-primary/20' : ''}`}>
        {/* Image area */}
        {hunch.imageUrl ? (
          <div className="relative w-full overflow-hidden bg-muted" style={{ height: featured ? '220px' : '160px' }}>
            <img
              src={hunch.imageUrl}
              alt={hunch.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            {/* Status badge on image */}
            <div className="absolute top-3 left-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-sm bg-white/90 text-foreground`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {statusLabel}
              </span>
            </div>
            {/* Prize badge on image */}
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm text-foreground">
                {getPrizeIcon(hunch.prize.type)}
                {hunch.prize.value} {hunch.prize.label}
              </span>
            </div>
          </div>
        ) : (
          /* No-image card — colored header strip */
          <div className="relative px-5 pt-5 pb-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusConfig.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {statusLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/8 text-primary border border-primary/15">
                {getPrizeIcon(hunch.prize.type)}
                {hunch.prize.value} {hunch.prize.label}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {hunch.imageUrl && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{hunch.categoryName}</span>
              {featured && <span className="flex items-center gap-1 text-xs font-semibold text-primary"><TrendingUp className="w-3 h-3" /> Featured</span>}
            </div>
          )}
          {!hunch.imageUrl && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{hunch.categoryName}</p>
          )}

          <h3 className={`font-display font-bold text-foreground leading-snug group-hover:text-primary transition-colors mb-4 ${featured ? 'text-xl' : 'text-base'} line-clamp-2`}>
            {hunch.title}
          </h3>

          {/* Options */}
          <div className="space-y-2.5 mb-4">
            {hunch.options.slice(0, 3).map((option) => {
              const isWinner = hunch.status === 'resolved' && hunch.winnerOption === option.label;
              const isLeading = option.id === topOption?.id && hunch.status !== 'resolved';
              return (
                <div key={option.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-medium truncate pr-3 ${isWinner ? 'text-primary' : 'text-foreground'}`}>{option.label}</span>
                    <span className={`text-sm font-semibold tabular-nums font-mono flex-shrink-0 ${isLeading ? 'text-primary' : 'text-muted-foreground'}`}>
                      {Math.round(option.percentage)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isWinner ? 'bg-primary' : isLeading ? 'bg-primary/50' : 'bg-border'}`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{t("predictions_count", { count: hunch.participantCount.toLocaleString() })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {hunch.status === 'open'
                  ? t("time_left", { time: formatDistanceToNow(new Date(hunch.endsAt)) })
                  : t("ended")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
