export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    ticketsPerMonth: 5,
    amountCents: 0,
    description: "5 free tickets every month, always.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    ticketsPerMonth: 10,
    amountCents: 699,
    description: "10 tickets per month.",
  },
  plus: {
    id: "plus",
    name: "Plus",
    ticketsPerMonth: 25,
    amountCents: 1399,
    description: "25 tickets per month.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    ticketsPerMonth: 100,
    amountCents: 2999,
    description: "100 tickets per month.",
  },
  elite: {
    id: "elite",
    name: "Elite",
    ticketsPerMonth: 250,
    amountCents: 4999,
    description: "250 tickets per month — maximum access.",
  },
} as const;

export type TierId = keyof typeof SUBSCRIPTION_TIERS;
export type TierConfig = (typeof SUBSCRIPTION_TIERS)[TierId];

export const PAID_TIERS = (Object.values(SUBSCRIPTION_TIERS) as TierConfig[]).filter(
  (t) => t.amountCents > 0,
);
