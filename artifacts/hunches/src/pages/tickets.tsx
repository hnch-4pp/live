import { Link, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import {
  Ticket, ArrowLeft, Info, Gift, Tag, ShoppingBag, MinusCircle,
  Sparkles, Package, RefreshCw, Star, Zap, Crown, Loader2, Settings,
  CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type TxType = "welcome" | "promo" | "purchase" | "subscription" | "spent";

interface TicketTransaction {
  id: number;
  userId: number;
  type: TxType;
  amount: number;
  label: string;
  reference: string | null;
  createdAt: string;
}

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

export function txIcon(type: TxType) {
  switch (type) {
    case "welcome":      return <Gift className="w-4 h-4" />;
    case "promo":        return <Tag className="w-4 h-4" />;
    case "purchase":     return <ShoppingBag className="w-4 h-4" />;
    case "subscription": return <RefreshCw className="w-4 h-4" />;
    case "spent":        return <MinusCircle className="w-4 h-4" />;
  }
}

export function txColors(type: TxType): { icon: string; badge: string } {
  switch (type) {
    case "welcome":      return { icon: "text-violet-600 bg-violet-100", badge: "bg-violet-100 text-violet-700" };
    case "promo":        return { icon: "text-emerald-600 bg-emerald-100", badge: "bg-emerald-100 text-emerald-700" };
    case "purchase":     return { icon: "text-sky-600 bg-sky-100", badge: "bg-sky-100 text-sky-700" };
    case "subscription": return { icon: "text-indigo-600 bg-indigo-100", badge: "bg-indigo-100 text-indigo-700" };
    case "spent":        return { icon: "text-slate-500 bg-slate-100", badge: "bg-slate-100 text-slate-600" };
  }
}

export function txSubtitle(tx: TicketTransaction): string {
  if (tx.type === "welcome")      return "Tickets added to your account at signup";
  if (tx.type === "promo")        return tx.reference ? `Code: ${tx.reference}` : "Promotional code redeemed";
  if (tx.type === "purchase")     return tx.reference ? `Session: ${tx.reference.slice(0, 20)}…` : "Ticket purchase";
  if (tx.type === "subscription") return "Monthly renewal";
  if (tx.type === "spent")        return "Used for a prediction";
  return "";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

const FALLBACK_PACKS = [
  { label: "Single",  tickets: 1,  price: "$0.99" },
  { label: "5-Pack",  tickets: 5,  price: "$4.49" },
  { label: "10-Pack", tickets: 10, price: "$7.99", badge: "Best value" },
];

const MONTHLY_PASSES = [
  { id: "free",    icon: <Ticket className="w-4 h-4" />,   label: "Free",    tickets: 5,   amountCents: 0,    featured: false },
  { id: "starter", icon: <Package className="w-4 h-4" />,  label: "Starter", tickets: 10,  amountCents: 699,  featured: false },
  { id: "plus",    icon: <Star className="w-4 h-4" />,     label: "Plus",    tickets: 25,  amountCents: 1399, featured: false },
  { id: "pro",     icon: <Zap className="w-4 h-4" />,      label: "Pro",     tickets: 100, amountCents: 2999, featured: true  },
  { id: "elite",   icon: <Crown className="w-4 h-4" />,    label: "Elite",   tickets: 250, amountCents: 4999, featured: false },
];

export default function TicketsPage() {
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

  // Activity: newest first, max 3
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
          Back to hunches
        </Link>
        <h1 className="font-display font-bold text-3xl text-foreground mb-1">My Tickets</h1>
        <p className="text-muted-foreground text-sm mb-8">Tickets let you enter predictions and compete for prizes.</p>

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
                  <p className="text-sm font-semibold text-emerald-800">Subscription active</p>
                  <p className="text-xs text-emerald-700">Your monthly tickets will be credited with each billing cycle.</p>
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
                          {activeSub.tier} plan — {activeSub.ticketsPerMonth} tickets/mo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeSub.cancelAtPeriodEnd
                            ? `Cancels ${formatPeriodEnd(activeSub.currentPeriodEnd)}`
                            : `Renews ${formatPeriodEnd(activeSub.currentPeriodEnd)}`
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
                      Manage
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current balance</p>
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
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-5">Get more tickets</h2>

                  {/* Ticket Packs */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Ticket Packs</p>

                  {packsLoading ? (
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      {[0, 1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
                    </div>
                  ) : packsReady ? (
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      {packs.map((pack) => {
                        const packId = pack.metadata?.packId ?? "single";
                        const ticketAmount = Number(pack.metadata?.ticketAmount ?? 1);
                        const isChecking = checkingOut === pack.price_id;
                        const anyLoading = !!checkingOut;
                        return (
                          <button
                            key={pack.price_id}
                            onClick={() => handleBuyPack(pack.price_id)}
                            disabled={anyLoading}
                            className={`relative bg-card border rounded-xl p-4 flex flex-col gap-2 text-left transition-all duration-150 group ${
                              anyLoading
                                ? "opacity-60 cursor-not-allowed"
                                : "hover:border-primary/50 hover:shadow-sm cursor-pointer"
                            } ${isChecking ? "border-primary/50 shadow-sm" : "border-border"}`}
                          >
                            {pack.metadata?.packId === "ten" && (
                              <span className="absolute -top-2 left-3 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                                Best value
                              </span>
                            )}
                            <div className={`transition-colors ${isChecking ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
                              {isChecking
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : (PACK_ICONS[packId] ?? <Ticket className="w-5 h-5" />)
                              }
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{pack.product_name}</p>
                              <p className="text-xs text-muted-foreground">{ticketAmount} ticket{ticketAmount !== 1 ? "s" : ""}</p>
                            </div>
                            <p className="text-base font-bold text-primary mt-auto">{formatPrice(pack.unit_amount)}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      {FALLBACK_PACKS.map((pack) => (
                        <div
                          key={pack.label}
                          className="relative bg-muted/50 border border-border rounded-xl p-4 opacity-50 select-none flex flex-col gap-2"
                        >
                          {pack.badge && (
                            <span className="absolute -top-2 left-3 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                              {pack.badge}
                            </span>
                          )}
                          <div className="text-muted-foreground"><Ticket className="w-5 h-5" /></div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{pack.label}</p>
                            <p className="text-xs text-muted-foreground">{pack.tickets} ticket{pack.tickets !== 1 ? "s" : ""}</p>
                          </div>
                          <p className="text-base font-bold text-primary mt-auto">{pack.price}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Monthly Passes */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Monthly Passes</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                              Top Choice
                            </span>
                          )}
                          {isActive && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-emerald-500 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                              Current plan
                            </span>
                          )}

                          <div className={isActive || pass.featured ? "text-primary" : "text-muted-foreground"}>{pass.icon}</div>
                          <div>
                            <p className={`text-sm font-bold ${isActive || pass.featured ? "text-primary" : "text-foreground"}`}>{pass.label}</p>
                            <p className="text-xs text-muted-foreground">{pass.tickets} tickets/mo</p>
                          </div>
                          <p className="text-base font-bold text-primary mt-auto">
                            {isFree
                              ? <span className="text-foreground font-bold">Free</span>
                              : <>${(pass.amountCents / 100).toFixed(2)}<span className="text-xs font-medium text-muted-foreground">/mo</span></>
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
                                  Loading…
                                </span>
                              ) : isActive ? (
                                openingPortal ? (
                                  <span className="flex items-center justify-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Loading…
                                  </span>
                                ) : "Manage"
                              ) : (
                                "Subscribe"
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Tickets are never required — you can always play with your free tickets.
                  </p>
                </div>

                {/* How tickets work */}
                <div className="bg-muted/60 border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Info className="w-4 h-4 text-primary" />
                    How tickets work
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-none">
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Every new account starts with 15 tickets.</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Each prediction you make costs at least 1 ticket.</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Monthly subscribers receive their tickets at the start of each billing cycle.</li>
                    <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Tickets are not money — no purchase is ever required.</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 font-bold rounded-xl h-12"
                    onClick={() => setLocation("/")}
                  >
                    Browse open hunches
                  </Button>
                </div>
              </div>

              {/* ── RIGHT COLUMN — Activity ── */}
              <div className="lg:sticky lg:top-6">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Activity</h2>
                    {activity && activity.length > 0 && (
                      <Link
                        href="/tickets/activity"
                        className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        ver detalle
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
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.createdAt)}</p>
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
                            Ver todos ({activity.length} movimientos)
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No activity yet
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
