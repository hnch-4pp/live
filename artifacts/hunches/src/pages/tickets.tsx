import { Link, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import {
  Ticket, ArrowLeft, Info, Sparkles, Package, MinusCircle,
  Star, Zap, Crown, Loader2, Settings,
  CheckCircle2, AlertCircle, ChevronRight, TicketCheck, X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { txSubtitle, formatDate, txIcon, txColors } from "@/lib/ticket-utils";
import type { TxType, TicketTransaction } from "@/lib/ticket-utils";

interface TicketPack {
  product_id: string;
  product_name: string;
  metadata: Record<string, string>;
  price_id: string;
  unit_amount: number;
  currency: string;
}

interface SubscriptionInfo {
  subscription: {
    id: number;
    tier: string;
    ticketsPerMonth: number;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  tier: string;
}

function useTicketActivity() {
  return useQuery<TicketTransaction[]>({
    queryKey: ["ticket-activity"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/auth/tickets/activity"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json() as Promise<TicketTransaction[]>;
    },
    staleTime: 30_000,
  });
}

function useTicketPacks() {
  return useQuery<TicketPack[]>({
    queryKey: ["ticket-packs"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/stripe/ticket-packs"));
      if (!res.ok) return [];
      const data = await res.json() as { data: TicketPack[] };
      return data.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

function useMySubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/stripe/my-subscription"), { credentials: "include" });
      if (!res.ok) return { subscription: null, tier: "free" };
      return res.json() as Promise<SubscriptionInfo>;
    },
    staleTime: 60_000,
  });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

const PACK_ICONS: Record<string, React.ReactNode> = {
  single: <Ticket className="w-5 h-5" />,
  five:   <Package className="w-5 h-5" />,
  ten:    <Sparkles className="w-5 h-5" />,
};

const FALLBACK_PACKS: { label: string; tickets: number; price: string; badge?: boolean }[] = [];

const MONTHLY_PASSES = [
  { id: "pro",    icon: <Zap className="w-4 h-4" />,    label: "Pro",    tickets: 20,  amountCents: 19900, featured: false },
  { id: "elite",  icon: <Star className="w-4 h-4" />,   label: "Elite",  tickets: 50,  amountCents: 29900, featured: true  },
  { id: "legend", icon: <Crown className="w-4 h-4" />,  label: "Legend", tickets: 100, amountCents: 49900, featured: false },
];

export default function TicketsPage() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading, refetch: refetchUser } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: activity, isLoading: activityLoading } = useTicketActivity();
  const { data: packs = [], isLoading: packsLoading } = useTicketPacks();
  const { data: subInfo, isLoading: subLoading } = useMySubscription();

  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ ok: boolean; message: string; tickets?: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  useEffect(() => {
    refetchUser();
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "1") {
      setSuccessBanner(true);
      void queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
      window.history.replaceState({}, "", "/tickets");
    }
  }, []);

  const isLoading = authLoading;
  const packsReady = !packsLoading && packs.length > 0;
  const activeTier = subInfo?.tier ?? "free";
  const activeSub = subInfo?.subscription;

  const recentActivity = activity ? [...activity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 3) : [];

  async function handleBuyPack(priceId: string) {
    if (!user) { setLocation("/login"); return; }
    setCheckingOut(priceId);
    try {
      const res = await fetch(apiUrl("/api/stripe/checkout"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, returnUrl: window.location.origin }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setCheckingOut(null);
    }
  }

  async function handleSubscribe(tierId: string) {
    if (!user) { setLocation("/login"); return; }
    setSubscribing(tierId);
    try {
      const res = await fetch(apiUrl("/api/stripe/subscribe"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, returnUrl: window.location.origin }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setSubscribing(null);
    }
  }

  async function handleRedeemPromo(e: React.FormEvent) {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await fetch(apiUrl("/api/auth/ticket-codes/redeem"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, context: "general" }),
      });
      const data = await res.json() as { ticketsGranted?: number; error?: string };
      if (!res.ok) {
        setPromoResult({ ok: false, message: data.error ?? t("promo_invalid") });
      } else {
        const tickets = data.ticketsGranted ?? 0;
        const msg = tickets !== 1
          ? t("promo_success_plural", { count: tickets })
          : t("promo_success", { count: tickets });
        setPromoResult({ ok: true, message: msg, tickets });
        setPromoCode("");
        void refetchUser();
        void queryClient.invalidateQueries({ queryKey: ["ticket-activity"] });
      }
    } catch {
      setPromoResult({ ok: false, message: t("promo_error") });
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleManageSubscription() {
    if (!user) return;
    setOpeningPortal(true);
    try {
      const res = await fetch(apiUrl("/api/stripe/subscription/portal"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setOpeningPortal(false);
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-6xl">

        {/* Header */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t("tickets_back")}
        </Link>
        <h1 className="font-display font-bold text-3xl text-foreground mb-1">{t("tickets_title")}</h1>
        <p className="text-muted-foreground text-sm mb-8">{t("tickets_sub")}</p>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded-2xl animate-pulse" />
              <div className="h-48 bg-muted rounded-2xl animate-pulse" />
            </div>
            <div className="h-64 bg-muted rounded-2xl animate-pulse" />
          </div>
        ) : user ? (
          <>
            {/* Subscription success banner */}
            {successBanner && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{t("sub_active_title")}</p>
                  <p className="text-xs text-emerald-700">{t("sub_active_desc")}</p>
                </div>
                <button onClick={() => setSuccessBanner(false)} className="ml-auto text-emerald-500 hover:text-emerald-700">
                  <MinusCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

              {/* ── LEFT COLUMN ── */}
              <div>
                {/* Active subscription status */}
                {!subLoading && activeSub && (
                  <div className={`flex items-center justify-between gap-4 rounded-xl p-4 mb-6 ${
                    activeSub.cancelAtPeriodEnd
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-primary/5 border border-primary/20"
                  }`}>
                    <div className="flex items-center gap-3">
                      {activeSub.cancelAtPeriodEnd
                        ? <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        : <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      }
                      <div>
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {activeSub.tier} — {activeSub.ticketsPerMonth} tickets{t("per_month_suffix")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeSub.cancelAtPeriodEnd
                            ? t("sub_cancels", { date: formatPeriodEnd(activeSub.currentPeriodEnd) })
                            : t("sub_renews", { date: formatPeriodEnd(activeSub.currentPeriodEnd) })
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleManageSubscription}
                      disabled={openingPortal}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                    >
                      {openingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                      {t("tickets_manage")}
                    </button>
                  </div>
                )}

                {/* Balance card */}
                <div className="bg-card border border-primary/20 rounded-2xl p-6 card-shadow mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("current_balance")}</p>
                      <p className="text-4xl font-display font-bold text-foreground leading-none mt-0.5">
                        {user.tickets}
                        <span className="text-lg font-medium text-muted-foreground ml-2">
                          ticket{user.tickets !== 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Get more tickets ── */}
                <div className="mb-8">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-5">{t("tickets_get_more")}</h2>

                  {/* Monthly Passes — shown first */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("monthly_passes_label")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {MONTHLY_PASSES.map((pass) => {
                      const isActive = activeTier === pass.id;
                      const isSubscribing = subscribing === pass.id;
                      const isFree = pass.amountCents === 0;
                      const anyLoading = !!subscribing || openingPortal;

                      return (
                        <div
                          key={pass.id}
                          className={`relative rounded-xl p-4 flex flex-col gap-2 transition-all ${
                            isActive
                              ? pass.featured
                                ? "bg-primary/8 border-2 border-primary shadow-sm"
                                : "bg-primary/5 border-2 border-primary/40"
                              : pass.featured
                                ? "bg-primary/8 border-2 border-primary/30 shadow-sm"
                                : "bg-card border border-border hover:border-primary/30"
                          }`}
                        >
                          {pass.featured && !isActive && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                              {t("top_choice_badge")}
                            </span>
                          )}
                          {isActive && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-emerald-500 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                              {t("current_plan_badge")}
                            </span>
                          )}

                          <div className={isActive || pass.featured ? "text-primary" : "text-muted-foreground"}>{pass.icon}</div>
                          <div>
                            <p className={`text-sm font-bold ${isActive || pass.featured ? "text-primary" : "text-foreground"}`}>{pass.label}</p>
                            <p className="text-xs text-muted-foreground">{pass.tickets} tickets{t("per_month_suffix")}</p>
                          </div>
                          <p className="text-base font-bold text-primary mt-auto">
                            {isFree
                              ? <span className="text-foreground font-bold">Free</span>
                              : <>${(pass.amountCents / 100).toFixed(0)} <span className="text-xs font-medium text-muted-foreground">MXN{t("per_month_suffix")}</span></>
                            }
                          </p>

                          {!isFree && (
                            <button
                              onClick={() => isActive ? handleManageSubscription() : handleSubscribe(pass.id)}
                              disabled={anyLoading}
                              className={`mt-1 w-full text-xs font-semibold py-1.5 rounded-lg transition-all ${
                                anyLoading
                                  ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                                  : isActive
                                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                                    : "bg-primary text-white hover:bg-primary/90"
                              }`}
                            >
                              {isSubscribing ? (
                                <span className="flex items-center justify-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  {t("loading_dots")}
                                </span>
                              ) : isActive ? (
                                openingPortal ? (
                                  <span className="flex items-center justify-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t("loading_dots")}
                                  </span>
                                ) : t("tickets_manage")
                              ) : (
                                t("subscribe_btn")
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    {t("tickets_free_note")}
                  </p>

                  {/* Ticket Pack — single card, below subscriptions */}
                  {packsReady && packs[0] && (() => {
                    const pack = packs[0];
                    const ticketAmount = Number(pack.metadata?.ticketAmount ?? 1);
                    const isChecking = checkingOut === pack.price_id;
                    const anyLoading = !!checkingOut;
                    return (
                      <div className="mt-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("ticket_packs_label")}</p>
                        <button
                          onClick={() => handleBuyPack(pack.price_id)}
                          disabled={anyLoading}
                          className={`w-full bg-card border rounded-xl p-5 flex items-center gap-5 text-left transition-all duration-150 group ${
                            anyLoading
                              ? "opacity-60 cursor-not-allowed"
                              : "hover:border-primary/50 hover:shadow-sm cursor-pointer"
                          } ${isChecking ? "border-primary/50 shadow-sm" : "border-border"}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isChecking ? "bg-primary/10 text-primary" : "bg-primary/5 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}>
                            {isChecking
                              ? <Loader2 className="w-6 h-6 animate-spin" />
                              : <Package className="w-6 h-6" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-bold text-foreground">{pack.product_name}</p>
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {t("one_time_purchase")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{ticketAmount} tickets — {t("no_subscription_needed")}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xl font-extrabold text-primary">${(pack.unit_amount / 100).toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">MXN</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isChecking ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* How tickets work */}
                <div className="bg-muted/60 border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Info className="w-4 h-4 text-primary" />
                    {t("how_tickets_title")}
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-none">
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>{t("how_tickets_1")}</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>{t("how_tickets_2")}</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>{t("how_tickets_3")}</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>{t("how_tickets_4")}</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 font-bold rounded-xl h-12"
                    onClick={() => setLocation("/")}
                  >
                    {t("browse_open_hunches")}
                  </Button>
                </div>
              </div>

              {/* ── RIGHT COLUMN — Activity + Promo ── */}
              <div className="lg:sticky lg:top-6 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{t("activity_label")}</h2>
                    {activity && activity.length > 0 && (
                      <Link
                        href="/tickets/activity"
                        className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        {t("view_detail")}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {activityLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
                    </div>
                  ) : recentActivity.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border" />
                      <div className="space-y-0">
                        {recentActivity.map((tx) => {
                          const c = txColors(tx.type);
                          return (
                            <div key={tx.id} className="relative flex gap-3 pb-4 last:pb-0">
                              <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                                {txIcon(tx.type)}
                              </div>
                              <div className="flex-1 min-w-0 pt-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{tx.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.createdAt, t)}</p>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>
                                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {activity && activity.length > 3 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Link
                            href="/tickets/activity"
                            className="flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {t("view_all_movements", { count: activity.length })}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t("no_activity")}
                    </div>
                  )}
                </div>

                {/* ── Promo Code ── */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TicketCheck className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{t("promo_code_title")}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{t("promo_code_desc")}</p>

                  <form onSubmit={handleRedeemPromo} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoResult(null);
                        }}
                        placeholder={t("promo_placeholder")}
                        maxLength={32}
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-border bg-background text-sm font-mono font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all uppercase"
                        disabled={promoLoading}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <button
                        type="submit"
                        disabled={!promoCode.trim() || promoLoading}
                        className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0"
                      >
                        {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("redeem_btn")}
                      </button>
                    </div>

                    {promoResult && (
                      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                        promoResult.ok
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                          : "bg-red-50 border border-red-200 text-red-600"
                      }`}>
                        {promoResult.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          : <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        }
                        <span className="font-medium">{promoResult.message}</span>
                      </div>
                    )}
                  </form>
                </div>

              </div>

            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
