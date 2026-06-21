import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Zap, Crown, Star, CheckCircle2, ArrowRight, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";

function fmtMXN(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function perTicketMXN(cents: number, tickets: number) {
  return `$${(cents / 100 / tickets).toFixed(1)} MXN/ticket`;
}

export default function Pricing() {
  const { t } = useTranslation();

  const PLANS = [
    {
      id: "pro",
      icon: <Zap className="w-5 h-5" />,
      label: "Pro",
      tickets: 20,
      amountCents: 19900,
      highlight: true,
      badge: t("pricing_pro_badge"),
      cta: t("pricing_pro_cta"),
      features: [
        t("pricing_pro_f1"),
        t("pricing_pro_f2"),
        t("pricing_pro_f3"),
        t("pricing_pro_f4"),
      ],
    },
    {
      id: "elite",
      icon: <Star className="w-5 h-5" />,
      label: "Elite",
      tickets: 50,
      amountCents: 29900,
      highlight: false,
      badge: "",
      cta: t("pricing_elite_cta"),
      features: [
        t("pricing_elite_f1"),
        t("pricing_elite_f2"),
        t("pricing_elite_f3"),
        t("pricing_elite_f4"),
      ],
    },
    {
      id: "legend",
      icon: <Crown className="w-5 h-5" />,
      label: "Legend",
      tickets: 100,
      amountCents: 49900,
      highlight: false,
      badge: t("pricing_legend_badge"),
      cta: t("pricing_legend_cta"),
      features: [
        t("pricing_legend_f1"),
        t("pricing_legend_f2"),
        t("pricing_legend_f3"),
        t("pricing_legend_f4"),
      ],
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">

        {/* ── Hero ── */}
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <Gift className="w-3.5 h-3.5" />
              {t("pricing_badge")}
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-gray-900 mb-5 leading-tight">
              {t("pricing_hero_h1_1")}
              <br />
              <span className="text-violet-600">{t("pricing_hero_h1_2")}</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
              {t("pricing_hero_sub")}
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-7 py-3.5 rounded-xl transition-colors shadow-sm"
            >
              {t("pricing_start_free")}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-400 mt-3">{t("pricing_no_card")}</p>
          </div>
        </section>

        {/* ── Plans ── */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">
              {t("pricing_passes_title")}
            </h2>
            <p className="text-gray-500 text-sm">{t("pricing_passes_sub")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border flex flex-col p-6 transition-shadow ${
                  plan.highlight
                    ? "bg-violet-600 border-violet-600 text-white shadow-xl shadow-violet-200"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {plan.badge ? (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
                      plan.highlight
                        ? "bg-white text-violet-600"
                        : "bg-violet-600 text-white"
                    }`}
                  >
                    {plan.badge}
                  </div>
                ) : null}

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${
                    plan.highlight
                      ? "bg-white/20"
                      : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {plan.icon}
                </div>

                <p
                  className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                    plan.highlight ? "text-white/70" : "text-gray-400"
                  }`}
                >
                  {plan.label}
                </p>

                <div className="mb-1 flex items-end gap-1">
                  <span className="text-4xl font-extrabold">
                    {fmtMXN(plan.amountCents)}
                  </span>
                  <span
                    className={`text-sm font-medium mb-1 ${
                      plan.highlight ? "text-white/60" : "text-gray-400"
                    }`}
                  >
                    MXN/mes
                  </span>
                </div>

                <p
                  className={`text-sm font-semibold mb-1 ${
                    plan.highlight ? "text-white/90" : "text-gray-700"
                  }`}
                >
                  {t("pricing_tickets_month", { n: plan.tickets })}
                </p>

                <p
                  className={`text-xs mb-5 ${
                    plan.highlight ? "text-white/60" : "text-gray-400"
                  }`}
                >
                  {perTicketMXN(plan.amountCents, plan.tickets)}
                </p>

                <ul
                  className={`space-y-2.5 mb-6 flex-1 ${
                    plan.highlight ? "text-white/80" : "text-gray-500"
                  }`}
                >
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          plan.highlight ? "text-white" : "text-violet-500"
                        }`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/tickets"
                  className={`block text-center text-sm font-bold py-3 rounded-xl transition-colors ${
                    plan.highlight
                      ? "bg-white text-violet-600 hover:bg-violet-50"
                      : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── Welcome callout ── */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl p-8 text-white text-center">
            <Gift className="w-8 h-8 mx-auto mb-3 opacity-90" />
            <h3 className="text-xl font-bold mb-2">
              {t("pricing_welcome_callout_title")}
            </h3>
            <p className="text-sm text-white/80 mb-5 max-w-md mx-auto">
              {t("pricing_welcome_callout_sub")}
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-violet-50 transition-colors"
            >
              {t("pricing_create_free")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ── Legal disclaimer ── */}
        <section className="border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-8 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              {t("pricing_disclaimer")}
            </p>
          </div>
        </section>

      </div>
    </Layout>
  );
}
