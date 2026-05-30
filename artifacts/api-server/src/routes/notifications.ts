import { Router, type IRouter } from "express";
import { db, topNotificationsTable } from "@workspace/db";
import { and, eq, or, gt, isNull } from "drizzle-orm";

const router: IRouter = Router();

// GET /notifications/active — returns the first active, non-expired notification
router.get("/notifications/active", async (_req, res): Promise<void> => {
  const now = new Date();

  const [row] = await db
    .select()
    .from(topNotificationsTable)
    .where(
      and(
        eq(topNotificationsTable.isActive, true),
        or(
          isNull(topNotificationsTable.expiresAt),
          gt(topNotificationsTable.expiresAt, now),
        ),
      ),
    )
    .orderBy(topNotificationsTable.createdAt)
    .limit(1);

  if (!row) {
    res.json({ notification: null });
    return;
  }

  res.json({ notification: row });
});

export default router;
