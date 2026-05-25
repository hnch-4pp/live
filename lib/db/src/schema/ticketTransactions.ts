import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ticketTxTypeEnum = pgEnum("ticket_tx_type", ["welcome", "promo", "purchase", "spent"]);

export const ticketTransactionsTable = pgTable("ticket_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: ticketTxTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  label: text("label").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TicketTransaction = typeof ticketTransactionsTable.$inferSelect;
