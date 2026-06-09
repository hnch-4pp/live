import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { formatDistanceToNow, isPast, type Locale } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Users, Clock, Gift, Award,
  DollarSign, Trophy, Zap, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell, LabelList,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { Hunch } from "@workspace/api-client-react";

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
  es,
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

// Gaussian KDE with Silverman's bandwidth rule
function computeKDE(
  values: number[],
  weights: number[],
  numPoints = 100,
): { x: number; y: number }[] {
  const totalW = weights.reduce((s, w) => s + w, 0);
  if (totalW === 0 || values.length === 0) return [];

  const mean = values.reduce((s, v, i) => s + v * (weights[i] ?? 0), 0) / totalW;
  const variance =
    values.reduce((s, v, i) => s + (weights[i] ?? 0) * (v - mean) ** 2, 0) / totalW;
  const std = Math.sqrt(variance);
  const h = std > 0 ? 1.06 * std * Math.pow(totalW, -0.2) : 1;

  const lo = Math.min(...values) - h * 3;
  const hi = Math.max(...values) + h * 3;
  const step = (hi - lo) / (numPoints - 1);

  const INV_SQRT_2PI = 0.3989422804014327;

  return Array.from({ length: numPoints }, (_, i) => {
    const x = lo + i * step;
    let density = 0;
    for (let j = 0; j < values.length; j++) {
      const u = (x - (values[j] ?? 0)) / h;
      density += (weights[j] ?? 0) * INV_SQRT_2PI * Math.exp(-0.5 * u * u);
    }
    density /= totalW * h;
    return { x, y: density };
  });
}

