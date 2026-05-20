import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prizesTable = pgTable("prizes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull(), // gift_card | merch | cash_equivalent
  value: text("value").notNull(),
  imageUrl: text("image_url"),
});

export const insertPrizeSchema = createInsertSchema(prizesTable).omit({ id: true });
export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizesTable.$inferSelect;
