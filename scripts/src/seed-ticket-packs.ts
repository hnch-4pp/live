/**
 * Migrate Stripe ticket packs: archive old USD packs (single/five/ten) and
 * create the new single MXN 5-ticket pack at $79 MXN (one-time payment).
 *
 * Run once:
 *   pnpm --filter @workspace/scripts run seed-ticket-packs
 */

import Stripe from "stripe";

const PACK = {
  name: "Pack 5 Tickets",
  description: "5 tickets para hacer predicciones — pago único, sin suscripción.",
  amount: 7900,
  currency: "mxn",
  ticketAmount: "5",
  packId: "five_mxn",
};

const LEGACY_PACK_IDS = ["single", "five", "ten"];

async function getStripeKey(): Promise<string> {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment", "development");

    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      const data = await resp.json() as {
        items?: Array<{ settings: { secret: string } }>;
      };
      const secret = data.items?.[0]?.settings?.secret;
      if (secret) return secret;
    }
  }

  throw new Error("No Stripe key found. Set STRIPE_SECRET_KEY or connect the Stripe integration.");
}

async function main() {
  const secretKey = await getStripeKey();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-05-28.basil" });

  console.log("Fetching all active prices...");
  const existing = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });

  for (const price of existing.data) {
    const product = price.product as Stripe.Product;
    if (product.metadata?.type === "ticket_pack" && LEGACY_PACK_IDS.includes(product.metadata?.packId ?? "")) {
      console.log(`  Archiving legacy pack: ${product.name} (packId: ${product.metadata?.packId})`);
      await stripe.products.update(product.id, { active: false });
      await stripe.prices.update(price.id, { active: false });
      console.log(`  Archived.`);
    }
  }

  const fresh = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
  const alreadyExists = fresh.data.some((p) => (p.product as Stripe.Product).metadata?.packId === PACK.packId);

  if (alreadyExists) {
    console.log(`\nMXN pack "${PACK.packId}" already exists — nothing to create.`);
  } else {
    console.log(`\nCreating: ${PACK.name} — MXN $${(PACK.amount / 100).toFixed(0)} (one-time)...`);
    const product = await stripe.products.create({
      name: PACK.name,
      description: PACK.description,
      metadata: { type: "ticket_pack", ticketAmount: PACK.ticketAmount, packId: PACK.packId },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: PACK.amount,
      currency: PACK.currency,
    });
    console.log(`  Product: ${product.id}`);
    console.log(`  Price:   ${price.id}`);
  }

  console.log("\nDone.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
