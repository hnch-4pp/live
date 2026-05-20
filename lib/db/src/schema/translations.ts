import { pgTable, serial, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { hunchesTable } from "./hunches";

export const hunchTranslationsTable = pgTable(
  "hunch_translations",
  {
    id: serial("id").primaryKey(),
    hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    optionTranslations: jsonb("option_translations").$type<Record<number, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("hunch_translations_hunch_lang").on(t.hunchId, t.lang)],
);
