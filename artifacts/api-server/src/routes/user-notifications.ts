import { Router, type IRouter } from "express";
import { db, userNotificationsTable } from "@workspace/db";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/notifications/me — list my notifications (50 most recent)
router.get("/notifications/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const rows = await db
    .select()
    .from(userNotificationsTable)
    .where(eq(userNotificationsTable.userId, req.session.userId))
    .orderBy(desc(userNotificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

// GET /api/notifications/me/unread-count — lightweight badge count
router.get("/notifications/me/unread-count", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.json({ count: 0 }); return; }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userNotificationsTable)
    .where(and(
      eq(userNotificationsTable.userId, req.session.userId),
      isNull(userNotificationsTable.readAt),
    ));
  res.json({ count: row?.count ?? 0 });
});

// POST /api/notifications/me/read-all — mark all as read
router.post("/notifications/me/read-all", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db
    .update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(userNotificationsTable.userId, req.session.userId),
      isNull(userNotificationsTable.readAt),
    ));
  res.json({ ok: true });
});

// POST /api/notifications/me/:id/read — mark single notification as read
router.post("/notifications/me/:id/read", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db
    .update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(userNotificationsTable.id, id),
      eq(userNotificationsTable.userId, req.session.userId),
    ));
  res.json({ ok: true });
});

export default router;
