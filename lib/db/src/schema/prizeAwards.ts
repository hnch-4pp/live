import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const prizeAwards = pgTable("prize_awards", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull(),
  userId: integer("user_id").notNull(),
  rank: integer("rank"),
  prizeLabel: text("prize_label").notNull(),
  prizeValue: text("prize_value").notNull(),
  awardType: text("award_type").notNull(),
  codeType: text("code_type"),
  code: text("code"),
  codeFileUrl: text("code_file_url"),
  pin: text("pin"),
  expiresAt: timestamp("expires_at"),
  usageInstructions: text("usage_instructions"),
  trackingNumber: text("tracking_number"),
  courier: text("courier"),
  estimatedDelivery: timestamp("estimated_delivery"),
  terms: text("terms"),
  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
