import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, ticketTransactionsTable, appSettingsTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";
import { sql } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./subscriptionTiers";

// ── Webhook secret management ───────────────────────────────────────────────

async function getWebhookSecret(): Promise<string | null> {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "stripe_webhook_secret"))
      .limit(1);

    if (row) {
      const data = JSON.parse(row.value) as { secret: string };
      return data.secret;
    }
  } catch {
    // DB not ready or key not set
  }

  return null;
}

export async function setupStripeWebhook(webhookBaseUrl: string): Promise<void> {
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn("Stripe not configured — skipping webhook setup");
    return;
  }

  const webhookUrl = `${webhookBaseUrl}/api/stripe/webhook`;
  const existingSecret = await getWebhookSecret();
  if (existingSecret) {
    logger.info("Stripe webhook secret already configured");
    return;
  }

  try {
    const all = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = all.data.find((w) => w.url === webhookUrl);

    // Delete and recreate so we can capture the secret
    if (existing) await stripe.webhookEndpoints.del(existing.id);

    const webhook = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        "checkout.session.completed",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ],
    });

    const secretData = JSON.stringify({ webhookId: webhook.id, secret: webhook.secret });
    await db
      .insert(appSettingsTable)
      .values({ key: "stripe_webhook_secret", value: secretData })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: secretData, updatedAt: new Date() },
      });

    logger.info({ webhookUrl }, "Stripe webhook registered and secret stored");
  } catch (err: unknown) {
    logger.error({ err }, "Failed to register Stripe webhook — continuing without it");
  }
}

// ── Event handlers ──────────────────────────────────────────────────────────

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Only process one-time payment sessions (not subscriptions, which are handled by invoice events)
  if (session.mode !== "payment") return;

  const userId = Number(session.metadata?.userId);
  const ticketAmount = Number(session.metadata?.ticketAmount ?? 1);
  const packName = session.metadata?.packName ?? "Ticket pack";

  if (!userId || isNaN(userId)) {
    logger.warn({ sessionId: session.id }, "checkout.session.completed: no userId in metadata");
    return;
  }

  // Idempotency: skip if already processed
  const [existing] = await db
    .select({ id: ticketTransactionsTable.id })
    .from(ticketTransactionsTable)
    .where(
      and(
        eq(ticketTransactionsTable.reference, session.id),
        eq(ticketTransactionsTable.type, "purchase"),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info({ sessionId: session.id }, "Checkout session already processed — skipping");
    return;
  }

  const revenueCents = session.amount_total ?? null;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE users SET tickets = tickets + ${ticketAmount} WHERE id = ${userId}`,
    );
    await tx.insert(ticketTransactionsTable).values({
      userId,
      type: "purchase",
      amount: ticketAmount,
      revenueCents,
      label: `${packName} purchased`,
      reference: session.id,
    });
  });

  logger.info({ userId, ticketAmount, revenueCents, sessionId: session.id }, "Ticket pack credited via webhook");
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subDetails = invoice.parent?.subscription_details;
  const subscriptionId =
    typeof subDetails?.subscription === "string"
      ? subDetails.subscription
      : subDetails?.subscription?.id;

  if (!subscriptionId) return;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!sub) {
    logger.warn({ subscriptionId }, "invoice.payment_succeeded: subscription not in DB");
    return;
  }

  const invoiceId = invoice.id;
  const [existing] = await db
    .select({ id: ticketTransactionsTable.id })
    .from(ticketTransactionsTable)
    .where(
      and(
        eq(ticketTransactionsTable.reference, invoiceId),
        eq(ticketTransactionsTable.userId, sub.userId),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info({ invoiceId }, "Invoice already processed — skipping");
    return;
  }

  const tierConfig = SUBSCRIPTION_TIERS[sub.tier as keyof typeof SUBSCRIPTION_TIERS];
  const revenueCents = tierConfig?.amountCents ?? null;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE users SET tickets = tickets + ${sub.ticketsPerMonth} WHERE id = ${sub.userId}`,
    );
    await tx.insert(ticketTransactionsTable).values({
      userId: sub.userId,
      type: "subscription",
      amount: sub.ticketsPerMonth,
      revenueCents,
      label: `Monthly tickets — ${sub.tier} plan`,
      reference: invoiceId,
    });
  });

  logger.info({ userId: sub.userId, tickets: sub.ticketsPerMonth }, "Monthly tickets credited");
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const userId = Number(subscription.metadata?.userId);
  const tierId = subscription.metadata?.tierId ?? "starter";
  const ticketsPerMonth = Number(subscription.metadata?.ticketsPerMonth ?? 50);

  if (!userId) {
    logger.warn({ subscriptionId: subscription.id }, "subscription.created: no userId in metadata");
    return;
  }

  const firstItem = subscription.items.data[0];
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  await db
    .insert(subscriptionsTable)
    .values({
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: firstItem?.price.id ?? "",
      tier: tierId,
      ticketsPerMonth,
      status: subscription.status as "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.stripeSubscriptionId,
      set: {
        status: subscription.status as "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

  logger.info({ userId, tierId, subscriptionId: subscription.id }, "Subscription stored in DB");
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const firstItem = subscription.items.data[0];
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  const tierId = subscription.metadata?.tierId;
  const ticketsPerMonth = subscription.metadata?.ticketsPerMonth
    ? Number(subscription.metadata.ticketsPerMonth)
    : undefined;

  const update: Record<string, unknown> = {
    status: subscription.status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripePriceId: subscription.items.data[0]?.price.id ?? "",
    updatedAt: new Date(),
  };

  if (tierId) update.tier = tierId;
  if (ticketsPerMonth) update.ticketsPerMonth = ticketsPerMonth;

  await db
    .update(subscriptionsTable)
    .set(update)
    .where(eq(subscriptionsTable.stripeSubscriptionId, subscription.id));

  logger.info({ subscriptionId: subscription.id }, "Subscription updated");
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ status: "canceled", cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptionsTable.stripeSubscriptionId, subscription.id));

  logger.info({ subscriptionId: subscription.id }, "Subscription canceled");
}

// ── Main processor ──────────────────────────────────────────────────────────

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const secret = await getWebhookSecret();
    let event: Stripe.Event;

    if (secret) {
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } else {
      logger.warn("No webhook secret — processing without signature verification");
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const failedSubDetails = inv.parent?.subscription_details;
        const subId =
          typeof failedSubDetails?.subscription === "string"
            ? failedSubDetails.subscription
            : failedSubDetails?.subscription?.id;
        if (subId) {
          await db
            .update(subscriptionsTable)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptionsTable.stripeSubscriptionId, subId));
        }
        break;
      }
      default:
        logger.info({ eventType: event.type }, "Unhandled Stripe event");
    }
  }
}
