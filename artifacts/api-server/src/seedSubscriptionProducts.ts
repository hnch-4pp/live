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

    // Map tierId → existing price
    const existingByTier = new Map<string, Stripe.Price>(
      existing.data
        .filter((p) => (p.product as Stripe.Product).metadata?.tierId)
        .map((p) => [(p.product as Stripe.Product).metadata.tierId, p]),
    );

    for (const tier of PAID_TIERS) {
      const existing = existingByTier.get(tier.id);

      if (existing) {
        if (existing.unit_amount === tier.amountCents) {
          logger.info({ tierId: tier.id }, "Subscription product already exists — skipping");
          continue;
        }

        // Price changed — archive old price and create new one on same product
        logger.info(
          { tierId: tier.id, oldCents: existing.unit_amount, newCents: tier.amountCents },
          "Subscription price changed — archiving old price and creating new one",
        );
        await stripe.prices.update(existing.id, { active: false });
        await stripe.prices.create({
          product: (existing.product as Stripe.Product).id,
          unit_amount: tier.amountCents,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { tierId: tier.id },
        });

        logger.info({ tierId: tier.id }, "Subscription price updated in Stripe");
        continue;
      }

      // No product yet — create product + price from scratch
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
