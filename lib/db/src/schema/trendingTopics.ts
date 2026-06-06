import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const trendingTopicsTable = pgTable("trending_topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tag: text("tag").notNull().unique(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrendingTopic = typeof trendingTopicsTable.$inferSelect;
