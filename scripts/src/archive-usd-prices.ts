/**
 * Archive any USD recurring prices that still have tierId metadata (legacy plans).
 * Run once:  pnpm --filter @workspace/scripts run archive-usd-prices
 */
import Stripe from "stripe";

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
      const data = await resp.json() as { items?: Array<{ settings: { secret: string } }> };
      const secret = data.items?.[0]?.settings?.secret;
      if (secret) return secret;
    }
  }
  throw new Error("No Stripe key found.");
}

async function main() {
  const stripe = new Stripe(await getStripeKey(), { apiVersion: "2025-05-28.basil" });

  const prices = await stripe.prices.list({ active: true, type: "recurring", expand: ["data.product"], limit: 100 });

  let archived = 0;
  for (const price of prices.data) {
    const product = price.product as Stripe.Product;
    if (product.deleted) continue;
    if (product.metadata?.tierId && price.currency !== "mxn") {
      console.log(`  Archiving ${price.currency.toUpperCase()} price ${price.id} — ${product.name} (tierId=${product.metadata.tierId})`);
      await stripe.prices.update(price.id, { active: false });
      archived++;
    }
  }

  console.log(`\nDone. Archived ${archived} non-MXN price(s).`);
}

main().catch((err: unknown) => { console.error(err); process.exit(1); });
