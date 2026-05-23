import { Link, useLocation } from "wouter";
import { Ticket, ArrowLeft, Info } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function TicketsPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (!isLoading && !user) {
    setLocation("/login");
    return null;
  }

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
          <div className="h-32 bg-muted rounded-2xl animate-pulse" />
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
