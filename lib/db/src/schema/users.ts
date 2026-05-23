import { pgTable, serial, text, date, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "banned"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  phone: text("phone").unique(),
  username: text("username").unique(),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  tickets: integer("tickets").notNull().default(3),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
