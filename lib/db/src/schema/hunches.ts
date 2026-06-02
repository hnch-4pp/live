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
  featuredOrder: integer("featured_order"),
  imageUrl: text("image_url"),
  imageFocalPoint: text("image_focal_point"),
  winnerOption: text("winner_option"),
  winnerAnswers: text("winner_answers"), // JSON: Array<{ questionId: number; answer: string }>
  winnerUserId: integer("winner_user_id"), // For multi-prediction: the winning user's ID
  resultText: text("result_text"), // Admin-written result summary shown after resolution
  resultSources: text("result_sources"), // JSON: Array<{ type, url, label }>
  rules: text("rules"),
  prizeConditions: text("prize_conditions"),
  answerType: text("answer_type").notNull().default("integer"), // integer | decimal | date | time
  isMulti: boolean("is_multi").notNull().default(false),
  ticketCost: integer("ticket_cost").notNull().default(1),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHunchSchema = createInsertSchema(hunchesTable).omit({ id: true, createdAt: true });
export type InsertHunch = z.infer<typeof insertHunchSchema>;
export type Hunch = typeof hunchesTable.$inferSelect;
