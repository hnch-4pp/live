import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/apiFetch";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import {
  Clock, CheckCircle2, XCircle, Users, Hourglass, ChevronRight, Loader2, Target,
} from "lucide-react";

interface MyHunchRow {
  predictionId: number;
  predictionCreatedAt: string;
  optionId: number;
  optionLabel: string;
  optionPercentage: number;
  hunchId: number;
  hunchSlug: string | null;
  hunchTitle: string;
  hunchStatus: string;
  hunchEndsAt: string;
  hunchImageUrl: string | null;
  hunchWinnerOption: string | null;
  hunchParticipantCount: number;
  hunchTicketCost: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

function formatPredictionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeLeft(iso: string, endedLabel: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return endedLabel;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function MyHunches() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [hunches, setHunches] = useState<MyHunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "past">("active");

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;
    fetch(apiUrl("/api/auth/my-hunches"), { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return;
        const data: unknown = await r.json();
        if (Array.isArray(data)) setHunches(data as MyHunchRow[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const active = hunches.filter((h) => h.hunchStatus === "open");
  const past = hunches.filter((h) => h.hunchStatus !== "open");
  const shown = tab === "active" ? active : past;

  return (
    <Layout>
      <div className="flex-1 bg-muted/30 py-10 px-4">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{t("my_hunches_title")}</h1>
              <p className="text-sm text-muted-foreground">{t("my_hunches_sub")}</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Tab pills */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
                {(["active", "past"] as const).map((tabKey) => {
                  const count = tabKey === "active" ? active.length : past.length;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setTab(tabKey)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        tab === tabKey ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tabKey === "active" ? t("tab_active") : t("tab_past")}
                      {count > 0 && (
                        <span className={`min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold ${
                          tab === tabKey ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground"
                        }`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-border">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
              ) : shown.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {tab === "active" ? t("no_active_hunches") : t("no_past_hunches")}
                  </p>
                  {tab === "active" && hunches.length === 0 && (
                    <button
                      onClick={() => setLocation("/")}
                      className="mt-4 text-sm font-semibold text-primary hover:underline"
                    >
                      {t("browse_hunches_link")}
                    </button>
                  )}
                </div>
              ) : (
                shown.map((h) => {
                  const isResolved = h.hunchStatus === "resolved";
                  const isClosed = h.hunchStatus === "closed";
                  const won = isResolved && h.hunchWinnerOption != null && h.optionLabel === h.hunchWinnerOption;
                  const lost = isResolved && h.hunchWinnerOption != null && h.optionLabel !== h.hunchWinnerOption;

                  return (
                    <button
                      key={h.predictionId}
                      onClick={() => setLocation(h.hunchSlug ? `/hunch/${h.hunchSlug}` : "/")}
                      className="w-full text-left px-6 py-4 hover:bg-muted/40 transition-colors flex items-center gap-4 group"
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden relative">
                        {h.hunchImageUrl ? (
                          <img src={h.hunchImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ backgroundColor: h.categoryColor + "22" }}>
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.categoryColor }} />
                            </div>
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1">
                          {h.hunchStatus === "open" && (
                            <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
                              <Clock className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {won && (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center">
                              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {lost && (
                            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-card flex items-center justify-center">
                              <XCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {isClosed && (
                            <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
                              <Hourglass className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: h.categoryColor }}>
                            {h.categoryName}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-snug truncate pr-2">{h.hunchTitle}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {t("your_pick")} <span className="font-medium text-foreground">{h.optionLabel}</span>
                            <span className="text-muted-foreground/70 ml-1">({Math.round(h.optionPercentage)}%)</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            {h.hunchParticipantCount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {t("predicted_on", { date: formatPredictionDate(h.predictionCreatedAt) })}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        {h.hunchStatus === "open" && (
                          <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                            {timeLeft(h.hunchEndsAt, t("ended"))}
                          </span>
                        )}
                        {won && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            {t("outcome_correct")}
                          </span>
                        )}
                        {lost && (
                          <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                            {t("outcome_incorrect")}
                          </span>
                        )}
                        {isClosed && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            {t("outcome_pending")}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
