import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, formatDistanceToNow, isPast, type Locale } from "date-fns";
import {
  enUS, es, de, fr, pt, it, ja, ko, zhCN, id as idLocale, tr,
} from "date-fns/locale";
import { ArrowLeft, Users, Clock, Share2, AlertCircle, Trophy, CheckCircle2, Gift, Award, DollarSign, ChevronDown, ChevronUp, Check, Ticket, X, Info, Hash, Percent, Sigma, Calendar, Clock as ClockIcon, Layers, Link as LinkIcon, Image, Video, ExternalLink, Activity, UserCircle2, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";
import { HunchComments } from "@/components/hunch-comments";
import { useGetHunch, useSubmitPrediction, getGetHunchQueryKey, useGetHunchWinners, getGetHunchWinnersQueryKey } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

function fmtNumericLabel(label: string): string {
  const stripped = label.replace(/,/g, "");
  const n = parseFloat(stripped);
  if (!isFinite(n) || stripped.trim() === "") return label;
  const parts = stripped.split(".");
  const intPart = Math.trunc(Number(parts[0])).toLocaleString("en-US");
  return parts.length > 1 ? intPart + "." + parts[1] : intPart;
}

function fmtNumericInput(raw: string): string {
  if (raw === "" || raw === "-") return raw;
  const stripped = raw.replace(/,/g, "");
  const parts = stripped.split(".");
  const intStr = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? intStr + "." + parts[1] : intStr;
}

function isNumericType(t: string | undefined): boolean {
  return t === "integer" || t === "decimal" || t === "number";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS, es, de, fr, pt, it, ja, ko, zh: zhCN, id: idLocale, tr,
};

const getPrizeIcon = (type: string) => {
  switch (type) {
    case "gift_card": return <Gift className="w-4 h-4" />;
    case "merch": return <Award className="w-4 h-4" />;
    case "cash_equivalent": return <DollarSign className="w-4 h-4" />;
    default: return <Trophy className="w-4 h-4" />;
  }
};

const getAnswerTypeIcon = (answerType: string) => {
  switch (answerType) {
    case "integer": return <Hash className="w-3 h-3" />;
    case "decimal": return <Percent className="w-3 h-3" />;
    case "number":  return <Sigma className="w-3 h-3" />;
    case "date": return <Calendar className="w-3 h-3" />;
    case "time": return <ClockIcon className="w-3 h-3" />;
    default: return <Hash className="w-3 h-3" />;
  }
};

const getAnswerTypePlaceholder = (answerType: string, placeholder?: string | null) => {
  if (placeholder) return placeholder;
  switch (answerType) {
    case "integer": return "Enter a whole number (e.g. 3)";
    case "decimal": return "Enter a number (e.g. 1.5)";
    case "number":  return "Ej. 2.346";
    case "date": return "Enter a date (e.g. 15/08/2025)";
    case "time": return "Enter a time (e.g. 01:23:45)";
    default: return "Your answer...";
  }
};

// ── Smart prediction inputs ───────────────────────────────────────────────────

function SegmentBox({
  value, onChange, placeholder, maxLen, widthCls, onFull, segRef, onBackspace,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  maxLen: number; widthCls: string; onFull?: () => void;
  segRef?: React.RefObject<HTMLInputElement | null>; onBackspace?: () => void;
}) {
  return (
    <input
      ref={segRef}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, maxLen);
        onChange(v);
        if (v.length === maxLen) onFull?.();
      }}
      onKeyDown={(e) => { if (e.key === "Backspace" && value === "") onBackspace?.(); }}
      placeholder={placeholder}
      maxLength={maxLen}
      className={`${widthCls} text-center bg-transparent border-none outline-none text-sm font-medium focus:outline-none`}
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parseDate = (v: string) => {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    return m ? [m[1] ?? "", m[2] ?? "", m[3] ?? ""] : ["", "", ""];
  };
  const init = parseDate(value);
  const [day, setDay] = useState(init[0]);
  const [mon, setMon] = useState(init[1]);
  const [yr, setYr]   = useState(init[2]);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const monRef = useRef<HTMLInputElement | null>(null);
  const yrRef  = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (!value) { setDay(""); setMon(""); setYr(""); } }, [value]);
  const emit = (d: string, m: string, y: string) => onChange(d || m || y ? `${d}/${m}/${y}` : "");
  return (
    <div className="flex items-center gap-0.5 w-full rounded-xl border border-border bg-white px-4 py-3 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
      <SegmentBox segRef={dayRef} value={day} onChange={(v) => { setDay(v); emit(v, mon, yr); }} placeholder="dd" maxLen={2} widthCls="w-8" onFull={() => monRef.current?.focus()} />
      <span className="text-muted-foreground text-sm select-none">/</span>
      <SegmentBox segRef={monRef} value={mon} onChange={(v) => { setMon(v); emit(day, v, yr); }} placeholder="mm" maxLen={2} widthCls="w-8" onFull={() => yrRef.current?.focus()} onBackspace={() => dayRef.current?.focus()} />
      <span className="text-muted-foreground text-sm select-none">/</span>
      <SegmentBox segRef={yrRef} value={yr} onChange={(v) => { setYr(v); emit(day, mon, v); }} placeholder="aaaa" maxLen={4} widthCls="w-14" onBackspace={() => monRef.current?.focus()} />
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parseTime = (v: string) => {
    const m = v.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    return m ? [m[1] ?? "", m[2] ?? "", m[3] ?? ""] : ["", "", ""];
  };
  const init = parseTime(value);
  const [hrs, setHrs]   = useState(init[0]);
  const [mins, setMins] = useState(init[1]);
  const [secs, setSecs] = useState(init[2]);
  const hrRef  = useRef<HTMLInputElement | null>(null);
  const minRef = useRef<HTMLInputElement | null>(null);
  const secRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (!value) { setHrs(""); setMins(""); setSecs(""); } }, [value]);
  const emit = (h: string, m: string, s: string) => onChange(h || m || s ? `${h}:${m}:${s}` : "");
  return (
    <div className="flex items-center gap-0.5 w-full rounded-xl border border-border bg-white px-4 py-3 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
      <SegmentBox segRef={hrRef}  value={hrs}  onChange={(v) => { setHrs(v);  emit(v, mins, secs); }} placeholder="hh" maxLen={2} widthCls="w-8" onFull={() => minRef.current?.focus()} />
      <span className="text-muted-foreground text-sm select-none">:</span>
      <SegmentBox segRef={minRef} value={mins} onChange={(v) => { setMins(v); emit(hrs, v, secs); }} placeholder="mm" maxLen={2} widthCls="w-8" onFull={() => secRef.current?.focus()} onBackspace={() => hrRef.current?.focus()} />
      <span className="text-muted-foreground text-sm select-none">:</span>
      <SegmentBox segRef={secRef} value={secs} onChange={(v) => { setSecs(v); emit(hrs, mins, v); }} placeholder="ss" maxLen={2} widthCls="w-8" onBackspace={() => minRef.current?.focus()} />
    </div>
  );
}

