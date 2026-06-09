import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  hunchesTable,
  predictionsTable,
  optionsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, desc, count, sql, isNotNull } from "drizzle-orm";

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

// ── Leaderboard ──────────────────────────────────────────────────────────────

router.get("/leaderboard", async (req, res): Promise<void> => {
  const page  = Math.max(1, parseInt((req.query.page  as string) ?? "1",  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "50", 10) || 50));
  const offset = (page - 1) * limit;

  // CTE: one row per (user, hunch) that the user won.
  // Handles case 1 (winnerUserId) and case 3 (label match for non-multi hunches).
  const rows = await db.execute(sql`
    WITH won_hunches AS (
      SELECT DISTINCT p.user_id, p.hunch_id
      FROM predictions p
      JOIN hunches h ON h.id = p.hunch_id
      JOIN options o ON o.id = p.option_id
      WHERE h.status = 'resolved'
        AND (
          h.winner_user_id = p.user_id
          OR (
            h.is_multi = false
            AND h.winner_option IS NOT NULL
            AND lower(o.label) = lower(h.winner_option)
          )
        )
    ),
    win_counts AS (
      SELECT user_id, COUNT(*) AS wins
      FROM won_hunches
      GROUP BY user_id
    ),
    total_count AS (
      SELECT COUNT(*) AS total
      FROM win_counts
      WHERE wins > 0
    )
    SELECT
      u.id,
      u.username,
      u.avatar_url AS "avatarUrl",
      COALESCE(wc.wins, 0)::int AS wins,
      (SELECT total FROM total_count)::int AS total
    FROM win_counts wc
    JOIN users u ON u.id = wc.user_id
    WHERE u.username IS NOT NULL AND wc.wins > 0
    ORDER BY wc.wins DESC, u.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const users = (rows.rows as Array<{ id: number; username: string; avatarUrl: string | null; wins: number; total: number }>);
  const total = users[0]?.total ?? 0;

  res.json({
    users: users.map((u) => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl, wins: u.wins })),
    total,
    page,
    hasMore: offset + limit < total,
  });
});

export default router;
