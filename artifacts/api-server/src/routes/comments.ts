import { Router } from "express";
import { db } from "@workspace/db";
import {
  hunchesTable,
  usersTable,
  commentsTable,
  commentLikesTable,
  commentBookmarksTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.admin) { res.status(401).json({ error: "Admin required" }); return; }
  next();
}

const router = Router();

const MAX_BODY = 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichComments(
  rawComments: (typeof commentsTable.$inferSelect)[],
  viewerUserId: number | undefined
) {
  if (rawComments.length === 0) return [];

  const ids = rawComments.map((c) => c.id);

  // Author info
  const authorIds = [...new Set(rawComments.map((c) => c.userId).filter(Boolean))] as number[];
  const authors = authorIds.length
    ? await db
        .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  // Like counts
  const likeCounts = await db
    .select({ commentId: commentLikesTable.commentId, cnt: sql<number>`COUNT(*)::int` })
    .from(commentLikesTable)
    .where(inArray(commentLikesTable.commentId, ids))
    .groupBy(commentLikesTable.commentId);
  const likeMap = new Map(likeCounts.map((r) => [r.commentId, r.cnt]));

  // My likes & bookmarks
  let myLikes = new Set<number>();
  let myBookmarks = new Set<number>();
  if (viewerUserId) {
    const [likes, bookmarks] = await Promise.all([
      db
        .select({ commentId: commentLikesTable.commentId })
        .from(commentLikesTable)
        .where(and(eq(commentLikesTable.userId, viewerUserId), inArray(commentLikesTable.commentId, ids))),
      db
        .select({ commentId: commentBookmarksTable.commentId })
        .from(commentBookmarksTable)
        .where(and(eq(commentBookmarksTable.userId, viewerUserId), inArray(commentBookmarksTable.commentId, ids))),
    ]);
    myLikes = new Set(likes.map((l) => l.commentId));
    myBookmarks = new Set(bookmarks.map((b) => b.commentId));
  }

  return rawComments.map((c) => {
    const isDeleted = c.deletedAt !== null;
    const author = c.userId ? authorMap.get(c.userId) : null;
    return {
      id: c.id,
      hunchId: c.hunchId,
      parentId: c.parentId,
      body: isDeleted ? null : (c.isHidden ? null : c.body),
      isDeleted,
      isHidden: c.isHidden,
      createdAt: c.createdAt,
      author: isDeleted
        ? null
        : author
        ? { username: author.username, avatarUrl: author.avatarUrl }
        : null,
      isOwn: viewerUserId != null && c.userId === viewerUserId,
      likeCount: likeMap.get(c.id) ?? 0,
      likedByMe: myLikes.has(c.id),
      bookmarkedByMe: myBookmarks.has(c.id),
    };
  });
}

// ── Public: list comments for a hunch ────────────────────────────────────────

router.get("/hunches/:slug/comments", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };

  const [hunch] = await db
    .select({ id: hunchesTable.id })
    .from(hunchesTable)
    .where(eq(hunchesTable.slug, slug))
    .limit(1);
  if (!hunch) { res.status(404).json({ error: "Hunch not found" }); return; }

  const raw = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.hunchId, hunch.id))
    .orderBy(commentsTable.createdAt);

  const enriched = await enrichComments(raw, req.session.userId);
  res.json({ comments: enriched });
});

// ── Authenticated: post a comment ─────────────────────────────────────────────

router.post("/hunches/:slug/comments", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Login required" }); return; }
  const { slug } = req.params as { slug: string };
  const { body, parentId } = req.body as { body?: string; parentId?: number };

  const trimmed = body?.trim() ?? "";
  if (!trimmed) { res.status(400).json({ error: "Comment cannot be empty" }); return; }
  if (trimmed.length > MAX_BODY) { res.status(400).json({ error: `Max ${MAX_BODY} characters` }); return; }

  const [hunch] = await db
    .select({ id: hunchesTable.id })
    .from(hunchesTable)
    .where(eq(hunchesTable.slug, slug))
    .limit(1);
  if (!hunch) { res.status(404).json({ error: "Hunch not found" }); return; }

  // If replying, validate parent belongs to same hunch
  if (parentId) {
    const [parent] = await db
      .select({ id: commentsTable.id, hunchId: commentsTable.hunchId })
      .from(commentsTable)
      .where(eq(commentsTable.id, parentId))
      .limit(1);
    if (!parent || parent.hunchId !== hunch.id) {
      res.status(400).json({ error: "Invalid parent comment" }); return;
    }
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({
      hunchId: hunch.id,
      userId: req.session.userId,
      parentId: parentId ?? null,
      body: trimmed,
    })
    .returning();

  const enriched = await enrichComments([comment!], req.session.userId);
  res.status(201).json(enriched[0]);
});

// ── Authenticated: delete own comment ────────────────────────────────────────

router.delete("/comments/:id", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Login required" }); return; }
  const id = Number(req.params["id"]);

  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, id))
    .limit(1);

  if (!comment) { res.status(404).json({ error: "Not found" }); return; }
  if (comment.userId !== req.session.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .update(commentsTable)
    .set({ deletedAt: new Date() })
    .where(eq(commentsTable.id, id));

  res.json({ ok: true });
});

// ── Authenticated: toggle like ────────────────────────────────────────────────

