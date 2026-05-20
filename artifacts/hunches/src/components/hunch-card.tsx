import { Link } from "wouter";
import { formatDistanceToNow, isPast } from "date-fns";
import { Users, Clock, Trophy, Award, Gift, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import type { Hunch } from "@workspace/api-client-react";

interface HunchCardProps {
  hunch: Hunch;
  featured?: boolean;
}

const getPrizeIcon = (type: string) => {
  switch (type) {
    case "gift_card": return <Gift className="w-4 h-4" />;
    case "merch": return <Award className="w-4 h-4" />;
    case "cash_equivalent": return <DollarSign className="w-4 h-4" />;
    default: return <Trophy className="w-4 h-4" />;
  }
};

const getStatusColor = (status: string, endsAt: string) => {
  if (status === "closed") return "bg-muted text-muted-foreground";
  if (status === "resolved") return "bg-primary/20 text-primary border-primary/50";
  if (isPast(new Date(endsAt))) return "bg-orange-500/20 text-orange-400 border-orange-500/50";
  return "bg-accent/20 text-accent border-accent/50";
};

export function HunchCard({ hunch, featured = false }: HunchCardProps) {
  const { t } = useTranslation();

  const statusColor = getStatusColor(hunch.status, hunch.endsAt);

  const statusLabel = (() => {
    if (hunch.status === "closed") return t("status_closed");
    if (hunch.status === "resolved") return t("status_resolved");
    if (isPast(new Date(hunch.endsAt))) return t("status_ending");
    return t("status_open");
  })();

  return (
    <Link href={`/hunch/${hunch.id}`}>
      <Card className={`h-full flex flex-col hover-elevate transition-all duration-300 border-border/50 overflow-hidden cursor-pointer group ${featured ? 'border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.1)]' : ''}`}>
        {hunch.imageUrl && featured && (
          <div className="w-full h-48 relative overflow-hidden bg-muted">
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
            <img
              src={hunch.imageUrl}
              alt={hunch.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <CardHeader className={`${featured && hunch.imageUrl ? 'pt-2' : 'pt-6'} pb-4 space-y-4 relative z-20`}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`${statusColor} font-bold tracking-wider text-[10px]`}>
                {statusLabel}
              </Badge>
              <Badge variant="outline" className="bg-card text-muted-foreground border-border">
                {hunch.categoryName}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.1)]">
              {getPrizeIcon(hunch.prize.type)}
              <span>{hunch.prize.value} {hunch.prize.label}</span>
            </div>
          </div>

          <h3 className={`font-display font-bold text-foreground leading-tight ${featured ? 'text-2xl' : 'text-lg'} group-hover:text-primary transition-colors line-clamp-2`}>
            {hunch.title}
          </h3>
        </CardHeader>

        <CardContent className="flex-1 pb-4">
          <div className="space-y-4">
            {hunch.options.map((option) => (
              <div key={option.id} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium truncate pr-4">{option.label}</span>
                  <span className="text-muted-foreground font-mono tabular-nums">{Math.round(option.percentage)}%</span>
                </div>
                <Progress
                  value={option.percentage}
                  className="h-1.5 bg-muted"
                  indicatorClassName={
                    hunch.status === 'resolved' && hunch.winnerOption === option.label
                      ? "bg-primary"
                      : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors"
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="pt-4 border-t border-border/30 text-xs text-muted-foreground flex justify-between items-center bg-muted/10">
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
        </CardFooter>
      </Card>
    </Link>
  );
}