function AnswerInput({
  answerType, value, onChange, onEnter, compact = false, options,
}: {
  answerType: string; value: string; onChange: (v: string) => void;
  onEnter?: () => void; compact?: boolean;
  options?: Array<{ id: number; label: string; percentage: number }>;
}) {
  const baseCls = `w-full rounded-xl border border-border bg-white px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all ${compact ? "py-2.5" : "py-3"}`;
  if (answerType === "option" && options && options.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-2">
        {options.map((opt) => {
          const selected = value === opt.label;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(selected ? "" : opt.label)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                selected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-white text-foreground hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (answerType === "date") return <DateInput value={value} onChange={onChange} />;
  if (answerType === "time") return <TimeInput value={value} onChange={onChange} />;
  if (answerType === "decimal") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
          onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
          placeholder="Ej. 3.14"
          maxLength={20}
          className={baseCls}
        />
        <span className="text-base font-semibold text-muted-foreground shrink-0">%</span>
      </div>
    );
  }
  if (answerType === "number") {
    return (
      <input
        type="text" inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
        placeholder="Ej. 2.346"
        maxLength={20}
        className={baseCls}
      />
    );
  }
  return (
    <input
      type="text" inputMode="numeric"
      value={fmtNumericInput(value)}
      onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))}
      onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
      placeholder="Ej. 42"
      maxLength={20}
      className={baseCls}
    />
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────

interface ActivityParticipant {
  userId: number | null;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

function ActivityAvatar({ username, avatarUrl }: { username: string | null; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false);
  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={username ?? ""}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-primary">{initials}</span>
    </div>
  );
}

const ACTIVITY_PREVIEW = 7;

function ActivityFeed({ hunchId, dateFnsLocale }: { hunchId: number | string; dateFnsLocale: Locale }) {
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/hunches/${hunchId}/activity`)
      .then((r) => r.json() as Promise<{ participants: ActivityParticipant[]; total: number }>)
      .then((d) => { setParticipants(d.participants ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hunchId]);

  useEffect(() => { load(); }, [load]);

  const initials = (name: string | null) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const visible = expanded ? participants : participants.slice(0, ACTIVITY_PREVIEW);
  const hasMore = participants.length > ACTIVITY_PREVIEW;

  return (
    <div id="activity-feed" className="bg-card border border-border rounded-2xl overflow-hidden card-shadow">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Actividad</h3>
        {total > 0 && (
          <span className="ml-auto text-xs text-muted-foreground font-medium">{total} participante{total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded animate-pulse w-24" />
                <div className="h-2.5 bg-muted rounded animate-pulse w-16" />
              </div>
            </div>
          ))
        ) : participants.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <UserCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Aún no hay participantes</p>
          </div>
        ) : (
          visible.map((p, idx) => {
            const inner = (
              <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                <ActivityAvatar username={p.username} avatarUrl={p.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${p.username ? "text-primary" : "text-foreground"}`}>
                    {p.username ? `@${p.username}` : `Usuario ${p.userId}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(p.joinedAt), { addSuffix: true, locale: dateFnsLocale })}
                  </p>
                </div>
                {p.username && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
              </div>
            );
            return p.username ? (
              <Link key={idx} href={`/u/${p.username}`}>{inner}</Link>
            ) : (
              <div key={idx}>{inner}</div>
            );
          })
        )}
      </div>

      {/* Expand / collapse */}
      {!loading && hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 px-5 py-3 border-t border-border text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Ver todos ({total} participantes)</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Single-question distribution chart ───────────────────────────────────────

function DistributionChart({
  options,
  participantCount,
  answerType,
  title,
  compact = false,
}: {
  options: Array<{ id: number; label: string; percentage: number }>;
  participantCount: number;
  answerType: string;
  title?: string;
  compact?: boolean;
}) {
  if (options.length === 0) return null;

  const total = participantCount || 1;
  const isNumeric = answerType === "integer" || answerType === "decimal";

  const withCounts = options.map((o) => ({
    ...o,
    count: Math.max(1, Math.round((o.percentage / 100) * total)),
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

    const bins = Array.from({ length: numBins }, (_, i) => {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const isLast = i === numBins - 1;
      const count = parsed
        .filter((o) => isLast ? o.val >= lo && o.val <= hi : o.val >= lo && o.val < hi)
        .reduce((s, o) => s + o.count, 0);
      const fmt = (n: number) => Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return { label: fmt(lo), fullLabel: numBins === 1 ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`, count };
    });

    chartData = bins;
  } else {
    // Try to parse labels as a numeric value so we can sort ascending.
    // Supports plain numbers ("30", "1.5"), MM:SS ("13:30"), and HH:MM:SS ("00:09:56").
    const parseLabel = (s: string): number | null => {
      const plain = parseFloat(s);
      if (!isNaN(plain) && String(plain) === s.trim()) return plain;
      // HH:MM:SS — must check before MM:SS
      const hmsMatch = s.trim().match(/^(\d+):(\d{2}):(\d{2})$/);
      if (hmsMatch) return parseInt(hmsMatch[1]!, 10) * 3600 + parseInt(hmsMatch[2]!, 10) * 60 + parseInt(hmsMatch[3]!, 10);
      const timeMatch = s.trim().match(/^(\d+):(\d{2})$/);
      if (timeMatch) return parseInt(timeMatch[1]!, 10) * 60 + parseInt(timeMatch[2]!, 10);
      const numOnly = parseFloat(s);
      if (!isNaN(numOnly)) return numOnly;
      return null;
    };

    const numericValues = withCounts.map((o) => parseLabel(o.label));
    const allNumericParseable = numericValues.every((v) => v !== null);

    const sorted = withCounts.slice();
    if (allNumericParseable) {
      sorted.sort((a, b) => (parseLabel(a.label) ?? 0) - (parseLabel(b.label) ?? 0));
    } else {
      sorted.sort((a, b) => b.count - a.count);
    }

    chartData = sorted
      .slice(0, 12)
      .map((o) => ({
        label: o.label.length > 12 ? o.label.slice(0, 11) + "…" : o.label,
        fullLabel: o.label,
        count: o.count,
      }));
  }

  const maxCount = Math.max(...chartData.map((d) => d.count));
  const chartHeight = compact ? 160 : 240;

  return (
    <div className={compact ? "" : "bg-card border border-border rounded-2xl p-6 card-shadow"}>
      {title && (
        <h3 className="text-base font-display font-bold text-foreground mb-1">{title}</h3>
      )}
      {!compact && (
        <p className="text-xs text-muted-foreground mb-5">
          {total.toLocaleString()} prediction{total !== 1 ? "s" : ""} so far
        </p>
      )}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          margin={{ top: 18, right: 8, left: -12, bottom: isNumeric ? 8 : 40 }}
          barCategoryGap={isNumeric ? "0%" : "12%"}
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            tickLine={isNumeric}
            axisLine={isNumeric}
            angle={isNumeric ? 0 : -38}
            textAnchor={isNumeric ? "middle" : "end"}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.ceil(maxCount * 1.18)]}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { fullLabel: string; count: number };
              return (
                <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
                  <p className="font-semibold text-foreground max-w-[220px]">{d.fullLabel}</p>
                  <p className="text-primary font-bold mt-0.5">{d.count} prediction{d.count !== 1 ? "s" : ""}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={isNumeric ? [2, 2, 0, 0] : [4, 4, 0, 0]} maxBarSize={isNumeric ? undefined : 48}>
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 11, fontWeight: 500, fill: "hsl(var(--primary) / 0.4)" }}
            />
            {chartData.map((d, i) => {
              const ratio = maxCount > 0 ? d.count / maxCount : 0;
              const opacity = 0.18 + ratio * 0.77;
              return (
                <Cell key={i} fill={`hsl(var(--primary) / ${opacity.toFixed(2)})`} stroke="none" />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HunchDetail() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = DATE_FNS_LOCALES[i18n.language] ?? enUS;
  const lang = i18n.language !== "en" ? i18n.language : undefined;
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, refetch: refetchUser } = useAuth();

  // Single-question state
  const [freeText, setFreeText] = useState("");

  // Multi-question state: Record<questionId, freeText>
  const [multiAnswers, setMultiAnswers] = useState<Record<number, string>>({});

  const [submitted, setSubmitted] = useState(false);
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleShare = async () => {
    const ogUrl = `${window.location.origin}/api/og/hunch/${slug}`;
    const title = hunch?.title ?? "Hunch";
    if (navigator.share) {
      try { await navigator.share({ title, url: ogUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(ogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { data: hunch, isLoading, error } = useGetHunch(slug ?? "", { lang }, {
    query: { queryKey: getGetHunchQueryKey(slug ?? "", { lang }), enabled: !!slug }
  });

  const { data: winnersData } = useGetHunchWinners(slug ?? "", {
    query: { queryKey: getGetHunchWinnersQueryKey(slug ?? ""), enabled: !!slug && hunch?.status === "resolved" },
  });

  const submitPrediction = useSubmitPrediction({ request: { credentials: "include" } });

  const isMulti = (hunch as any)?.isMulti === true;
  const questions: Array<{
    id: number; sortOrder: number; prompt: string; answerType: string; placeholder?: string | null;
    options: Array<{ id: number; label: string; percentage: number }>;
  }> = (hunch as any)?.questions ?? [];

  const allAnswered = isMulti
    ? questions.every((q) => (multiAnswers[q.id] ?? "").trim().length > 0)
    : freeText.trim().length > 0;

  const handlePredict = () => {
    if (!allAnswered) return;
    if (!user) { setLocation("/login"); return; }
    setShowConfirm(true);
  };

  const confirmPredict = () => {
    setShowConfirm(false);

    if (isMulti) {
      const answers = questions.map((q) => ({ questionId: q.id, freeText: (multiAnswers[q.id] ?? "").trim() }));
      submitPrediction.mutate({ id: hunch?.id ?? 0, data: { answers } as any }, {
        onSuccess: () => {
          setSubmitted(true);
          refetchUser();
          toast({ title: t("prediction_ok_title"), description: t("prediction_ok_desc") });
          queryClient.invalidateQueries({ queryKey: getGetHunchQueryKey(slug ?? "") });
        },
        onError: (err: any) => {
          toast({ title: t("error"), description: err?.error || t("failed_submit"), variant: "destructive" });
        }
      });
    } else {
      const trimmed = freeText.trim();
      submitPrediction.mutate({ id: hunch?.id ?? 0, data: { freeText: trimmed } }, {
        onSuccess: () => {
          setSubmitted(true);
          refetchUser();
          toast({ title: t("prediction_ok_title"), description: t("prediction_ok_desc") });
          queryClient.invalidateQueries({ queryKey: getGetHunchQueryKey(slug ?? "") });
        },
        onError: (err: any) => {
          toast({ title: t("error"), description: err?.error || t("failed_submit"), variant: "destructive" });
        }
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <Skeleton className="w-32 h-5 mb-8 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="h-12 w-4/5 rounded-xl" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !hunch) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{t("hunch_not_found")}</h1>
          <p className="text-muted-foreground mb-6 text-sm">{t("hunch_not_found_desc")}</p>
          <Link href="/"><Button className="rounded-xl">{t("back_to_home")}</Button></Link>
        </div>
      </Layout>
    );
  }

  const isOpen = hunch.status === 'open' && !isPast(new Date(hunch.endsAt));
  const isResolved = hunch.status === 'resolved';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
          {t("back_to_all")}
        </Link>

        {/* Header row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-7">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                hunch.status === 'open' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hunch.status === 'open' ? 'bg-accent' : 'bg-muted-foreground'}`} />
                {t(`status_${hunch.status}`)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                {t(`cat_${hunch.categoryName?.toLowerCase()}`, { defaultValue: hunch.categoryName })}
              </span>
              {isMulti && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Layers className="w-3 h-3" />
                  Multi-prediction
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight mb-5">
              {hunch.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground pb-5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <a
                  href="#activity-feed"
                  onClick={(e) => { e.preventDefault(); document.getElementById("activity-feed")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  <strong className="text-foreground font-semibold">{hunch.participantCount.toLocaleString()}</strong> {t("participants")}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {isOpen
                  ? <span>{t("ends_on", { date: format(new Date(hunch.endsAt), "PPPp", { locale: dateFnsLocale }) })}</span>
                  : <span>{t("ended_on", { date: format(new Date(hunch.endsAt), "PPP", { locale: dateFnsLocale }) })}</span>
                }
              </div>
            </div>
          </div>

          {/* Image */}
          <div>
            {hunch.imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-border bg-muted h-full">
                <img src={hunch.imageUrl} alt={hunch.title} className="w-full h-full object-cover" style={{ objectPosition: hunch.imageFocalPoint ?? "center" }} />
              </div>
            )}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-7">
            {/* Distribution: single-question */}
            {!isMulti && hunch.options.length > 0 && (
              <DistributionChart
                options={hunch.options}
                participantCount={hunch.participantCount}
                answerType={(hunch as any).answerType}
                title="Predictions distribution"
              />
            )}

            {/* Distribution: multi-question (one chart per question) */}
            {isMulti && questions.length > 0 && questions.some((q) => q.options.length > 0) && (
              <div className="bg-card border border-border rounded-2xl p-6 card-shadow space-y-6">
                <div>
                  <h3 className="text-base font-display font-bold text-foreground mb-1">Predictions distribution</h3>
                  <p className="text-xs text-muted-foreground">
                    {hunch.participantCount.toLocaleString()} prediction{hunch.participantCount !== 1 ? "s" : ""} so far
                  </p>
                </div>
                {questions.map((q, idx) => q.options.length > 0 && (
                  <div key={q.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-0.5">{idx + 1}</span>
                      <span className="text-sm font-medium text-foreground">{q.prompt}</span>
                    </div>
                    <DistributionChart
                      options={q.options}
                      participantCount={hunch.participantCount}
                      answerType={q.answerType}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Prize Pool — main content */}
            {(() => {
              const tiers = hunch.prizeTiers && hunch.prizeTiers.length > 0
                ? hunch.prizeTiers
                : [{ rank: 1, prize: hunch.prize }];
              return (
                <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="flex items-center gap-2">
                      {getPrizeIcon(hunch.prize.type)}
                      <h3 className="text-base font-display font-bold text-foreground">{tiers.length > 1 ? t("prize_pool_multiple") : t("prize_pool")}</h3>
                    </div>
                    {hunch.prizePoolTotal && tiers.length > 1 && (
                      <span className="text-2xl font-display font-bold text-foreground">{hunch.prizePoolTotal}</span>
                    )}
                  </div>

                  {/* One row per prize */}
                  <div className="divide-y divide-border">
                    {tiers.map((tier) => (
                      <div key={tier.rank} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        {/* Square image */}
                        <div className="shrink-0">
                          {tier.prize.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(tier.prize.imageUrl!)}
                              className="w-12 h-12 rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all block"
                            >
                              <img src={tier.prize.imageUrl} alt={tier.prize.label} className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
                              {getPrizeIcon(tier.prize.type)}
                            </div>
                          )}
                        </div>

                        {/* Name + rank */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug truncate">{tier.prize.label}</p>
                          {tiers.length > 1 && (
                            <p className="text-xs text-muted-foreground mt-0.5">{ordinal(tier.rank)} place</p>
                          )}
                        </div>

                        {/* Value — prominent */}
                        <div className="shrink-0 text-right">
                          <span className="text-lg font-display font-bold text-primary">{tier.prize.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Multi-prize note */}
                  {tiers.length > 1 && (
                    <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border">
                      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-snug">
                        The prize pool is divided among the top finishers — one prize per place.
                      </p>
                    </div>
                  )}

                  {/* Prize conditions — collapsible */}
                  {hunch.prizeConditions && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setConditionsOpen((o) => !o)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium w-full text-left transition-colors"
                      >
                        {conditionsOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                        Prize conditions
                      </button>
                      {conditionsOpen && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                          {hunch.prizeConditions}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Context */}
            <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
              <h3 className="text-base font-display font-bold text-foreground mb-3">{t("the_context")}</h3>
              <p className="text-muted-foreground leading-relaxed">{hunch.description}</p>
            </div>

            {/* Rules */}
            {hunch.rules && (
              <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-2xl p-5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong className="text-foreground block mb-1">{t("how_resolution")}</strong>
                  <span className="text-muted-foreground whitespace-pre-line">{hunch.rules}</span>
                </div>
              </div>
            )}

            {/* Results & Winners — combined module */}
            {isResolved && (() => {
              let sources: { type: "link" | "image" | "video"; url: string; label: string }[] = [];
              try { if (hunch.resultSources) sources = JSON.parse(hunch.resultSources); } catch { /* ignore */ }
              const hasResult = !!(hunch.resultText || sources.filter((s) => s.url).length > 0);
              const hasWinners = winnersData && winnersData.winners.length > 0;

              return (
                <div className="bg-card border border-amber-200 rounded-2xl overflow-hidden card-shadow">
                  {/* Result section */}
                  {hasResult && (
                    <div className="p-6 bg-amber-50/50 space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        <h3 className="text-base font-display font-bold text-amber-900">Resultado</h3>
                      </div>

                      {hunch.resultText && (
                        <p className="text-sm text-amber-900/80 leading-relaxed whitespace-pre-line">{hunch.resultText}</p>
                      )}

                      {sources.filter((s) => s.url).length > 0 && (
                        <div className="space-y-3">
                          {sources.filter((s) => s.url).map((src, idx) => {
                            if (src.type === "image") {
                              return (
                                <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" className="block group">
                                  <img
                                    src={src.url}
                                    alt={src.label || "Result image"}
                                    className="w-full rounded-xl object-cover max-h-64 border border-amber-200 group-hover:opacity-90 transition-opacity"
                                  />
                                  {src.label && <p className="mt-1.5 text-xs text-amber-700">{src.label}</p>}
                                </a>
                              );
                            }
                            if (src.type === "video") {
                              return (
                                <div key={idx}>
                                  <video src={src.url} controls className="w-full rounded-xl border border-amber-200 max-h-64" />
                                  {src.label && <p className="mt-1.5 text-xs text-amber-700">{src.label}</p>}
                                </div>
                              );
                            }
                            return (
                              <a
                                key={idx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-amber-800 hover:text-amber-600 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="underline underline-offset-2 truncate">{src.label || src.url}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Winners section */}
                  <div className={`p-6 ${hasResult ? "border-t border-amber-100" : ""}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <h3 className="text-base font-display font-bold text-foreground">Ganadores</h3>
                    </div>

                    {!winnersData ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : !hasWinners ? (
                      <p className="text-sm text-muted-foreground">No winners have been recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {winnersData.winners.map((w, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border"
                          >
                            {w.rank != null ? (
                              <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0 min-w-[68px] text-center mt-0.5">
                                {ordinal(w.rank)} place
                              </span>
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-1">
                                <Trophy className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                              <Link
                                href={`/u/${w.username}`}
                                className="font-semibold text-primary hover:underline text-sm break-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                @{w.username}
                              </Link>
                              {w.multiPredictions && w.multiPredictions.length > 0 ? (
                                <div className="space-y-0.5">
                                  {w.multiPredictions.map((mp, i) => (
                                    <span key={i} className="text-xs text-muted-foreground block">
                                      <span className="font-medium text-foreground/70">{mp.prompt}:</span> {mp.answer}
                                    </span>
                                  ))}
                                </div>
                              ) : w.prediction ? (
                                <span className="text-xs text-muted-foreground">Predicción: {w.prediction}</span>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {w.prizeLabel}{w.prizeValue ? ` · ${w.prizeValue}` : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Prize + Prediction — single merged card */}
            <div className="bg-card border border-primary/20 rounded-2xl p-5 card-shadow">
              {/* Prize Pool */}
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-3 uppercase tracking-wide">
                {getPrizeIcon(hunch.prize.type)}
                {hunch.prizeTiers && hunch.prizeTiers.length > 1 ? t("prize_pool_multiple") : t("prize_pool")}
              </div>
              {hunch.prizeTiers && hunch.prizeTiers.length > 1 ? (
                <>
                  <div className="text-3xl font-display font-bold text-foreground mb-3">
                    {hunch.prizePoolTotal}
                  </div>
                  <button
                    onClick={() => setPrizeOpen((o) => !o)}
                    className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <span>{t("prize_split", { defaultValue: `Split among ${hunch.prizeTiers.length} winners`, count: hunch.prizeTiers.length })}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary group-hover:underline shrink-0 ml-2">
                      {prizeOpen ? <><>{t("hide_list", { defaultValue: "Hide" })}</><ChevronUp className="w-3.5 h-3.5" /></> : <><>{t("see_full_list", { defaultValue: "See full list" })}</><ChevronDown className="w-3.5 h-3.5" /></>}
                    </span>
                  </button>
                  {prizeOpen && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-border">
                      {hunch.prizeTiers.map((tier) => (
                        <div key={tier.rank} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0 min-w-[72px] text-center">
                            {ordinal(tier.rank)} place
                          </span>
                          <span className="text-sm text-muted-foreground truncate">{tier.prize.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl font-display font-bold text-foreground mb-0.5">{hunch.prize.value}</div>
                  <div className="text-sm text-muted-foreground">{hunch.prize.label}</div>
                </>
              )}

              {/* Divider */}
              <div className="border-t border-border my-5" />

              {/* Prediction section */}
              <h3 className="font-display font-bold text-lg text-foreground mb-4">
                {isResolved ? t("final_results") : t("make_prediction")}
              </h3>

              {/* Resolved: prediction distribution in sidebar */}
              {isResolved && !isMulti && hunch.options.length > 0 && (
                <div className="mb-4">
                  <DistributionChart
                    options={hunch.options}
                    participantCount={hunch.participantCount}
                    answerType={(hunch as any).answerType}
                    compact
                  />
                </div>
              )}
              {isResolved && isMulti && questions.length > 0 && questions.some((q) => q.options.length > 0) && (
                <div className="space-y-4 mb-4">
                  {questions.map((q, idx) => q.options.length > 0 && (
                    <div key={q.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-0.5">{idx + 1}</span>
                        <span className="text-xs font-medium text-muted-foreground">{q.prompt}</span>
                      </div>
                      <DistributionChart
                        options={q.options}
                        participantCount={hunch.participantCount}
                        answerType={q.answerType}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Ticket cost */}
              {isOpen && !submitted && hunch.ticketCost && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl">
                  <Ticket className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    Costs {hunch.ticketCost} ticket{hunch.ticketCost !== 1 ? "s" : ""}
                    {user ? <span className="text-muted-foreground ml-1">({user.tickets} remaining)</span> : null}
                  </span>
                </div>
              )}

              {/* Multi-prediction info banner */}
              {isOpen && !submitted && isMulti && (
                <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-muted/50 border border-border rounded-xl">
                  <Layers className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-snug">
                    Answer all {questions.length} criteria below. You must get every one correct to win.
                  </p>
                </div>
              )}

              {/* Single-question input */}
              {isOpen && !submitted && !isMulti && (
                <div className="mb-4">
                  <AnswerInput
                    answerType={(hunch as any)?.answerType ?? "integer"}
                    value={freeText}
                    onChange={setFreeText}
                    onEnter={handlePredict}
                    options={(hunch as any)?.options}
                  />
                </div>
              )}

              {/* Multi-question inputs */}
              {isOpen && !submitted && isMulti && questions.length > 0 && (
                <div className="space-y-4 mb-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug">{q.prompt}</p>
                        </div>
                      </div>
                      <AnswerInput
                        answerType={q.answerType}
                        value={multiAnswers[q.id] ?? ""}
                        onChange={(v) => setMultiAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        options={q.options}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Submitted state */}
              {submitted && !isMulti && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-primary">{isNumericType((hunch as any)?.answerType) ? fmtNumericLabel(freeText) : freeText}</span>
                </div>
              )}

              {submitted && isMulti && (
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold text-primary">Prediction submitted</span>
                  </div>
                  <div className="space-y-1 pl-6">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{idx + 1}.</span> {q.prompt}: <span className="font-semibold text-foreground">{isNumericType(q.answerType) ? fmtNumericLabel(multiAnswers[q.id] ?? "") : multiAnswers[q.id]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action button */}
              {isOpen && !submitted ? (
                <Button
                  className="w-full font-bold text-base h-12 bg-primary text-white hover:bg-primary/90 rounded-xl shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  disabled={!allAnswered || submitPrediction.isPending}
                  onClick={handlePredict}
                >
                  {submitPrediction.isPending ? t("submitting") : user ? t("lock_prediction") : "Sign in to predict"}
                </Button>
              ) : !isOpen ? (
                <div className="w-full text-center p-3.5 bg-muted rounded-xl text-muted-foreground text-sm font-medium border border-border">
                  {isResolved ? t("hunch_resolved") : t("predictions_closed")}
                </div>
              ) : null}

              {/* Confirmation modal */}
              {showConfirm && hunch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-display font-bold text-lg text-foreground">Confirm prediction</h3>
                      </div>
                      <button onClick={() => setShowConfirm(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Single answer */}
                    {!isMulti && (
                      <>
                        <p className="text-sm text-muted-foreground mb-1">Your answer</p>
                        <div className="bg-muted rounded-xl px-4 py-2.5 mb-4">
                          <span className="text-sm font-semibold text-foreground">{isNumericType((hunch as any)?.answerType) ? fmtNumericLabel(freeText) : freeText}</span>
                        </div>
                      </>
                    )}

                    {/* Multi answers */}
                    {isMulti && (
                      <div className="bg-muted rounded-xl px-4 py-3 mb-4 space-y-2.5">
                        {questions.map((q, idx) => (
                          <div key={q.id}>
                            <p className="text-xs text-muted-foreground leading-snug">
                              <span className="font-semibold text-foreground">{idx + 1}.</span> {q.prompt}
                            </p>
                            <p className="text-sm font-semibold text-foreground mt-0.5 pl-3.5">
                              {isNumericType(q.answerType) ? fmtNumericLabel(multiAnswers[q.id] ?? "") || "—" : (multiAnswers[q.id] ?? "—")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mb-4">
                      This will use{" "}
                      <span className="font-semibold text-foreground">{hunch.ticketCost} ticket{hunch.ticketCost !== 1 ? "s" : ""}</span>.
                      {user ? <> You have <span className="font-semibold text-foreground">{user.tickets}</span> remaining.</> : null}
                    </p>

                    {isMulti && (
                      <p className="text-xs text-muted-foreground mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        You need to get all {questions.length} criteria right to win.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowConfirm(false)}>Cancel</Button>
                      <Button
                        className="flex-1 bg-primary text-white hover:bg-primary/90 rounded-xl font-bold"
                        onClick={confirmPredict}
                        disabled={submitPrediction.isPending}
                      >
                        {submitPrediction.isPending ? "Submitting..." : "Lock it in"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" className="w-full rounded-xl border-border font-medium" onClick={handleShare}>
              {copied
                ? <><Check className="w-4 h-4 mr-2 text-green-600" /><span className="text-green-600">Link copied</span></>
                : <><Share2 className="w-4 h-4 mr-2" /> {t("share")}</>
              }
            </Button>

            {/* Referral banner — logged-in users only */}
            {user && (
              <Link href="/referral">
                <div className="group cursor-pointer rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 hover:border-primary/40 hover:from-primary/15 transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Gift className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight">
                        Invita amigos, gana tickets
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Por cada amigo que se una al programa obtienes tickets gratis para participar.
                      </p>
                      <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary group-hover:underline">
                        Ver mi enlace de referido
                        <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Activity feed */}
            <div className="mt-4">
              <ActivityFeed hunchId={hunch.id} dateFnsLocale={dateFnsLocale} />
            </div>
          </div>

          {/* Community comments — third grid item so on mobile it appears after
              the sidebar (prize + prediction), but on desktop it sits in the
              left two-thirds column below the main content. */}
          {hunch.slug && (
            <div className="lg:col-span-2">
              <HunchComments hunchSlug={hunch.slug} />
            </div>
          )}
        </div>
      </div>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
            <img src={lightboxUrl} alt="Prize" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </Layout>
  );
}
