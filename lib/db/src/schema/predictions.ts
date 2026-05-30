import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hunchesTable } from "./hunches";
import { optionsTable } from "./options";
import { usersTable } from "./users";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id),
  optionId: integer("option_id").notNull().references(() => optionsTable.id),
  questionId: integer("question_id"), // null = single-question hunch
  userId: integer("user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
