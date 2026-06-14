import { pgTable, serial, text, date, timestamp, pgEnum, integer, boolean } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "banned"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  phone: text("phone").unique(),
  username: text("username").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  tickets: integer("tickets").notNull().default(5),
  stripeCustomerId: text("stripe_customer_id"),
  status: userStatusEnum("status").notNull().default("active"),
  loginMethod: text("login_method").notNull().default("password"),
  lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  referralCode: text("referral_code").unique(),
  referredByUserId: integer("referred_by_user_id"),
  referredByAffiliateId: integer("referred_by_affiliate_id"),
  referralDiscountUsed: boolean("referral_discount_used").notNull().default(false),
  referralDiscountAppliedAt: timestamp("referral_discount_applied_at", { withTimezone: true }),
  referralSource: text("referral_source"),
  pendingDeletion: boolean("pending_deletion").notNull().default(false),
  deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
  cookieConsent: text("cookie_consent"),
  cookieConsentAt: timestamp("cookie_consent_at", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;
