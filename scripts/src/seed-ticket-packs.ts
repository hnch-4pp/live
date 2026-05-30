import { getUncachableStripeClient } from "./stripeClient";

const PACKS = [
  { name: "Single Ticket", description: "1 ticket to enter your next prediction.", amount: 99,  currency: "usd", ticketAmount: "1",  packId: "single" },
  { name: "5-Ticket Pack",  description: "5 tickets — great for active players.",   amount: 449, currency: "usd", ticketAmount: "5",  packId: "five"   },
  { name: "10-Ticket Pack", description: "10 tickets — best value one-time pack.",  amount: 799, currency: "usd", ticketAmount: "10", packId: "ten"    },
];

async function seedTicketPacks() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding ticket packs into Stripe...\n");

  for (const pack of PACKS) {
    // Check if already exists
    const existing = await stripe.products.search({
      query: `metadata['packId']:'${pack.packId}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`  [skip] ${pack.name} already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: pack.name,
      description: pack.description,
      metadata: {
        type: "ticket_pack",
        ticketAmount: pack.ticketAmount,
        packId: pack.packId,
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: pack.currency,
    });

    console.log(`  [ok]   ${pack.name} → product ${product.id}, price ${price.id} ($${pack.amount / 100})`);
  }

  console.log("\nDone. Webhook sync will populate stripe.products + stripe.prices tables.");
}

seedTicketPacks().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
