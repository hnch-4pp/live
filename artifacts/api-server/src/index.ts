import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { db, hunchesTable } from "@workspace/db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { ensureTicketPacksExist } from "./seedTicketPacks";
import { ensureSubscriptionProductsExist } from "./seedSubscriptionProducts";
import { setupStripeWebhook } from "./webhookHandlers";
import { ObjectStorageService } from "./lib/objectStorage";
import { sendAdminAlert, isReminderAlreadySent, markReminderSent } from "./adminAlerts";

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

  // Trending topics
  await db.execute(sql`
    ALTER TABLE hunches ADD COLUMN IF NOT EXISTS tags TEXT
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trending_topics (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      tag         TEXT NOT NULL UNIQUE,
      image_url   TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Ranked multi-winner support
  await db.execute(sql`ALTER TABLE hunches ADD COLUMN IF NOT EXISTS winner_ranks TEXT`);

  // Affiliate program columns
  await db.execute(sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS referred_by_username TEXT`);
  await db.execute(sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS referred_by_affiliate_id INTEGER REFERENCES affiliates(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS is_sub_affiliate BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS source_commission_id INTEGER`);

  // Member-Get-Member referral columns
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx
      ON users(referral_code) WHERE referral_code IS NOT NULL
  `);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER REFERENCES users(id)`);

  // Add referral enum value to ticket_tx_type
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'referral' AND enumtypid = 'ticket_tx_type'::regtype
      ) THEN
        ALTER TYPE ticket_tx_type ADD VALUE 'referral';
      END IF;
    END $$;
  `);

  // Backfill referral codes for existing users
  const _noCodeUsers = await db.execute(sql`SELECT id FROM users WHERE referral_code IS NULL`);
  const noCodeRows = _noCodeUsers.rows as { id: number }[];
  const _alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const _special = "@#$!";
  const _all = _alphabet + _special;
  function _mkCode(): string {
    const chars: string[] = [_special[Math.floor(Math.random() * _special.length)]!];
    while (chars.length < 8) chars.push(_all[Math.floor(Math.random() * _all.length)]!);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    return chars.join("");
  }
  for (const row of noCodeRows) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = _mkCode();
      try {
        await db.execute(sql`UPDATE users SET referral_code = ${code} WHERE id = ${row.id} AND referral_code IS NULL`);
        break;
      } catch { /* collision — retry */ }
    }
  }

  // Comments system
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hunch_comments (
      id          SERIAL PRIMARY KEY,
      hunch_id    INTEGER NOT NULL REFERENCES hunches(id) ON DELETE CASCADE,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      parent_id   INTEGER,
      body        TEXT NOT NULL,
      is_hidden   BOOLEAN NOT NULL DEFAULT false,
      deleted_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS hunch_comments_hunch_idx ON hunch_comments(hunch_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS hunch_comments_parent_idx ON hunch_comments(parent_id)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id          SERIAL PRIMARY KEY,
      comment_id  INTEGER NOT NULL REFERENCES hunch_comments(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (comment_id, user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comment_bookmarks (
      id          SERIAL PRIMARY KEY,
      comment_id  INTEGER NOT NULL REFERENCES hunch_comments(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (comment_id, user_id)
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

// ── Hunch closing reminder scheduler ──────────────────────────────────────────
async function runHunchReminders(): Promise<void> {
  const windows: Array<{ window: "3d" | "1d" | "1h"; minMs: number; maxMs: number; label: string }> = [
    { window: "3d", minMs: 3 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000, maxMs: 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000, label: "3 days" },
    { window: "1d", minMs:     24 * 60 * 60 * 1000 - 30 * 60 * 1000, maxMs:     24 * 60 * 60 * 1000 + 30 * 60 * 1000, label: "24 hours" },
    { window: "1h", minMs:          60 * 60 * 1000 - 15 * 60 * 1000, maxMs:          60 * 60 * 1000 + 15 * 60 * 1000, label: "1 hour" },
  ];

  const now = Date.now();
  for (const { window, minMs, maxMs, label } of windows) {
    const from = new Date(now + minMs);
    const to   = new Date(now + maxMs);

    const hunches = await db
      .select({ id: hunchesTable.id, title: hunchesTable.title, endsAt: hunchesTable.endsAt })
      .from(hunchesTable)
      .where(and(eq(hunchesTable.status, "open"), gte(hunchesTable.endsAt, from), lte(hunchesTable.endsAt, to)));

    for (const hunch of hunches) {
      const already = await isReminderAlreadySent(hunch.id, window);
      if (already) continue;

      const endsAt = hunch.endsAt ? new Date(hunch.endsAt).toLocaleString() : "unknown";
      await sendAdminAlert(
        `hunch_reminder_${window}` as "hunch_reminder_3d" | "hunch_reminder_1d" | "hunch_reminder_1h",
        `Hunch closing in ${label}: ${hunch.title}`,
        `Hunch: ${hunch.title}\nID: ${hunch.id}\nCloses at: ${endsAt}`,
        `Hunches: "${hunch.title}" closes in ${label}`,
      );
      await markReminderSent(hunch.id, window);
    }
  }
}

setInterval(() => {
  runHunchReminders().catch((err) => logger.error({ err }, "Hunch reminder check failed"));
}, 30 * 60 * 1000); // every 30 minutes

// Run once on startup
runHunchReminders().catch((err) => logger.error({ err }, "Hunch reminder initial check failed"));

// ── Auto-close expired hunches ─────────────────────────────────────────────────
async function runAutoClose(): Promise<void> {
  const now = new Date();
  const result = await db
    .update(hunchesTable)
    .set({ status: "closed" })
    .where(and(eq(hunchesTable.status, "open"), lte(hunchesTable.endsAt, now)))
    .returning({ id: hunchesTable.id, title: hunchesTable.title });

  if (result.length > 0) {
    logger.info({ count: result.length, ids: result.map((h) => h.id) }, "Auto-closed expired hunches");
  }
}

setInterval(() => {
  runAutoClose().catch((err) => logger.error({ err }, "Auto-close check failed"));
}, 5 * 60 * 1000); // every 5 minutes

// Run once on startup to catch any hunches that expired while server was down
runAutoClose().catch((err) => logger.error({ err }, "Auto-close initial check failed"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
