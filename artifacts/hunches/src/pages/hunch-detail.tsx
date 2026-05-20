import { useState } from "react";
import { useParams, Link } from "wouter";
import { format, isPast } from "date-fns";
import {
  enUS, es, de, fr, pt, it, ja, ko, zhCN, id as idLocale, tr,
} from "date-fns/locale";
import { ArrowLeft, Users, Clock, Share2, AlertCircle, Info, Trophy, CheckCircle2, Gift, Award, DollarSign } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetHunch, useSubmitPrediction, getGetHunchQueryKey } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

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
  const { id } = useParams<{ id: string }>();
  const hunchId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: hunch, isLoading, error } = useGetHunch(hunchId, { lang }, {
    query: { enabled: !!hunchId }
  });

  const submitPrediction = useSubmitPrediction();

  const handlePredict = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return;
    submitPrediction.mutate({ id: hunchId, data: { freeText: trimmed } }, {
      onSuccess: () => {
        setSubmitted(true);
        toast({ title: t("prediction_ok_title"), description: t("prediction_ok_desc") });
        queryClient.invalidateQueries({ queryKey: getGetHunchQueryKey(hunchId) });
      },
      onError: (err: any) => {
        toast({ title: t("error"), description: err.error || t("failed_submit"), variant: "destructive" });
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-7">
            {/* Header */}
            <div>
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

            {/* Image */}
            {hunch.imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-border bg-muted">
                <img src={hunch.imageUrl} alt={hunch.title} className="w-full max-h-[380px] object-cover" />
              </div>
            )}

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
            {/* Prize */}
            <div className="bg-card border border-primary/20 rounded-2xl p-5 card-shadow">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-3 uppercase tracking-wide">
                {getPrizeIcon(hunch.prize.type)}
                {t("prize_pool")}
              </div>
              <div className="text-3xl font-display font-bold text-foreground mb-0.5">{hunch.prize.value}</div>
              <div className="text-sm text-muted-foreground">{hunch.prize.label}</div>
            </div>

            {/* Prediction */}
            <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
              <h3 className="font-display font-bold text-lg text-foreground mb-4">
                {isResolved ? t("final_results") : t("make_prediction")}
              </h3>

              {/* Free-text input — shown when open and not yet submitted */}
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

              {/* Submitted confirmation */}
              {submitted && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-primary">{freeText}</span>
                </div>
              )}

              {/* Community answers */}
              {hunch.options.length > 0 ? (
                <div className="mb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    {t("community_answers")}
                  </p>
                  <div className="space-y-2.5">
                    {hunch.options
                      .slice()
                      .sort((a, b) => b.percentage - a.percentage)
                      .slice(0, 5)
                      .map((option) => {
                        const isWinner = isResolved && hunch.winnerOption === option.label;
                        const isUserAnswer = submitted && option.label.trim().toLowerCase() === freeText.trim().toLowerCase();
                        return (
                          <div key={option.id} className="relative">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className={`text-sm truncate pr-3 font-medium ${isWinner ? "text-primary font-semibold" : isUserAnswer ? "text-primary font-semibold" : "text-foreground"}`}>
                                {isWinner && <CheckCircle2 className="w-3 h-3 inline mr-1 mb-0.5" />}
                                {option.label}
                              </span>
                              <span className={`text-sm font-mono font-semibold flex-shrink-0 tabular-nums ${isWinner || isUserAnswer ? "text-primary" : "text-muted-foreground"}`}>
                                {Math.round(option.percentage)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-primary" : isUserAnswer ? "bg-primary/80" : "bg-primary/30"}`}
                                style={{ width: `${option.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-5">{t("be_first")}</p>
              )}

              {isOpen && !submitted ? (
                <Button
                  className="w-full font-bold text-base h-12 bg-primary text-white hover:bg-primary/90 rounded-xl shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  disabled={!freeText.trim() || submitPrediction.isPending}
                  onClick={handlePredict}
                >
                  {submitPrediction.isPending ? t("submitting") : t("lock_prediction")}
                </Button>
              ) : !isOpen ? (
                <div className="w-full text-center p-3.5 bg-muted rounded-xl text-muted-foreground text-sm font-medium border border-border">
                  {isResolved ? t("hunch_resolved") : t("predictions_closed")}
                </div>
              ) : null}
            </div>

            <Button variant="outline" className="w-full rounded-xl border-border font-medium">
              <Share2 className="w-4 h-4 mr-2" /> {t("share")}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
