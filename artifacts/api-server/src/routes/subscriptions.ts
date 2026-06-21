import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { SUBSCRIPTION_TIERS, type TierId } from "../subscriptionTiers";
import type Stripe from "stripe";

const AFFILIATE_COUPON_ID = "HUNCH_AFFILIATE_50OFF_FIRST";

async function getOrCreateAffiliateCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(AFFILIATE_COUPON_ID);
    return AFFILIATE_COUPON_ID;
  } catch {
    await stripe.coupons.create({
      id: AFFILIATE_COUPON_ID,
      percent_off: 50,
      duration: "once",
      name: "Affiliate Referral — 50% off first month",
    });
    return AFFILIATE_COUPON_ID;
  }
}

const router: IRouter = Router();

// GET /stripe/my-subscription — current user's active subscription
router.get("/stripe/my-subscription", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, req.session.userId),
        eq(subscriptionsTable.status, "active"),
      ),
    )
    .limit(1);

  if (!sub) {
    res.json({ subscription: null, tier: "free" });
    return;
  }

  res.json({
    subscription: {
      id: sub.id,
      tier: sub.tier,
      ticketsPerMonth: sub.ticketsPerMonth,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
    tier: sub.tier,
  });
});

// POST /stripe/subscribe — start a subscription checkout session
router.post("/stripe/subscribe", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { tierId, returnUrl, referralDiscount } = req.body as { tierId?: TierId; returnUrl?: string; referralDiscount?: boolean };
  if (!tierId || !SUBSCRIPTION_TIERS[tierId]) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  const tier = SUBSCRIPTION_TIERS[tierId];
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

  // Find the Stripe price for this tier
  const prices = await stripe.prices.list({
    active: true,
    type: "recurring",
    expand: ["data.product"],
    limit: 100,
  });

  const matchedPrice = prices.data.find((p) => {
    const product = p.product as import("stripe").Stripe.Product;
    return product.metadata?.tierId === tierId;
  });

  if (!matchedPrice) {
    res.status(404).json({ error: "Subscription product not found in Stripe" });
    return;
  }

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

  // Check if already subscribed — if so, redirect to portal to manage
  const [existingSub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, user.id),
        eq(subscriptionsTable.status, "active"),
      ),
    )
    .limit(1);

  if (existingSub) {
    // Already has a subscription — send to portal to change plan
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/tickets`,
    });
    res.json({ url: portalSession.url });
    return;
  }

  // Apply 50% affiliate referral discount on first month if requested
  const discounts: { coupon: string }[] = [];
  if (referralDiscount && user.referredByAffiliateId) {
    try {
      const couponId = await getOrCreateAffiliateCoupon(stripe);
      discounts.push({ coupon: couponId });
    } catch {
      // Non-fatal — proceed without discount if coupon setup fails
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: matchedPrice.id, quantity: 1 }],
    ...(discounts.length > 0 ? { discounts } : {}),
    metadata: {
      userId: String(user.id),
      tierId,
      ticketsPerMonth: String(tier.ticketsPerMonth),
    },
    subscription_data: {
      metadata: {
        userId: String(user.id),
        tierId,
        ticketsPerMonth: String(tier.ticketsPerMonth),
      },
    },
    success_url: `${base}/tickets?subscribed=1`,
    cancel_url: `${base}/tickets`,
  });

  res.json({ url: session.url });
});

// POST /stripe/subscription/portal — Stripe Customer Portal (manage card, cancel, invoices)
router.post("/stripe/subscription/portal", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { returnUrl } = req.body as { returnUrl?: string };
  const base = (returnUrl ?? "https://hunch.fan").replace(/\/$/, "");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer found" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/tickets`,
  });

  res.json({ url: portalSession.url });
});

// POST /stripe/subscription/cancel — cancel at period end
router.post("/stripe/subscription/cancel", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, req.session.userId),
        eq(subscriptionsTable.status, "active"),
      ),
    )
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db
    .update(subscriptionsTable)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, sub.id));

  res.json({ ok: true });
});

export default router;
