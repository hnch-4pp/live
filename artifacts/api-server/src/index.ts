import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ensureTicketPacksExist } from "./seedTicketPacks";
import { ensureSubscriptionProductsExist } from "./seedSubscriptionProducts";
import { setupStripeWebhook } from "./webhookHandlers";
import { ObjectStorageService } from "./lib/objectStorage";

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

  await db.execute(sql`ALTER TABLE ticket_transactions ADD COLUMN IF NOT EXISTS revenue_cents INTEGER`);
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

  // Multi-prediction columns
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS is_multi BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS winner_answers TEXT`);
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS winner_user_id INTEGER REFERENCES users(id)`);
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS result_text TEXT`);
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS result_sources TEXT`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hunch_questions (
      id          SERIAL PRIMARY KEY,
      hunch_id    INTEGER NOT NULL REFERENCES hunches(id) ON DELETE CASCADE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      prompt      TEXT NOT NULL,
      answer_type TEXT NOT NULL DEFAULT 'integer',
      placeholder TEXT
    )
  `);
  await db.execute(sql`ALTER TABLE options ADD COLUMN IF NOT EXISTS question_id INTEGER REFERENCES hunch_questions(id)`);
  await db.execute(sql`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS question_id INTEGER REFERENCES hunch_questions(id)`);

  // Upgrade question_id FK constraints to ON DELETE SET NULL so deleting
  // hunch_questions rows never blocks the PATCH handler.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'options_question_id_fkey'
          AND constraint_type = 'FOREIGN KEY'
      ) THEN
        ALTER TABLE options DROP CONSTRAINT options_question_id_fkey;
      END IF;
      ALTER TABLE options ADD CONSTRAINT options_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES hunch_questions(id) ON DELETE SET NULL;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'predictions_question_id_fkey'
          AND constraint_type = 'FOREIGN KEY'
      ) THEN
        ALTER TABLE predictions DROP CONSTRAINT predictions_question_id_fkey;
      END IF;
      ALTER TABLE predictions ADD CONSTRAINT predictions_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES hunch_questions(id) ON DELETE SET NULL;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS top_notifications (
      id          SERIAL PRIMARY KEY,
      message     TEXT NOT NULL,
      link_url    TEXT,
      link_label  TEXT,
      type        TEXT NOT NULL DEFAULT 'info',
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Session store table (used by connect-pg-simple)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    VARCHAR NOT NULL COLLATE "default",
      "sess"   JSON NOT NULL,
      "expire" TIMESTAMP(6) NOT NULL,
      PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
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
await new ObjectStorageService().configureCors();
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
