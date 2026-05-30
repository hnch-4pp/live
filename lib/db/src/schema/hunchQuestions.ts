import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hunchesTable } from "./hunches";

export const hunchQuestionsTable = pgTable("hunch_questions", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  prompt: text("prompt").notNull(),
  answerType: text("answer_type").notNull().default("integer"),
  placeholder: text("placeholder"),
});

export const insertHunchQuestionSchema = createInsertSchema(hunchQuestionsTable).omit({ id: true });
export type InsertHunchQuestion = z.infer<typeof insertHunchQuestionSchema>;
export type HunchQuestion = typeof hunchQuestionsTable.$inferSelect;
