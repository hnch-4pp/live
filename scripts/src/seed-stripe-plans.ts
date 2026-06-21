/**
 * Provision Stripe subscription products for Hunches — MXN pricing.
 *
 * Run once (or re-run to update):
 *   pnpm --filter @workspace/scripts run seed-stripe-plans
 */

import Stripe from "stripe";

const PLANS = [
  {
    tierId: "pro",
    name: "Hunches Pro",
    amountCents: 19900,
    currency: "mxn",
    ticketsPerMonth: 20,
    description: "20 tickets por mes para hacer predicciones.",
  },
  {
    tierId: "elite",
    name: "Hunches Elite",
    amountCents: 29900,
    currency: "mxn",
    ticketsPerMonth: 50,
    description: "50 tickets por mes para hacer predicciones.",
  },
  {
    tierId: "legend",
    name: "Hunches Legend",
    amountCents: 49900,
    currency: "mxn",
    ticketsPerMonth: 100,
    description: "100 tickets por mes — acceso máximo.",
  },
];

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

  throw new Error(
    "No Stripe key found. Set STRIPE_SECRET_KEY or connect the Stripe integration in Replit.",
  );
}

async function main() {
  const secretKey = await getStripeKey();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-05-28.basil" });

  for (const plan of PLANS) {
    console.log(`\nProcessing: ${plan.tierId} — ${plan.name}`);

    const allProducts = await stripe.products.list({ limit: 100, active: true });
    const existing = allProducts.data.find(
      (p) => p.metadata?.tierId === plan.tierId,
    );

    let product: Stripe.Product;

    if (existing) {
      console.log(`  Updating existing product ${existing.id}...`);
      product = await stripe.products.update(existing.id, {
        name: plan.name,
        description: plan.description,
        metadata: {
          tierId: plan.tierId,
          ticketsPerMonth: String(plan.ticketsPerMonth),
        },
      });
    } else {
      console.log("  Creating product...");
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          tierId: plan.tierId,
          ticketsPerMonth: String(plan.ticketsPerMonth),
        },
      });
    }

    console.log(`  Product: ${product.id}`);

    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      type: "recurring",
      limit: 10,
    });

    const exactMatch = prices.data.find(
      (p) =>
        p.currency === plan.currency &&
        p.unit_amount === plan.amountCents &&
        p.recurring?.interval === "month",
    );

    if (exactMatch) {
      console.log(`  Price already correct: ${exactMatch.id} — no changes.`);
    } else {
      for (const old of prices.data) {
        console.log(`  Archiving old price ${old.id}...`);
        await stripe.prices.update(old.id, { active: false });
      }
      const newPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amountCents,
        currency: plan.currency,
        recurring: { interval: "month" },
        metadata: {
          tierId: plan.tierId,
          ticketsPerMonth: String(plan.ticketsPerMonth),
        },
      });
      console.log(
        `  Created price ${newPrice.id} — ${plan.currency.toUpperCase()} $${(plan.amountCents / 100).toFixed(0)}/mes`,
      );
    }
  }

  console.log("\nDone. All plans provisioned in Stripe.");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
