import { useEffect, useState } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { CheckCircle, Ticket, AlertCircle, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/apiFetch";
import { useTranslation } from "react-i18next";

type Status = "loading" | "success" | "error";

export default function CheckoutSuccessPage() {
  const { t } = useTranslation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session_id");
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [ticketAmount, setTicketAmount] = useState(0);
  const [newBalance, setNewBalance] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/stripe/checkout-success?session_id=${encodeURIComponent(sessionId)}`),
          { credentials: "include" },
        );

        if (res.status === 401) {
          setLocation("/login");
          return;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          tickets?: number;
          ticketAmount?: number;
        };

        if (data.ok) {
          setTicketAmount(data.ticketAmount ?? 0);
          setNewBalance(data.tickets ?? 0);
          setStatus("success");
          await refetch();
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [sessionId]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-20 max-w-sm text-center">
        {status === "loading" && (
          <div className="space-y-5">
            <div className="w-16 h-16 bg-muted rounded-full animate-pulse mx-auto" />
            <div className="h-6 bg-muted rounded-lg animate-pulse w-48 mx-auto" />
            <div className="h-4 bg-muted rounded-lg animate-pulse w-64 mx-auto" />
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>

            <div>
              <h1 className="font-display font-bold text-2xl text-foreground mb-2">
                {t("checkout_success_title")}
              </h1>
              <p className="text-muted-foreground text-sm">
                {ticketAmount !== 1
                  ? t("checkout_tickets_added_plural", { count: ticketAmount })
                  : t("checkout_tickets_added", { count: ticketAmount })}
              </p>
            </div>

            <div className="bg-card border border-primary/20 rounded-2xl p-6 card-shadow">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {t("checkout_new_balance")}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                <span className="text-4xl font-display font-bold text-foreground">
                  {newBalance}
                </span>
                <span className="text-muted-foreground font-medium">
                  ticket{newBalance !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Link href="/tickets">
                <Button className="w-full bg-primary text-white hover:bg-primary/90 font-bold rounded-xl h-12">
                  {t("checkout_view_tickets")}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full rounded-xl h-12">
                  {t("checkout_browse")}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground mb-2">
                {t("checkout_error_title")}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("checkout_error_desc")}
              </p>
              {sessionId && (
                <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted rounded px-2 py-1 break-all">
                  {sessionId}
                </p>
              )}
            </div>
            <Link href="/tickets">
              <Button className="w-full rounded-xl h-12">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("checkout_back")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
