import { pgTable, serial, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "past_due", "canceled", "unpaid", "trialing", "paused", "incomplete", "incomplete_expired",
]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  tier: text("tier").notNull(),
  ticketsPerMonth: integer("tickets_per_month").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  referralDiscountApplied: boolean("referral_discount_applied").notNull().default(false),
  originalPriceCents: integer("original_price_cents"),
  discountedPriceCents: integer("discounted_price_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
