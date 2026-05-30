import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";
import { PAID_TIERS } from "./subscriptionTiers";

export async function ensureSubscriptionProductsExist(): Promise<void> {
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn("Stripe not configured — skipping subscription product seed");
    return;
  }

  try {
    // List all active recurring prices to find existing subscription products
    const existing = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 100,
    });

    const existingTierIds = new Set(
      existing.data
        .map((p) => (p.product as Stripe.Product).metadata?.tierId)
        .filter(Boolean),
    );

    for (const tier of PAID_TIERS) {
      if (existingTierIds.has(tier.id)) {
        logger.info({ tierId: tier.id }, "Subscription product already exists — skipping");
        continue;
      }

      const product = await stripe.products.create({
        name: tier.name,
        description: tier.description,
        metadata: {
          type: "subscription",
          tierId: tier.id,
          ticketsPerMonth: String(tier.ticketsPerMonth),
        },
      });

      await stripe.prices.create({
        product: product.id,
        unit_amount: tier.amountCents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { tierId: tier.id },
      });

      logger.info({ tierId: tier.id, productId: product.id }, "Subscription product created in Stripe");
    }

    logger.info("Subscription product seed complete");
  } catch (err: unknown) {
    logger.error({ err }, "Failed to seed subscription products — continuing");
  }
}
