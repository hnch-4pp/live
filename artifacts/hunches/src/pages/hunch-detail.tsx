import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, isPast, type Locale } from "date-fns";
import {
  enUS, es, de, fr, pt, it, ja, ko, zhCN, id as idLocale, tr,
} from "date-fns/locale";
import { ArrowLeft, Users, Clock, Share2, AlertCircle, Trophy, CheckCircle2, Gift, Award, DollarSign, ChevronDown, ChevronUp, Check, Ticket, X, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";
import { useGetHunch, useSubmitPrediction, getGetHunchQueryKey } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

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

export default function HunchDetail() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = DATE_FNS_LOCALES[i18n.language] ?? enUS;
  const lang = i18n.language !== "en" ? i18n.language : undefined;
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, refetch: refetchUser } = useAuth();
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const title = hunch?.title ?? "Hunch";
    const text = hunch?.description ?? "";
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled or browser blocked — no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { data: hunch, isLoading, error } = useGetHunch(slug ?? "", { lang }, {
    query: { queryKey: getGetHunchQueryKey(slug ?? "", { lang }), enabled: !!slug }
  });

  const submitPrediction = useSubmitPrediction();

  const handlePredict = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    if (!user) { setLocation("/login"); return; }
    setShowConfirm(true);
  };

  const confirmPredict = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    setShowConfirm(false);
    submitPrediction.mutate({ id: hunch?.id ?? 0, data: { freeText: trimmed } }, {
      onSuccess: () => {
        setSubmitted(true);
        refetchUser();
        toast({ title: t("prediction_ok_title"), description: t("prediction_ok_desc") });
        queryClient.invalidateQueries({ queryKey: getGetHunchQueryKey(slug ?? "") });
      },
      onError: (err: any) => {
        toast({ title: t("error"), description: (err as any)?.error || t("failed_submit"), variant: "destructive" });
      }
    });
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

        {/* Header row — same column grid so image aligns with sidebar */}
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
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight mb-5">
              {hunch.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground pb-5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span><strong className="text-foreground font-semibold">{hunch.participantCount.toLocaleString()}</strong> {t("participants")}</span>
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

          {/* Image — right column of header grid */}
          <div>
            {hunch.imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-border bg-muted h-full">
                <img src={hunch.imageUrl} alt={hunch.title} className="w-full h-full object-cover" style={{ objectPosition: hunch.imageFocalPoint ?? "center" }} />
              </div>
            )}
          </div>
        </div>

        {/* Content grid — histogram and prize pool start at exactly the same line */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-7">
            {/* Predictions distribution histogram */}
            {hunch.options.length > 0 && (() => {
              const total = hunch.participantCount || 1;
              const isNumeric = (hunch as any).answerType === "integer" || (hunch as any).answerType === "decimal";

              // Derive count per option from percentage
              const withCounts = hunch.options.map((o) => ({
                ...o,
                count: Math.max(1, Math.round((o.percentage / 100) * total)),
              }));

              let chartData: { label: string; fullLabel: string; count: number }[];

              if (isNumeric) {
                // Parse numeric values and bin them
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
                  const fmt = (n: number) =>
                    Number.isInteger(n) ? String(n) : n.toFixed(1);
                  return {
                    label: numBins === 1 ? fmt(lo) : fmt(lo),
                    fullLabel: numBins === 1 ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`,
                    count,
                  };
                });

                chartData = bins;
              } else {
                // Non-numeric: sort by count descending, take top 12
                chartData = withCounts
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 12)
                  .map((o) => ({
                    label: o.label.length > 12 ? o.label.slice(0, 11) + "…" : o.label,
                    fullLabel: o.label,
                    count: o.count,
                  }));
              }

              const maxCount = Math.max(...chartData.map((d) => d.count));

              return (
                <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
                  <h3 className="text-base font-display font-bold text-foreground mb-1">Predictions distribution</h3>
                  <p className="text-xs text-muted-foreground mb-5">
                    {total.toLocaleString()} prediction{total !== 1 ? "s" : ""} so far
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 22, right: 8, left: -12, bottom: isNumeric ? 8 : 44 }}
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
                            <Cell
                              key={i}
                              fill={`hsl(var(--primary) / ${opacity.toFixed(2)})`}
                              stroke="none"
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Prize + Prediction — single merged card */}
            <div className="bg-card border border-primary/20 rounded-2xl p-5 card-shadow">
              {/* Prize Pool */}
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-3 uppercase tracking-wide">
                {getPrizeIcon(hunch.prize.type)}
                {t("prize_pool")}
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
                    <span>
                      {t("prize_split", {
                        defaultValue: `Split among ${hunch.prizeTiers.length} winners`,
                        count: hunch.prizeTiers.length,
                      })}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary group-hover:underline shrink-0 ml-2">
                      {prizeOpen ? (
                        <>
                          {t("hide_list", { defaultValue: "Hide" })}
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          {t("see_full_list", { defaultValue: "See full list" })}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
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

              {/* Prediction */}
              <h3 className="font-display font-bold text-lg text-foreground mb-4">
                {isResolved ? t("final_results") : t("make_prediction")}
              </h3>

              {isOpen && !submitted && hunch.ticketCost && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl">
                  <Ticket className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    Costs {hunch.ticketCost} ticket{hunch.ticketCost !== 1 ? "s" : ""}
                    {user ? <span className="text-muted-foreground ml-1">({user.tickets} remaining)</span> : null}
                  </span>
                </div>
              )}

              {isOpen && !submitted && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handlePredict(); }}
                    placeholder={t("type_your_answer")}
                    maxLength={200}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              )}

              {submitted && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-primary">{freeText}</span>
                </div>
              )}

              {isOpen && !submitted ? (
                <Button
                  className="w-full font-bold text-base h-12 bg-primary text-white hover:bg-primary/90 rounded-xl shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  disabled={!freeText.trim() || submitPrediction.isPending}
                  onClick={handlePredict}
                >
                  {submitPrediction.isPending ? t("submitting") : user ? t("lock_prediction") : "Sign in to predict"}
                </Button>
              ) : !isOpen ? (
                <div className="w-full text-center p-3.5 bg-muted rounded-xl text-muted-foreground text-sm font-medium border border-border">
                  {isResolved ? t("hunch_resolved") : t("predictions_closed")}
                </div>
              ) : null}

              {/* Ticket confirmation dialog */}
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
                    <p className="text-sm text-muted-foreground mb-1">Your answer</p>
                    <div className="bg-muted rounded-xl px-4 py-2.5 mb-4">
                      <span className="text-sm font-semibold text-foreground">{freeText}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will use{" "}
                      <span className="font-semibold text-foreground">{hunch.ticketCost} ticket{hunch.ticketCost !== 1 ? "s" : ""}</span>.
                      {user ? <> You have <span className="font-semibold text-foreground">{user.tickets}</span> remaining.</> : null}
                    </p>
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
