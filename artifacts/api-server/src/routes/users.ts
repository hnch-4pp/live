import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  hunchesTable,
  predictionsTable,
  optionsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";

const router = Router();

// ── Public user profile ───────────────────────────────────────────────────────

router.get("/users/:username", async (req, res): Promise<void> => {
  const { username } = req.params as { username: string };

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.username, username.toLowerCase()))
    .limit(1);

  if (!user || !user.username) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userId = user.id;

  // Total predictions made
  const [predCount] = await db
    .select({ cnt: count() })
    .from(predictionsTable)
    .where(eq(predictionsTable.userId, userId));

  // All resolved predictions (for win computation, cap at 200)
  const resolvedPreds = await db
    .select({
      hunchId: hunchesTable.id,
      hunchWinnerOption: hunchesTable.winnerOption,
      hunchWinnerUserId: hunchesTable.winnerUserId,
      hunchWinnerRanks: hunchesTable.winnerRanks,
      hunchIsMulti: hunchesTable.isMulti,
      optionLabel: optionsTable.label,
    })
    .from(predictionsTable)
    .innerJoin(hunchesTable, eq(hunchesTable.id, predictionsTable.hunchId))
    .innerJoin(optionsTable, eq(optionsTable.id, predictionsTable.optionId))
    .where(and(eq(predictionsTable.userId, userId), eq(hunchesTable.status, "resolved")))
    .limit(200);

  const wonHunchIds = new Set<number>();
  for (const p of resolvedPreds) {
    if (p.hunchWinnerUserId === userId) { wonHunchIds.add(p.hunchId); continue; }
    if (p.hunchWinnerRanks) {
      try {
        const ranks = JSON.parse(p.hunchWinnerRanks) as Array<{ rank: number; userId: number }>;
        if (ranks.some((r) => r.userId === userId)) { wonHunchIds.add(p.hunchId); continue; }
      } catch { /* ignore */ }
    }
    if (!p.hunchIsMulti && p.hunchWinnerOption && p.optionLabel) {
      if (p.optionLabel.toLowerCase() === p.hunchWinnerOption.toLowerCase()) {
        wonHunchIds.add(p.hunchId);
      }
    }
  }

  // Recent predictions (last 20, deduped per hunch)
  const recentRows = await db
    .select({
      hunchId: hunchesTable.id,
      hunchSlug: hunchesTable.slug,
      hunchTitle: hunchesTable.title,
      hunchStatus: hunchesTable.status,
      hunchEndsAt: hunchesTable.endsAt,
      optionLabel: optionsTable.label,
      predCreatedAt: predictionsTable.createdAt,
      categoryIcon: categoriesTable.icon,
      categoryColor: categoriesTable.color,
    })
    .from(predictionsTable)
    .innerJoin(hunchesTable, eq(hunchesTable.id, predictionsTable.hunchId))
    .innerJoin(optionsTable, eq(optionsTable.id, predictionsTable.optionId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, hunchesTable.categoryId))
    .where(eq(predictionsTable.userId, userId))
    .orderBy(desc(predictionsTable.createdAt))
    .limit(40);

  // Dedup: keep one row per hunch (first = most recent)
  const seenHunches = new Set<number>();
  const recentPredictions = recentRows
    .filter((r) => {
      if (seenHunches.has(r.hunchId)) return false;
      seenHunches.add(r.hunchId);
      return true;
    })
    .slice(0, 20)
    .map((p) => ({
      hunchId: p.hunchId,
      hunchSlug: p.hunchSlug,
      hunchTitle: p.hunchTitle,
      hunchStatus: p.hunchStatus,
      hunchEndsAt: p.hunchEndsAt,
      optionLabel: p.optionLabel,
      predCreatedAt: p.predCreatedAt,
      categoryIcon: p.categoryIcon,
      categoryColor: p.categoryColor,
      won: wonHunchIds.has(p.hunchId),
    }));

  res.json({
    profile: {
      username: user.username,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt,
    },
    stats: {
      totalPredictions: Number(predCount.cnt),
      totalWins: wonHunchIds.size,
    },
    recentPredictions,
  });
});

export default router;
