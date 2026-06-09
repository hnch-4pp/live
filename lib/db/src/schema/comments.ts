import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { hunchesTable } from "./hunches";

export const commentsTable = pgTable("hunch_comments", {
  id: serial("id").primaryKey(),
  hunchId: integer("hunch_id").notNull().references(() => hunchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  parentId: integer("parent_id"), // nullable self-reference for threads (no FK to allow flexible ordering)
  body: text("body").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => commentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commentBookmarksTable = pgTable("comment_bookmarks", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => commentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Comment = typeof commentsTable.$inferSelect;
export type CommentLike = typeof commentLikesTable.$inferSelect;
export type CommentBookmark = typeof commentBookmarksTable.$inferSelect;
