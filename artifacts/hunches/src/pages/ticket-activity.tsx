import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiFetch";
import { txIcon, txColors, txSubtitle } from "@/pages/tickets";

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

type SortDir = "desc" | "asc";

function formatFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function TicketActivityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const { data: activity = [], isLoading } = useQuery<TicketTransaction[]>({
    queryKey: ["ticket-activity"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/auth/tickets/activity"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json() as Promise<TicketTransaction[]>;
    },
    staleTime: 30_000,
    enabled: !!user,
  });

  const sorted = [...activity].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sortDir === "desc" ? diff : -diff;
  });

  const totalIn  = activity.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = activity.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">

        {/* Back */}
        <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          My Tickets
        </Link>

        <div className="flex items-end justify-between mb-2">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">Historial</h1>
            <p className="text-muted-foreground text-sm mt-1">Todos tus movimientos de tickets</p>
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 transition-colors"
          >
            {sortDir === "desc"
              ? <><ArrowDown className="w-3.5 h-3.5" /> Más reciente</>
              : <><ArrowUp className="w-3.5 h-3.5" /> Más antiguo</>
            }
          </button>
        </div>

        {/* Summary row */}
        {!isLoading && activity.length > 0 && (
          <div className="flex gap-4 mb-8 mt-4">
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Recibidos</p>
              <p className="text-xl font-bold text-emerald-700 mt-0.5">+{totalIn} tickets</p>
            </div>
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Usados</p>
              <p className="text-xl font-bold text-slate-600 mt-0.5">{totalOut} tickets</p>
            </div>
            <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide">Movimientos</p>
              <p className="text-xl font-bold text-primary mt-0.5">{activity.length}</p>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground bg-muted/40 rounded-xl">
            Sin movimientos todavia
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((tx, idx) => {
              const c = txColors(tx.type);
              const isFirst = idx === 0;
              const isLast = idx === sorted.length - 1;
              const showDateDivider = idx === 0 || (
                new Date(sorted[idx - 1].createdAt).toDateString() !== new Date(tx.createdAt).toDateString()
              );

              const dateLabel = (() => {
                const d = new Date(tx.createdAt);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
                if (diffDays === 0) return "Hoy";
                if (diffDays === 1) return "Ayer";
                return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
              })();

              return (
                <div key={tx.id}>
                  {showDateDivider && (
                    <div className={`flex items-center gap-3 ${isFirst ? "mb-3" : "mt-6 mb-3"}`}>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{dateLabel}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-4 hover:border-primary/20 transition-colors">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                      {txIcon(tx.type)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tx.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{txSubtitle(tx)}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{formatFull(tx.createdAt)}</p>
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-base font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ticket{Math.abs(tx.amount) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-12" />
      </div>
    </Layout>
  );
}
