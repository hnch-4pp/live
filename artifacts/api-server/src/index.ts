import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ensureTicketPacksExist } from "./seedTicketPacks";
import { ensureSubscriptionProductsExist } from "./seedSubscriptionProducts";
import { setupStripeWebhook } from "./webhookHandlers";

async function runAppMigrations(): Promise<void> {
  // Add new enum value (safe to re-run)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'subscription'
          AND enumtypid = 'ticket_tx_type'::regtype
      ) THEN
        ALTER TYPE ticket_tx_type ADD VALUE 'subscription';
      END IF;
    END $$;
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_method TEXT NOT NULL DEFAULT 'password'`);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM (
          'active','past_due','canceled','unpaid','trialing','paused','incomplete','incomplete_expired'
        );
      END IF;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                    SERIAL PRIMARY KEY,
      user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      stripe_price_id       TEXT NOT NULL,
      tier                  TEXT NOT NULL,
      tickets_per_month     INTEGER NOT NULL,
      status                subscription_status NOT NULL DEFAULT 'active',
      current_period_start  TIMESTAMPTZ,
      current_period_end    TIMESTAMPTZ,
      cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  logger.info("App schema migrations applied");
}

async function initStripeSync(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();
    stripeSync.syncBackfill().catch((err: unknown) => {
      logger.error({ err }, "Stripe syncBackfill failed");
    });
  } catch (err: unknown) {
    logger.error({ err }, "Stripe sync init failed — continuing");
  }
}

function getWebhookBaseUrl(): string | null {
  if (process.env.WEBHOOK_BASE_URL) return process.env.WEBHOOK_BASE_URL.replace(/\/$/, "");
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  return null;
}

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

await runAppMigrations();
await ensureTicketPacksExist();
await ensureSubscriptionProductsExist();

const webhookBase = getWebhookBaseUrl();
if (webhookBase) {
  await setupStripeWebhook(webhookBase);
} else {
  logger.warn("No WEBHOOK_BASE_URL or REPLIT_DOMAINS set — webhook not registered");
}

// Run stripe-replit-sync in background (optional data sync, non-critical)
initStripeSync().catch(() => {/* already logged inside */});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
