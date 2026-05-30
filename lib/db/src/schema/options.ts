import { pgTable, serial, text, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hunchesTable } from "./hunches";

export const optionsTable = pgTable("options", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id),
  questionId: integer("question_id"), // null = single-question hunch
  label: text("label").notNull(),
  percentage: real("percentage").notNull().default(50),
});

export const insertOptionSchema = createInsertSchema(optionsTable).omit({ id: true });
export type InsertOption = z.infer<typeof insertOptionSchema>;
export type Option = typeof optionsTable.$inferSelect;
