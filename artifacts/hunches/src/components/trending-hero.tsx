import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { formatDistanceToNow, isPast, type Locale } from "date-fns";
import { enUS, es, de, fr, pt, it, ja, ko, zhCN, id, tr } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Users, Clock, Gift, Award,
  DollarSign, Trophy, Zap, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, LabelList,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { Hunch } from "@workspace/api-client-react";

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS, es, de, fr, pt, it, ja, ko, zh: zhCN, id, tr,
};

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  sports:        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1600&h=800&fit=crop&auto=format&q=80",
  music:         "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1600&h=800&fit=crop&auto=format&q=80",
  entertainment: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&h=800&fit=crop&auto=format&q=80",
  finance:       "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=800&fit=crop&auto=format&q=80",
  crypto:        "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1600&h=800&fit=crop&auto=format&q=80",
  politics:      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1600&h=800&fit=crop&auto=format&q=80",
};

const CHART_COLORS = [
  "#7c3aed", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe",
];

function getPrizeIcon(type: string) {
  switch (type) {
    case "gift_card":       return <Gift className="w-3.5 h-3.5" />;
    case "merch":           return <Award className="w-3.5 h-3.5" />;
    case "cash_equivalent": return <DollarSign className="w-3.5 h-3.5" />;
    default:                return <Trophy className="w-3.5 h-3.5" />;
  }
}

