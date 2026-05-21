import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { hunchesTable } from "./hunches";
import { prizesTable } from "./prizes";

export const hunchPrizeTiersTable = pgTable("hunch_prize_tiers", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id),
  rank: integer("rank").notNull(),
  prizeId: integer("prize_id").notNull().references(() => prizesTable.id),
});

export type HunchPrizeTier = typeof hunchPrizeTiersTable.$inferSelect;
