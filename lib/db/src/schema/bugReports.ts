import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  email: varchar("email", { length: 255 }),
  username: varchar("username", { length: 100 }),
  pageUrl: text("page_url"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type BugReport = typeof bugReportsTable.$inferSelect;
