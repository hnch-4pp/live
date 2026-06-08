import {
  pgTable, serial, text, integer, timestamp, boolean, pgEnum, jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const affiliateStatusEnum = pgEnum("affiliate_status", [
  "pending", "active", "suspended", "rejected",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "signed_up", "converted", "active", "cancelled",
]);

export const commissionTypeEnum = pgEnum("commission_type", [
  "subscription", "ticket_purchase", "bonus",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending", "approved", "paid", "rejected",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending", "processing", "paid", "failed",
]);

// ─── affiliates ───────────────────────────────────────────────────────────────

export const affiliatesTable = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  niche: text("niche"),
  status: affiliateStatusEnum("status").notNull().default("pending"),
  customMessage: text("custom_message"),
  socialLinks: jsonb("social_links").$type<Record<string, string>>(),
  referredByUsername: text("referred_by_username"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by"),
});

export type Affiliate = typeof affiliatesTable.$inferSelect;

// ─── affiliate_clicks ─────────────────────────────────────────────────────────

export const affiliateClicksTable = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  visitorId: text("visitor_id"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  landingPage: text("landing_page"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliateClick = typeof affiliateClicksTable.$inferSelect;

// ─── referrals ────────────────────────────────────────────────────────────────

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referralSlug: text("referral_slug").notNull(),
  status: referralStatusEnum("status").notNull().default("signed_up"),
  signupAt: timestamp("signup_at", { withTimezone: true }).notNull().defaultNow(),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  firstPurchaseAt: timestamp("first_purchase_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;

// ─── affiliate_tiers ──────────────────────────────────────────────────────────

export const affiliateTiersTable = pgTable("affiliate_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  minActivePremiumUsers: integer("min_active_premium_users").notNull().default(0),
  maxActivePremiumUsers: integer("max_active_premium_users"),
  commissionPercentage: integer("commission_percentage").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliateTier = typeof affiliateTiersTable.$inferSelect;

// ─── affiliate_commissions ────────────────────────────────────────────────────

export const affiliateCommissionsTable = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id"),
  transactionId: integer("transaction_id"),
  revenueAmount: integer("revenue_amount").notNull(),
  commissionPercentage: integer("commission_percentage").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  commissionType: commissionTypeEnum("commission_type").notNull().default("subscription"),
  status: commissionStatusEnum("status").notNull().default("pending"),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliateCommission = typeof affiliateCommissionsTable.$inferSelect;

// ─── affiliate_payouts ────────────────────────────────────────────────────────

export const affiliatePayoutsTable = pgTable("affiliate_payouts", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliatesTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  status: payoutStatusEnum("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type AffiliatePayout = typeof affiliatePayoutsTable.$inferSelect;
