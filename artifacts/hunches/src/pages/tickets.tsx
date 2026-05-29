import { Link, useLocation } from "wouter";
import { apiUrl } from "@/lib/apiFetch";
import { Ticket, ArrowLeft, Info, Gift, Tag, ShoppingBag, MinusCircle, Sparkles, Package, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

type TxType = "welcome" | "promo" | "purchase" | "spent";

interface TicketTransaction {
  id: number;
  userId: number;
  type: TxType;
  amount: number;
  label: string;
  reference: string | null;
  createdAt: string;
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

function txIcon(type: TxType) {
  switch (type) {
    case "welcome": return <Gift className="w-4 h-4" />;
    case "promo":   return <Tag className="w-4 h-4" />;
    case "purchase": return <ShoppingBag className="w-4 h-4" />;
    case "spent":   return <MinusCircle className="w-4 h-4" />;
  }
}

function txColors(type: TxType): { dot: string; icon: string; badge: string } {
  switch (type) {
    case "welcome":  return { dot: "bg-violet-500", icon: "text-violet-600 bg-violet-100", badge: "bg-violet-100 text-violet-700" };
    case "promo":    return { dot: "bg-emerald-500", icon: "text-emerald-600 bg-emerald-100", badge: "bg-emerald-100 text-emerald-700" };
    case "purchase": return { dot: "bg-sky-500", icon: "text-sky-600 bg-sky-100", badge: "bg-sky-100 text-sky-700" };
    case "spent":    return { dot: "bg-slate-400", icon: "text-slate-500 bg-slate-100", badge: "bg-slate-100 text-slate-600" };
  }
}

function txSubtitle(tx: TicketTransaction): string {
  if (tx.type === "welcome")  return "3 tickets added to your account at signup";
  if (tx.type === "promo")    return tx.reference ? `Code: ${tx.reference}` : "Promotional code redeemed";
  if (tx.type === "purchase") return tx.reference ? `Order #${tx.reference}` : "Ticket purchase";
  if (tx.type === "spent")    return "Used for a prediction";
  return "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

const PURCHASE_OPTIONS = [
  { id: "single", icon: <Ticket className="w-5 h-5" />, label: "Single ticket", price: "$0.99", tickets: 1, badge: null },
  { id: "starter", icon: <Package className="w-5 h-5" />, label: "Starter pack", price: "$3.99", tickets: 5, badge: "Most popular" },
  { id: "pro", icon: <Sparkles className="w-5 h-5" />, label: "Pro pack", price: "$6.99", tickets: 10, badge: "Best value" },
  { id: "sub", icon: <RefreshCw className="w-5 h-5" />, label: "Monthly pass", price: "$9.99/mo", tickets: 15, badge: "Subscription" },
];

export default function TicketsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: activity, isLoading: activityLoading } = useTicketActivity();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const isLoading = authLoading;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to hunches
        </Link>

        <h1 className="font-display font-bold text-3xl text-foreground mb-1">My Tickets</h1>
        <p className="text-muted-foreground text-sm mb-8">Tickets let you enter predictions and compete for prizes.</p>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded-2xl animate-pulse" />
            <div className="h-48 bg-muted rounded-2xl animate-pulse" />
          </div>
        ) : user ? (
          <>
            {/* Balance card */}
            <div className="bg-card border border-primary/20 rounded-2xl p-6 card-shadow mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current balance</p>
                  <p className="text-4xl font-display font-bold text-foreground leading-none mt-0.5">
                    {user.tickets}
                    <span className="text-lg font-medium text-muted-foreground ml-2">ticket{user.tickets !== 1 ? "s" : ""}</span>
                  </p>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (user.tickets / 10) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{user.tickets} of 10 shown</p>
            </div>

            {/* Activity timeline */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Activity</h2>

              {activityLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />

                  <div className="space-y-0">
                    {activity.map((tx, idx) => {
                      const c = txColors(tx.type);
                      const isLast = idx === activity.length - 1;
                      return (
                        <div key={tx.id} className="relative flex gap-3 pb-4">
                          {/* Dot */}
                          <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                            {txIcon(tx.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground leading-tight">{tx.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{txSubtitle(tx)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount} ticket{Math.abs(tx.amount) !== 1 ? "s" : ""}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground bg-muted/40 rounded-xl">
                  No activity yet
                </div>
              )}
            </div>

            {/* Get more tickets */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Get more tickets</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PURCHASE_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    className="relative bg-muted/60 border border-border rounded-xl p-4 opacity-60 select-none"
                  >
                    {opt.badge && (
                      <span className="absolute -top-2 left-3 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                        {opt.badge}
                      </span>
                    )}
                    <div className="text-muted-foreground mb-2">{opt.icon}</div>
                    <p className="text-sm font-semibold text-foreground leading-tight">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.tickets} ticket{opt.tickets !== 1 ? "s" : ""}</p>
                    <p className="text-sm font-bold text-primary mt-2">{opt.price}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
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
                <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Every new account starts with 3 tickets.</li>
                <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Each prediction you make costs at least 1 ticket.</li>
                <li className="flex gap-2"><span className="text-primary font-bold mt-0.5">–</span>Higher-stakes hunches may cost more tickets to enter.</li>
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
          </>
        ) : null}
      </div>
    </Layout>
  );
}
