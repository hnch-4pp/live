import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Ticket, Package, Sparkles, Star, Zap, Crown,
  CheckCircle2, ArrowRight, Gift,
} from "lucide-react";

const PASSES = [
  {
    id: "free",
    icon: <Ticket className="w-5 h-5" />,
    label: "Free",
    tickets: 5,
    amountCents: 0,
    highlight: true,
    badge: "Always free",
    cta: "Start playing",
    features: [
      "5 tickets every month, automatically",
      "Access to all prediction categories",
      "Community leaderboard",
      "Real prizes — no purchase required",
    ],
  },
  {
    id: "starter",
    icon: <Package className="w-5 h-5" />,
    label: "Starter",
    tickets: 10,
    amountCents: 699,
    highlight: false,
    badge: null,
    cta: "Get Starter",
    features: [
      "10 tickets every month",
      "Everything in Free",
      "Early access to new hunches",
    ],
  },
  {
    id: "plus",
    icon: <Star className="w-5 h-5" />,
    label: "Plus",
    tickets: 25,
    amountCents: 1399,
    highlight: false,
    badge: null,
    cta: "Get Plus",
    features: [
      "25 tickets every month",
      "Everything in Starter",
      "Priority prediction placement",
    ],
  },
  {
    id: "pro",
    icon: <Zap className="w-5 h-5" />,
    label: "Pro",
    tickets: 100,
    amountCents: 2999,
    highlight: false,
    badge: "Most popular",
    cta: "Get Pro",
    features: [
      "100 tickets every month",
      "Everything in Plus",
      "Exclusive Pro-only hunches",
    ],
  },
  {
    id: "elite",
    icon: <Crown className="w-5 h-5" />,
    label: "Elite",
    tickets: 250,
    amountCents: 4999,
    highlight: false,
    badge: null,
    cta: "Get Elite",
    features: [
      "250 tickets every month",
      "Everything in Pro",
      "VIP prize access",
      "Dedicated support",
    ],
  },
];

const PACKS = [
  { icon: <Ticket className="w-4 h-4" />,    label: "Single",  tickets: 1,  price: "$0.99", badge: null },
  { icon: <Package className="w-4 h-4" />,   label: "5-Pack",  tickets: 5,  price: "$4.49", badge: null },
  { icon: <Sparkles className="w-4 h-4" />,  label: "10-Pack", tickets: 10, price: "$7.99", badge: "Best value" },
];

function fmt$(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function costPerTicket(cents: number, tickets: number) {
  if (cents === 0) return null;
  return `$${(cents / 100 / tickets).toFixed(2)}/ticket`;
}

export default function Pricing() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">

        {/* ── Hero ── */}
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <Gift className="w-3.5 h-3.5" />
              No purchase ever required
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-gray-900 mb-5 leading-tight">
              Play free, forever.
              <br />
              <span className="text-violet-600">Win real prizes.</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
              Every account gets 5 free tickets every month — no card needed, no strings attached.
              Buy more if you want to play more, or upgrade for a monthly pass.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-7 py-3.5 rounded-xl transition-colors shadow-sm">
              Start playing free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-400 mt-3">No credit card required</p>
          </div>
        </section>

        {/* ── Monthly passes ── */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Monthly Passes</h2>
            <p className="text-gray-500 text-sm">Tickets delivered every month. Cancel any time.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PASSES.map((pass) => {
              const isFree = pass.amountCents === 0;
              const perTicket = costPerTicket(pass.amountCents, pass.tickets);
              return (
                <div key={pass.id} className={`relative rounded-2xl border flex flex-col p-5 transition-shadow ${
                  pass.highlight
                    ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200"
                    : "bg-white border-gray-200 text-gray-900"
                }`}>

                  {pass.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
                      pass.highlight
                        ? "bg-white text-violet-600"
                        : "bg-violet-600 text-white"
                    }`}>
                      {pass.badge}
                    </div>
                  )}

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
                    pass.highlight ? "bg-white/20" : "bg-violet-50 text-violet-600"
                  }`}>
                    {pass.icon}
                  </div>

                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${pass.highlight ? "text-white/70" : "text-gray-400"}`}>
                    {pass.label}
                  </p>

                  <div className="mb-1">
                    <span className="text-3xl font-extrabold">
                      {isFree ? "Free" : fmt$(pass.amountCents)}
                    </span>
                    {!isFree && (
                      <span className={`text-xs font-medium ml-1 ${pass.highlight ? "text-white/60" : "text-gray-400"}`}>/mo</span>
                    )}
                  </div>

                  <p className={`text-sm font-semibold mb-1 ${pass.highlight ? "text-white/90" : "text-gray-700"}`}>
                    {pass.tickets} tickets/month
                  </p>

                  {perTicket && (
                    <p className={`text-xs mb-4 ${pass.highlight ? "text-white/60" : "text-gray-400"}`}>
                      {perTicket}
                    </p>
                  )}
                  {!perTicket && <div className="mb-4" />}

                  <ul className={`space-y-2 mb-5 flex-1 ${pass.highlight ? "text-white/80" : "text-gray-500"}`}>
                    {pass.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${pass.highlight ? "text-white" : "text-violet-500"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href={isFree ? "/signup" : "/tickets"}
                    className={`block text-center text-sm font-bold py-2.5 rounded-xl transition-colors ${
                      pass.highlight
                        ? "bg-white text-violet-600 hover:bg-violet-50"
                        : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                    }`}>
                    {pass.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Ticket packs ── */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Ticket Packs</h2>
            <p className="text-gray-500 text-sm">Need more tickets this month? Top up anytime with a one-time pack.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PACKS.map((pack) => (
              <div key={pack.label} className="relative bg-white border border-gray-200 rounded-2xl p-6 text-center hover:border-violet-300 hover:shadow-sm transition-all">
                {pack.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    {pack.badge}
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
                  {pack.icon}
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{pack.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 mb-1">{pack.price}</p>
                <p className="text-sm text-gray-500 mb-4">
                  {pack.tickets} ticket{pack.tickets > 1 ? "s" : ""}
                  <span className="text-gray-400 text-xs block">${(parseFloat(pack.price.slice(1)) / pack.tickets).toFixed(2)}/ticket</span>
                </p>
                <Link href="/tickets"
                  className="block text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 py-2.5 rounded-xl transition-colors">
                  Buy pack
                </Link>
              </div>
            ))}
          </div>

          {/* Free play callout */}
          <div className="mt-10 bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl p-6 text-white text-center">
            <Gift className="w-8 h-8 mx-auto mb-3 opacity-90" />
            <h3 className="text-lg font-bold mb-1">Remember — you can always play free</h3>
            <p className="text-sm text-white/80 mb-4 max-w-md mx-auto">
              Every Hunches account receives 5 free tickets at the start of each month.
              No credit card, no commitment — just sign up and start making predictions.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-violet-50 transition-colors">
              Create free account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ── Legal disclaimer ── */}
        <section className="border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-8 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              Hunches is a skill-based prediction platform. Tickets are used to make predictions and are not money, currency, or a financial instrument. No purchase is necessary to play — free tickets are provided to all users monthly. Prizes are awarded as Amazon gift cards, Starbucks cards, or branded merchandise. This is not gambling.
            </p>
          </div>
        </section>

      </div>
    </Layout>
  );
}
