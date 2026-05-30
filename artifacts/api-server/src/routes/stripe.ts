import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, ticketTransactionsTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import type Stripe from "stripe";

const router: IRouter = Router();

// GET /stripe/ticket-packs — list one-time ticket packs via Stripe API
router.get("/stripe/ticket-packs", async (req, res): Promise<void> => {
  const debug = req.query["debug"] === "1";
  try {
    const stripe = await getUncachableStripeClient();

    // Use list (not search) — search requires indexing which can take hours
    const allProducts = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 100,
    });

    const packs = allProducts.data
      .filter((price) => {
        const product = price.product as Stripe.Product;
        return product.active && product.metadata?.type === "ticket_pack";
      })
      .map((price) => {
        const product = price.product as Stripe.Product;
        return {
          product_id: product.id,
          product_name: product.name,
          metadata: product.metadata,
          price_id: price.id,
          unit_amount: price.unit_amount ?? 0,
          currency: price.currency,
        };
      })
      .sort((a, b) => a.unit_amount - b.unit_amount);

    res.json({ data: packs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "ticket-packs fetch failed");
    if (debug) {
      res.status(500).json({ data: [], error: message });
    } else {
      res.json({ data: [] });
    }
  }
});

// POST /stripe/checkout — create a one-time Stripe Checkout Session for a ticket pack
router.post("/stripe/checkout", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { priceId, returnUrl } = req.body as { priceId?: string; returnUrl?: string };
  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  const base = (returnUrl ?? "https://hunch.fan").replace(/\/$/, "");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  // Retrieve price + its product to get metadata
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product as Stripe.Product;
  const ticketAmount = product.metadata?.ticketAmount ?? "1";
  const packName = product.name;

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(user.id) },
    });
    await db
      .update(usersTable)
      .set({ stripeCustomerId: customer.id })
      .where(eq(usersTable.id, user.id));
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      userId: String(user.id),
      ticketAmount,
      packName,
    },
    success_url: `${base}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/tickets`,
  });

  res.json({ url: session.url });
});

// GET /stripe/checkout-success — verify a completed session and award tickets (idempotent)
router.get("/stripe/checkout-success", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { session_id } = req.query as { session_id?: string };
  if (!session_id) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (session.payment_status !== "paid") {
    res.status(402).json({ error: "Payment not completed" });
    return;
  }

  const userId = Number(session.metadata?.userId);
  if (userId !== req.session.userId) {
    res.status(403).json({ error: "Session does not belong to you" });
    return;
  }

  const ticketAmount = Number(session.metadata?.ticketAmount ?? 1);
  const packName = session.metadata?.packName ?? "Ticket pack";

  // Idempotency: skip if this session was already processed
  const existing = await db
    .select({ id: ticketTransactionsTable.id })
    .from(ticketTransactionsTable)
    .where(
      and(
        eq(ticketTransactionsTable.reference, session_id),
        eq(ticketTransactionsTable.type, "purchase"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const [user] = await db
      .select({ tickets: usersTable.tickets })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    res.json({ ok: true, alreadyProcessed: true, tickets: user?.tickets ?? 0, ticketAmount });
    return;
  }

  // Award tickets atomically
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE users SET tickets = tickets + ${ticketAmount} WHERE id = ${userId}`,
    );
    await tx.insert(ticketTransactionsTable).values({
      userId,
      type: "purchase",
      amount: ticketAmount,
      label: `${packName} purchased`,
      reference: session_id,
    });
  });

  const [updatedUser] = await db
    .select({ tickets: usersTable.tickets })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.json({ ok: true, tickets: updatedUser?.tickets ?? 0, ticketAmount });
});

export default router;
