import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { prizesTable } from "./prizes";

export const hunchesTable = pgTable("hunches", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  prizeId: integer("prize_id").notNull().references(() => prizesTable.id),
  status: text("status").notNull().default("open"), // open | closed | resolved
  participantCount: integer("participant_count").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  imageUrl: text("image_url"),
  winnerOption: text("winner_option"),
  rules: text("rules"),
  answerType: text("answer_type").notNull().default("integer"), // integer | decimal | date | time
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHunchSchema = createInsertSchema(hunchesTable).omit({ id: true, createdAt: true });
export type InsertHunch = z.infer<typeof insertHunchSchema>;
export type Hunch = typeof hunchesTable.$inferSelect;
