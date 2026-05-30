export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    ticketsPerMonth: 15,
    amountCents: 0,
    description: "15 free tickets every month, always.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    ticketsPerMonth: 50,
    amountCents: 499,
    description: "50 tickets per month for active players.",
  },
  plus: {
    id: "plus",
    name: "Plus",
    ticketsPerMonth: 150,
    amountCents: 1299,
    description: "150 tickets per month.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    ticketsPerMonth: 400,
    amountCents: 2499,
    description: "400 tickets per month for serious competitors.",
  },
  elite: {
    id: "elite",
    name: "Elite",
    ticketsPerMonth: 1000,
    amountCents: 4999,
    description: "1000 tickets per month — maximum access.",
  },
} as const;

export type TierId = keyof typeof SUBSCRIPTION_TIERS;
export type TierConfig = (typeof SUBSCRIPTION_TIERS)[TierId];

export const PAID_TIERS = (Object.values(SUBSCRIPTION_TIERS) as TierConfig[]).filter(
  (t) => t.amountCents > 0,
);