router.post("/comments/:id/like", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Login required" }); return; }
  const commentId = Number(req.params["id"]);
  const userId = req.session.userId;

  const [existing] = await db
    .select()
    .from(commentLikesTable)
    .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(commentLikesTable)
      .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId)));
    res.json({ liked: false });
  } else {
    await db.insert(commentLikesTable).values({ commentId, userId });
    res.json({ liked: true });
  }
});

// ── Authenticated: toggle bookmark ────────────────────────────────────────────

router.post("/comments/:id/bookmark", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Login required" }); return; }
  const commentId = Number(req.params["id"]);
  const userId = req.session.userId;

  const [existing] = await db
    .select()
    .from(commentBookmarksTable)
    .where(and(eq(commentBookmarksTable.commentId, commentId), eq(commentBookmarksTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(commentBookmarksTable)
      .where(and(eq(commentBookmarksTable.commentId, commentId), eq(commentBookmarksTable.userId, userId)));
    res.json({ bookmarked: false });
  } else {
    await db.insert(commentBookmarksTable).values({ commentId, userId });
    res.json({ bookmarked: true });
  }
});

// ── Authenticated: get my bookmarks ───────────────────────────────────────────

router.get("/auth/comment-bookmarks", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Login required" }); return; }
  const userId = req.session.userId;

  const bookmarkRows = await db
    .select({ commentId: commentBookmarksTable.commentId })
    .from(commentBookmarksTable)
    .where(eq(commentBookmarksTable.userId, userId))
    .orderBy(desc(commentBookmarksTable.createdAt))
    .limit(50);

  if (bookmarkRows.length === 0) { res.json({ bookmarks: [] }); return; }

  const commentIds = bookmarkRows.map((b) => b.commentId);
  const raw = await db
    .select()
    .from(commentsTable)
    .where(inArray(commentsTable.id, commentIds));

  // Also get hunch titles
  const hunchIds = [...new Set(raw.map((c) => c.hunchId))];
  const hunches = hunchIds.length
    ? await db
        .select({ id: hunchesTable.id, slug: hunchesTable.slug, title: hunchesTable.title })
        .from(hunchesTable)
        .where(inArray(hunchesTable.id, hunchIds))
    : [];
  const hunchMap = new Map(hunches.map((h) => [h.id, h]));

  const enriched = await enrichComments(raw, userId);
  const withHunch = enriched.map((c) => ({
    ...c,
    hunch: hunchMap.get(c.hunchId) ?? null,
  }));

  // Preserve bookmark order
  const orderMap = new Map(commentIds.map((id, i) => [id, i]));
  withHunch.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));

  res.json({ bookmarks: withHunch });
});

// ── Admin: list all comments ───────────────────────────────────────────────────

router.get("/admin/comments", requireAdmin, async (req, res): Promise<void> => {
  const { status = "all", search = "", page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limit = 50;
  const offset = (pageNum - 1) * limit;

  let rows = await db
    .select()
    .from(commentsTable)
    .orderBy(desc(commentsTable.createdAt))
    .limit(200); // fetch more then filter in JS for simplicity

  if (status === "hidden") rows = rows.filter((r) => r.isHidden && !r.deletedAt);
  else if (status === "deleted") rows = rows.filter((r) => !!r.deletedAt);
  else if (status === "visible") rows = rows.filter((r) => !r.isHidden && !r.deletedAt);

  if (search.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter((r) => r.body.toLowerCase().includes(s));
  }

  const total = rows.length;
  const page_rows = rows.slice(offset, offset + limit);

  // Enrich with author + hunch info
  const authorIds = [...new Set(page_rows.map((c) => c.userId).filter(Boolean))] as number[];
  const authors = authorIds.length
    ? await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(inArray(usersTable.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const hunchIds = [...new Set(page_rows.map((c) => c.hunchId))];
  const hunchesList = hunchIds.length
    ? await db
        .select({ id: hunchesTable.id, slug: hunchesTable.slug, title: hunchesTable.title })
        .from(hunchesTable)
        .where(inArray(hunchesTable.id, hunchIds))
    : [];
  const hunchMap = new Map(hunchesList.map((h) => [h.id, h]));

  const result = page_rows.map((c) => ({
    id: c.id,
    hunchId: c.hunchId,
    hunch: hunchMap.get(c.hunchId) ?? null,
    parentId: c.parentId,
    body: c.body,
    isHidden: c.isHidden,
    deletedAt: c.deletedAt,
    createdAt: c.createdAt,
    author: c.userId ? (authorMap.get(c.userId) ?? null) : null,
  }));

  res.json({ comments: result, total, page: pageNum, pageSize: limit });
});

// ── Admin: hide / unhide a comment ────────────────────────────────────────────

router.patch("/admin/comments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { action } = req.body as { action?: string };

  if (action === "hide") {
    await db.update(commentsTable).set({ isHidden: true }).where(eq(commentsTable.id, id));
    res.json({ ok: true });
  } else if (action === "unhide") {
    await db.update(commentsTable).set({ isHidden: false }).where(eq(commentsTable.id, id));
    res.json({ ok: true });
  } else if (action === "delete") {
    await db.update(commentsTable).set({ deletedAt: new Date() }).where(eq(commentsTable.id, id));
    res.json({ ok: true });
  } else if (action === "restore") {
    await db.update(commentsTable).set({ deletedAt: null, isHidden: false }).where(eq(commentsTable.id, id));
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: "Invalid action" });
  }
});

export default router;