function DistributionChart({
  options,
  participantCount,
}: {
  options: Hunch["options"];
  participantCount: number;
}) {
  if (!options || options.length === 0) return null;

  const total = Math.max(participantCount, 1);

  // Consider numeric any option whose label parses cleanly to a finite number
  const numericOptions = options.filter((o) => {
    const v = parseFloat(o.label);
    return isFinite(v) && String(v) !== "NaN";
  });
  const isNumeric = numericOptions.length >= 2;

  const fmtX = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // ── Numeric path: KDE area chart ─────────────────────────────────────────
  if (isNumeric) {
    const vals = numericOptions.map((o) => parseFloat(o.label));
    const weights = numericOptions.map((o) =>
      Math.max(1, Math.round((o.percentage / 100) * total)),
    );

    const kdePoints = computeKDE(vals, weights);
    if (kdePoints.length === 0) return null;

    const maxDensity = Math.max(...kdePoints.map((p) => p.y), 1e-12);
    const chartData = kdePoints.map((p) => ({
      x: parseFloat(p.x.toFixed(3)),
      y: parseFloat((p.y / maxDensity).toFixed(4)),
    }));

    const xMin = Math.min(...vals);
    const xMax = Math.max(...vals);
    const xMid = (xMin + xMax) / 2;

    const nearestLabel = (target: number) =>
      fmtX(vals.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a)));

    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 6, left: -44, bottom: 0 }}
        >
          <defs>
            <linearGradient id="kdeGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#a3e635" stopOpacity={0.55} />
              <stop offset="60%"  stopColor="#4d7c0f" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#a3e635" stopOpacity={0.00} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={[xMin, xMid, xMax]}
            tickFormatter={nearestLabel}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.85)", fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          />
          <YAxis hide domain={[0, 1.15]} />
          <Tooltip
            cursor={{
              stroke: "rgba(163,230,53,0.4)",
              strokeWidth: 1,
              strokeDasharray: "4 3",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { x: number; y: number };
              const nearest = vals.reduce((a, b) =>
                Math.abs(b - d.x) < Math.abs(a - d.x) ? b : a,
              );
              const opt = options.find((o) => parseFloat(o.label) === nearest);
              return (
                <div className="bg-black/85 border border-lime-400/30 backdrop-blur-sm rounded-xl px-3 py-2 text-sm shadow-xl">
                  <p className="font-bold text-lime-400">{fmtX(d.x)}</p>
                  {opt && (
                    <p className="text-white/60 text-xs mt-0.5">
                      {opt.percentage}% of predictions
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="#a3e635"
            strokeWidth={2.5}
            fill="url(#kdeGreen)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#a3e635",
              stroke: "rgba(0,0,0,0.6)",
              strokeWidth: 2,
            }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── 2-option "head-to-head" display ──────────────────────────────────────
  if (options.length === 2) {
    const [a, b] = options as [typeof options[0], typeof options[0]];
    const pctA = a.percentage;
    const pctB = b.percentage;
    const leading = pctA >= pctB ? "a" : "b";

    const truncate = (s: string, max: number) =>
      s.length > max ? s.slice(0, max - 1) + "…" : s;

    return (
      <div className="w-full select-none">
        {/* Percentage row */}
        <div className="flex items-end justify-between mb-3">
          {/* Option A */}
          <div className="flex flex-col items-start gap-0.5">
            <span
              className="font-black leading-none tabular-nums"
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                color: leading === "a" ? "#a3e635" : "rgba(255,255,255,0.55)",
              }}
            >
              {pctA}%
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide max-w-[140px] leading-tight"
              style={{ color: leading === "a" ? "rgba(163,230,53,0.85)" : "rgba(255,255,255,0.45)" }}
            >
              {truncate(a.label, 22)}
            </span>
          </div>

          {/* VS badge */}
          <div className="flex flex-col items-center px-2 pb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">vs</span>
          </div>

          {/* Option B */}
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="font-black leading-none tabular-nums"
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                color: leading === "b" ? "#a3e635" : "rgba(255,255,255,0.55)",
              }}
            >
              {pctB}%
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide max-w-[140px] leading-tight text-right"
              style={{ color: leading === "b" ? "rgba(163,230,53,0.85)" : "rgba(255,255,255,0.45)" }}
            >
              {truncate(b.label, 22)}
            </span>
          </div>
        </div>

        {/* Split bar */}
        <div className="relative h-2 rounded-full overflow-hidden bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${pctA}%`,
              background: leading === "a"
                ? "linear-gradient(90deg, #a3e635 0%, #65a30d 100%)"
                : "rgba(255,255,255,0.35)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-full transition-all duration-700"
            style={{
              width: `${pctB}%`,
              background: leading === "b"
                ? "linear-gradient(270deg, #a3e635 0%, #65a30d 100%)"
                : "rgba(255,255,255,0.35)",
            }}
          />
        </div>

        {/* Participant count */}
        <p className="text-white/40 text-[10px] mt-2 text-center tabular-nums">
          {participantCount.toLocaleString()} {participantCount === 1 ? "predicción" : "predicciones"}
        </p>
      </div>
    );
  }

  // ── Categorical fallback: green bars ─────────────────────────────────────
  const chartData = options
    .slice()
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6)
    .map((o) => ({
      label: o.label.length > 13 ? o.label.slice(0, 12) + "…" : o.label,
      fullLabel: o.label,
      count: Math.max(0, Math.round((o.percentage / 100) * total)),
      pct: o.percentage,
    }));

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 6, left: -36, bottom: 4 }}
        barCategoryGap="14%"
      >
        <defs>
          <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a3e635" stopOpacity={1}   />
            <stop offset="100%" stopColor="#4d7c0f" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray="0"
        />
        <XAxis
          dataKey="label"
          tick={false}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload as {
              fullLabel: string;
              count: number;
              pct: number;
            };
            return (
              <div className="bg-black/85 border border-lime-400/30 backdrop-blur-sm rounded-xl px-3 py-2 text-sm shadow-xl">
                <p className="font-semibold text-white max-w-[200px]">
                  {d.fullLabel}
                </p>
                <p className="text-lime-400 font-bold mt-0.5">
                  {d.pct}% — {d.count.toLocaleString()} predictions
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={60}>
          <LabelList
            dataKey="pct"
            position="top"
            formatter={(v: number) => `${v}%`}
            style={{ fontSize: 11, fontWeight: 700, fill: "rgba(163,230,53,0.8)" }}
          />
          {chartData.map((d, i) => {
            const ratio = maxCount > 0 ? d.count / maxCount : 0;
            const opacity = 0.3 + ratio * 0.7;
            return (
              <Cell
                key={i}
                fill={`rgba(163,230,53,${opacity.toFixed(2)})`}
                stroke="none"
              />
            );
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
  const firstQuestion = (hunch as any)?.questions?.[0] as { prompt: string; options: Array<{ id: number; label: string; percentage: number }> } | undefined;
  const displayOptions: Array<{ id: number; label: string; percentage: number }> =
    hunch.isMulti && hunch.options.length === 0 && firstQuestion?.options?.length
      ? firstQuestion.options
      : hunch.options;
  const hasOptions = displayOptions.filter((o) => o.percentage > 0).length > 0;

  const timeLeft = isOpen
    ? formatDistanceToNow(new Date(hunch.endsAt), { locale: dateFnsLocale })
    : null;

  return (
    <section
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image — absolute so it stretches to match section height */}
      <div
        key={`bg-${hunch.id}`}
        className={`absolute inset-0 transition-opacity duration-500 ${animating ? "opacity-0" : "opacity-100"}`}
      >
        <img
          src={imgSrc}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: hunch.imageFocalPoint ?? "center" }}
          loading="eager"
        />
        {/* Gradient overlay — heavy left/bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      {/* Content — in normal flow so section grows to fit all text */}
      <div
        className={`relative z-10 flex items-end transition-all duration-320 ${animating ? (direction === "right" ? "translate-x-4 opacity-0" : "-translate-x-4 opacity-0") : "translate-x-0 opacity-100"}`}
        style={{ minHeight: "clamp(350px, 43vh, 490px)" }}
      >
        <div className="container mx-auto px-6 pb-12 pt-20 flex flex-col md:flex-row gap-8 items-end justify-between w-full">

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
                {isOpen ? t("status_open_label") : effectiveStatus === "resolved" ? t("status_resolved_label") : t("status_closed_label")}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display font-bold text-white leading-tight mb-3 line-clamp-3"
              style={{ fontSize: "clamp(1.4rem, 3vw, 2.15rem)" }}>
              {hunch.title}
            </h1>

            {/* Description */}
            <div className="mb-5 max-w-lg hidden sm:block">
              <p className="text-white/70 text-sm leading-relaxed line-clamp-2">
                {hunch.description}
              </p>
              <Link
                href={`/hunch/${hunch.slug || hunch.id}`}
                className="inline-block mt-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                {t("view_more")}
              </Link>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-white/80 text-xs font-medium">
                {getPrizeIcon(hunch.prize.type)}
                <span className="font-bold text-white">{hunch.prize.value}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-white/70 text-xs">
                <Users className="w-3.5 h-3.5" />
                {t("predictions_count", { count: hunch.participantCount.toLocaleString() })}
              </span>
              {timeLeft && (
                <span className="inline-flex items-center gap-1.5 text-white/70 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {timeLeft} {t("time_left_suffix")}
                </span>
              )}
            </div>

            {/* CTA */}
            <Link href={`/hunch/${hunch.slug || hunch.id}`}>
              <button className="inline-flex items-center gap-2 bg-white text-foreground font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl active:scale-95">
                {isOpen ? t("make_prediction_cta") : t("see_results")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Right — distribution chart */}
          {hasOptions && (
            <div className="hidden md:flex flex-col justify-end w-[420px] shrink-0">
              <p className="text-white/90 text-[11px] font-semibold uppercase tracking-wider mb-1">
                {hunch.isMulti && firstQuestion ? firstQuestion.prompt : t("predictions_dist")}
              </p>
              <p className="text-white/65 text-[10px] mb-2">
                {hunch.participantCount !== 1
                  ? t("predictions_so_far_plural", { count: hunch.participantCount.toLocaleString() })
                  : t("predictions_so_far", { count: hunch.participantCount.toLocaleString() })}
              </p>
              <DistributionChart options={displayOptions} participantCount={hunch.participantCount} />
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
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators + progress bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
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
