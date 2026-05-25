import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ticketCodeTypeEnum = pgEnum("ticket_code_type", ["generic", "unique"]);
export const ticketCodeScopeEnum = pgEnum("ticket_code_scope", ["registration", "general", "both"]);
export const redemptionContextEnum = pgEnum("redemption_context", ["registration", "reward", "manual"]);

export const ticketCodesTable = pgTable("ticket_codes", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  codeType: ticketCodeTypeEnum("code_type").notNull(),
  scope: ticketCodeScopeEnum("scope").notNull().default("both"),
  bonusTickets: integer("bonus_tickets").notNull().default(1),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  instructions: text("instructions"),
  termsAndConditions: text("terms_and_conditions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketCodeRedemptionsTable = pgTable("ticket_code_redemptions", {
  id: serial("id").primaryKey(),
  ticketCodeId: integer("ticket_code_id").notNull().references(() => ticketCodesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ticketsGranted: integer("tickets_granted").notNull(),
  context: redemptionContextEnum("context").notNull().default("manual"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("one_redemption_per_user_per_code").on(t.ticketCodeId, t.userId)]);

export type TicketCode = typeof ticketCodesTable.$inferSelect;
export type TicketCodeRedemption = typeof ticketCodeRedemptionsTable.$inferSelect;
