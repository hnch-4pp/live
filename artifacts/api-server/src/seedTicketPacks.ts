import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";

const PACK = {
  name: "Pack 5 Tickets",
  description: "5 tickets para hacer predicciones — pago único, sin suscripción.",
  amount: 7900,
  currency: "mxn",
  ticketAmount: "5",
  packId: "five_mxn",
};

const LEGACY_PACK_IDS = ["single", "five", "ten"];

export async function ensureTicketPacksExist(): Promise<void> {
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn("Stripe not configured — skipping ticket pack seed");
    return;
  }

  try {
    const existing = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });

    // Archive any legacy USD packs
    for (const price of existing.data) {
      const product = price.product as Stripe.Product;
      if (product.metadata?.type === "ticket_pack" && LEGACY_PACK_IDS.includes(product.metadata?.packId ?? "")) {
        logger.info({ packId: product.metadata?.packId, productId: product.id }, "Archiving legacy USD ticket pack");
        await stripe.products.update(product.id, { active: false });
        await stripe.prices.update(price.id, { active: false });
      }
    }

    // Check if new MXN pack already exists
    const allAfterArchive = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
    const alreadyExists = allAfterArchive.data.some((p) => {
      const prod = p.product as Stripe.Product;
      return prod.metadata?.packId === PACK.packId;
    });

    if (alreadyExists) {
      logger.info({ packId: PACK.packId }, "MXN ticket pack already exists — skipping");
      return;
    }

    const product = await stripe.products.create({
      name: PACK.name,
      description: PACK.description,
      metadata: { type: "ticket_pack", ticketAmount: PACK.ticketAmount, packId: PACK.packId },
    });

    await stripe.prices.create({
      product: product.id,
      unit_amount: PACK.amount,
      currency: PACK.currency,
    });

    logger.info({ packId: PACK.packId, productId: product.id }, "MXN ticket pack created in Stripe");
    logger.info("Ticket pack seed complete");
  } catch (err: unknown) {
    logger.error({ err }, "Failed to seed ticket packs — continuing without them");
  }
}