function DistributionChart({ options, participantCount }: { options: Hunch["options"]; participantCount: number }) {
  if (!options || options.length === 0) return null;

  const total = participantCount || 1;
  const isNumeric = options.every((o) => !isNaN(parseFloat(o.label)));

  const withCounts = options.map((o) => ({
    ...o,
    count: Math.max(0, Math.round((o.percentage / 100) * total)),
  }));

  let chartData: { label: string; fullLabel: string; count: number }[];

  if (isNumeric) {
    const parsed = withCounts
      .map((o) => ({ val: parseFloat(o.label), count: o.count }))
      .filter((o) => !isNaN(o.val));

    if (parsed.length === 0) return null;

    const vals = parsed.map((o) => o.val);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const numBins = min === max ? 1 : Math.min(10, Math.max(4, Math.ceil(Math.sqrt(total))));
    const binWidth = min === max ? 1 : (max - min) / numBins;

    chartData = Array.from({ length: numBins }, (_, i) => {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const isLast = i === numBins - 1;
      const count = parsed
        .filter((o) => isLast ? o.val >= lo && o.val <= hi : o.val >= lo && o.val < hi)
        .reduce((s, o) => s + o.count, 0);
      const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
      return { label: fmt(lo), fullLabel: numBins === 1 ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`, count };
    });
  } else {
    chartData = withCounts
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((o) => ({
        label: o.label.length > 12 ? o.label.slice(0, 11) + "…" : o.label,
        fullLabel: o.label,
        count: o.count,
      }));
  }

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 4, left: -28, bottom: 4 }}
        barCategoryGap={isNumeric ? "0%" : "10%"}
      >
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tick={isNumeric
            ? { fontSize: 10, fill: "rgba(255,255,255,0.55)", fontWeight: 500 }
            : false}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickLine={false}
          axisLine={false}
          domain={[0, Math.ceil(maxCount * 1.2)]}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload as { fullLabel: string; count: number };
            return (
              <div className="bg-black/80 border border-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-sm shadow-xl">
                <p className="font-semibold text-white max-w-[180px]">{d.fullLabel}</p>
                <p className="text-violet-300 font-bold mt-0.5">{d.count} prediction{d.count !== 1 ? "s" : ""}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={isNumeric ? [2, 2, 0, 0] : [4, 4, 0, 0]} maxBarSize={isNumeric ? undefined : 40}>
          <LabelList
            dataKey="count"
            position="top"
            style={{ fontSize: 10, fontWeight: 600, fill: "rgba(255,255,255,0.55)" }}
          />
          {chartData.map((d, i) => {
            const ratio = maxCount > 0 ? d.count / maxCount : 0;
            const opacity = 0.25 + ratio * 0.75;
            return <Cell key={i} fill={`rgba(167,139,250,${opacity.toFixed(2)})`} stroke="none" />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TrendingHeroProps {
  hunches: Hunch[];
}

export function TrendingHero({ hunches }: TrendingHeroProps) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = DATE_FNS_LOCALES[i18n.language] ?? enUS;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = hunches.length;

  const goTo = useCallback(
    (idx: number, dir: "left" | "right" = "right") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrent((idx + total) % total);
        setAnimating(false);
      }, 320);
    },
    [animating, total],
  );

  const next = useCallback(() => goTo(current + 1, "right"), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1, "left"), [goTo, current]);

  useEffect(() => {
    if (total <= 1 || paused) return;
    intervalRef.current = setInterval(next, 6000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [next, paused, total]);

  if (total === 0) return null;

  const hunch = hunches[(current + total) % total];
  const imgSrc = hunch.imageUrl || CATEGORY_PLACEHOLDER[hunch.categorySlug?.toLowerCase() ?? "sports"] || CATEGORY_PLACEHOLDER.sports;
  const isExpired = isPast(new Date(hunch.endsAt));
  const effectiveStatus = hunch.status === "open" && isExpired ? "closed" : hunch.status;
  const isOpen = effectiveStatus === "open";
  const hasOptions = hunch.options.filter((o) => o.percentage > 0).length > 0;

  const timeLeft = isOpen
    ? formatDistanceToNow(new Date(hunch.endsAt), { locale: dateFnsLocale })
    : null;

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: "clamp(420px, 55vh, 600px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image */}
      <div
        key={`bg-${hunch.id}`}
        className={`absolute inset-0 transition-opacity duration-500 ${animating ? "opacity-0" : "opacity-100"}`}
      >
        <img
          src={imgSrc}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Gradient overlay — heavy left/bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div
        className={`absolute inset-0 flex items-end transition-all duration-320 ${animating ? (direction === "right" ? "translate-x-4 opacity-0" : "-translate-x-4 opacity-0") : "translate-x-0 opacity-100"}`}
      >
        <div className="container mx-auto px-6 pb-10 pt-8 flex flex-col md:flex-row gap-8 items-end justify-between w-full">

          {/* Left — hunch info */}
          <div className="flex-1 min-w-0 max-w-xl">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {hunch.categoryName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-wider">
                  <Zap className="w-3 h-3" />
                  {hunch.categoryName}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm ${
                  isOpen
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/30"
                    : effectiveStatus === "resolved"
                    ? "bg-primary/25 text-primary/90 border border-primary/30"
                    : "bg-white/15 text-white/70 border border-white/20"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400 animate-pulse" : "bg-white/50"}`} />
                {isOpen ? "Open" : effectiveStatus === "resolved" ? "Resolved" : "Closed"}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display font-bold text-white leading-tight mb-3 line-clamp-3"
              style={{ fontSize: "clamp(1.4rem, 3vw, 2.15rem)" }}>
              {hunch.title}
            </h1>

            {/* Description */}
            <p className="text-white/70 text-sm leading-relaxed mb-5 line-clamp-2 max-w-lg hidden sm:block">
              {hunch.description}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-white/80 text-xs font-medium">
                {getPrizeIcon(hunch.prize.type)}
                <span className="font-bold text-white">{hunch.prize.value}</span>
                <span className="text-white/60">{hunch.prize.label}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-white/70 text-xs">
                <Users className="w-3.5 h-3.5" />
                {hunch.participantCount.toLocaleString()} predictions
              </span>
              {timeLeft && (
                <span className="inline-flex items-center gap-1.5 text-white/70 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {timeLeft} left
                </span>
              )}
            </div>

            {/* CTA */}
            <Link href={`/hunch/${hunch.slug || hunch.id}`}>
              <button className="inline-flex items-center gap-2 bg-white text-foreground font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl active:scale-95">
                {isOpen ? "Make your prediction" : "See results"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Right — distribution chart */}
          {hasOptions && (
            <div className="hidden md:flex flex-col justify-end w-80 shrink-0">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-2">Predictions distribution</p>
              <p className="text-white/30 text-[10px] mb-1">{hunch.participantCount.toLocaleString()} prediction{hunch.participantCount !== 1 ? "s" : ""} so far</p>
              <DistributionChart options={hunch.options} participantCount={hunch.participantCount} />
            </div>
          )}
        </div>
      </div>

      {/* Carousel controls */}
      {total > 1 && (
        <>
          {/* Prev / Next arrows */}
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators + progress bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {hunches.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > current ? "right" : "left")}
                className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
                style={{ width: i === current ? 28 : 8, backgroundColor: i === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}
                aria-label={`Go to slide ${i + 1}`}
              >
                {i === current && !paused && (
                  <span
                    className="absolute left-0 top-0 h-full bg-primary/80 rounded-full"
                    style={{
                      animation: "hero-progress 6s linear forwards",
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Number indicator */}
          <div className="absolute top-4 right-4 text-white/50 text-xs font-medium backdrop-blur-sm">
            {current + 1} / {total}
          </div>
        </>
      )}

      {/* Progress animation keyframe */}
      <style>{`
        @keyframes hero-progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </section>
  );
}
