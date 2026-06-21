export const SUBSCRIPTION_TIERS = {
  pro: {
    id: "pro",
    name: "Pro",
    ticketsPerMonth: 20,
    amountCents: 19900,
    currency: "mxn",
    description: "20 tickets por mes.",
  },
  elite: {
    id: "elite",
    name: "Elite",
    ticketsPerMonth: 50,
    amountCents: 29900,
    currency: "mxn",
    description: "50 tickets por mes.",
  },
  legend: {
    id: "legend",
    name: "Legend",
    ticketsPerMonth: 100,
    amountCents: 49900,
    currency: "mxn",
    description: "100 tickets por mes — acceso máximo.",
  },
} as const;

export type TierId = keyof typeof SUBSCRIPTION_TIERS;
export type TierConfig = (typeof SUBSCRIPTION_TIERS)[TierId];

export const PAID_TIERS = Object.values(SUBSCRIPTION_TIERS) as TierConfig[];
