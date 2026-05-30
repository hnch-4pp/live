import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";

const PACKS = [
  { name: "Single Ticket", description: "1 ticket to enter your next prediction.", amount: 99,  currency: "usd", ticketAmount: "1",  packId: "single" },
  { name: "5-Ticket Pack",  description: "5 tickets — great for active players.",   amount: 449, currency: "usd", ticketAmount: "5",  packId: "five"   },
  { name: "10-Ticket Pack", description: "10 tickets — best value one-time pack.",  amount: 799, currency: "usd", ticketAmount: "10", packId: "ten"    },
];

export async function ensureTicketPacksExist(): Promise<void> {
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn("Stripe not configured — skipping ticket pack seed");
    return;
  }

  try {
    // Use list (not search) to avoid indexing delays
    const existing = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
    const existingPackIds = new Set(
      existing.data
        .map((p) => (p.product as Stripe.Product).metadata?.packId)
        .filter(Boolean),
    );

    for (const pack of PACKS) {
      if (existingPackIds.has(pack.packId)) {
        logger.info({ packId: pack.packId }, "Ticket pack already exists — skipping");
        continue;
      }

      const product = await stripe.products.create({
        name: pack.name,
        description: pack.description,
        metadata: { type: "ticket_pack", ticketAmount: pack.ticketAmount, packId: pack.packId },
      });

      await stripe.prices.create({
        product: product.id,
        unit_amount: pack.amount,
        currency: pack.currency,
      });

      logger.info({ packId: pack.packId, productId: product.id }, "Ticket pack created in Stripe");
    }

    logger.info("Ticket pack seed complete");
  } catch (err: unknown) {
    logger.error({ err }, "Failed to seed ticket packs — continuing without them");
  }
}
