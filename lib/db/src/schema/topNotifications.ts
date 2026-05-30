import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const topNotificationsTable = pgTable("top_notifications", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  type: text("type").notNull().default("info"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TopNotification = typeof topNotificationsTable.$inferSelect;
