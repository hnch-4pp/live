import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  hunchesTable,
  categoriesTable,
  prizesTable,
  optionsTable,
  hunchPrizeTiersTable,
  usersTable,
  ticketCodesTable,
  ticketCodeRedemptionsTable,
  campaignsTable,
  predictionsTable,
  ticketTransactionsTable,
  subscriptionsTable,
  hunchQuestionsTable,
  topNotificationsTable,
} from "@workspace/db";
import { eq, or, ilike, sql, desc, and, asc } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

function parsePrizeAmount(value: string): number {
  const m = value.match(/\$?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}


const router = Router();

async function findOrCreatePrize(label: string): Promise<number> {
  const trimmed = label.trim();
  const existing = await db.select().from(prizesTable).where(eq(prizesTable.label, trimmed)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(prizesTable)
    .values({ label: trimmed, type: "gift_card", value: trimmed })
    .returning();
  return created.id;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many failed login attempts. Please try again in 15 minutes." },
});

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (!req.session?.admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function requireAdminHeader(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (req.headers["x-admin-request"] !== "1") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use("/admin", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.post("/admin/login", loginLimiter, async (req, res): Promise<void> => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  const adminUser = process.env["ADMIN_USERNAME"] ?? "";
  const adminPass = process.env["ADMIN_PASSWORD"] ?? "";

  const userOk = timingSafeCompare(username ?? "", adminUser);
  const passOk = timingSafeCompare(password ?? "", adminPass);

  if (!userOk || !passOk || !adminUser || !adminPass) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Session error" });
      return;
    }
    req.session.admin = true;
    req.session.save((saveErr) => {
      if (saveErr) {
        res.status(500).json({ error: "Session error" });
        return;
      }
      res.json({ ok: true });
    });
  });
});

router.post(
  "/admin/logout",
  requireAdmin,
  requireAdminHeader,
  (req, res): void => {
    req.session.destroy(() => {
      res.clearCookie("hunch.sid");
      res.json({ ok: true });
    });
  },
);

router.get("/admin/me", (req, res): void => {
  res.json({ authenticated: !!req.session?.admin });
});

router.get(
  "/admin/hunches",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const hunches = await db
      .select({
        id: hunchesTable.id,
        title: hunchesTable.title,
        description: hunchesTable.description,
        imageUrl: hunchesTable.imageUrl,
        status: hunchesTable.status,
        featured: hunchesTable.featured,
        featuredOrder: hunchesTable.featuredOrder,
        endsAt: hunchesTable.endsAt,
        categoryId: hunchesTable.categoryId,
        prizeId: hunchesTable.prizeId,
        participantCount: hunchesTable.participantCount,
        winnerOption: hunchesTable.winnerOption,
        rules: hunchesTable.rules,
        answerType: hunchesTable.answerType,
        createdAt: hunchesTable.createdAt,
      })
      .from(hunchesTable)
      .orderBy(hunchesTable.createdAt);
    res.json(hunches);
  },
);

router.get(
  "/admin/hunches/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [hunch] = await db.select().from(hunchesTable).where(eq(hunchesTable.id, id));
    if (!hunch) { res.status(404).json({ error: "Not found" }); return; }
    const tiers = await db
      .select({ rank: hunchPrizeTiersTable.rank, prizeLabel: prizesTable.label })
      .from(hunchPrizeTiersTable)
      .leftJoin(prizesTable, eq(hunchPrizeTiersTable.prizeId, prizesTable.id))
      .where(eq(hunchPrizeTiersTable.hunchId, id))
      .orderBy(hunchPrizeTiersTable.rank);
    const questions = await db
      .select()
      .from(hunchQuestionsTable)
      .where(eq(hunchQuestionsTable.hunchId, id))
      .orderBy(hunchQuestionsTable.sortOrder);
    res.json({ ...hunch, prizeTiers: tiers, questions });
  },
);

router.get(
  "/admin/featured",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: hunchesTable.id,
        title: hunchesTable.title,
        status: hunchesTable.status,
        imageUrl: hunchesTable.imageUrl,
        featuredOrder: hunchesTable.featuredOrder,
        endsAt: hunchesTable.endsAt,
      })
      .from(hunchesTable)
      .where(eq(hunchesTable.featured, true))
      .orderBy(hunchesTable.featuredOrder, hunchesTable.id);
    res.json(rows);
  },
);

router.patch(
  "/admin/featured-order",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "number")) {
      res.status(400).json({ error: "ids must be an array of numbers" });
      return;
    }
    await Promise.all(
      ids.map((id, idx) =>
        db
          .update(hunchesTable)
          .set({ featuredOrder: idx })
          .where(eq(hunchesTable.id, id)),
      ),
    );
    res.json({ ok: true });
  },
);

router.post(
  "/admin/hunches",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const {
      title,
      description,
      imageUrl,
      categoryId,
      featured,
      endsAt,
      status,
      answerType,
    } = req.body as Record<string, string | boolean | number | undefined>;

    const rawTiers = Array.isArray(req.body.prizeTiers)
      ? (req.body.prizeTiers as { rank: number; prizeLabel: string }[]).filter((t) => t.prizeLabel?.trim())
      : [];

    if (!title || !description || !categoryId || rawTiers.length === 0 || !endsAt) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const resolvedTiers = await Promise.all(
      rawTiers.map(async (t) => ({ rank: t.rank, prizeId: await findOrCreatePrize(t.prizeLabel) }))
    );
    const firstPrizeId = resolvedTiers[0].prizeId;

    const providedSlug = req.body.slug ? String(req.body.slug).trim() : null;
    const generatedSlug = toSlug(String(title));

    const [hunch] = await db
      .insert(hunchesTable)
      .values({
        slug: providedSlug || generatedSlug,
        title: String(title),
        description: String(description),
        imageUrl: imageUrl ? String(imageUrl) : null,
        imageFocalPoint: req.body.imageFocalPoint ? String(req.body.imageFocalPoint) : null,
        categoryId: Number(categoryId),
        prizeId: firstPrizeId,
        featured: featured === true || featured === "true",
        endsAt: new Date(String(endsAt)),
        status: (status as "open" | "closed" | "resolved") ?? "open",
        answerType: (answerType as string) ?? "integer",
        ticketCost: req.body.ticketCost !== undefined ? Number(req.body.ticketCost) : 1,
        rules: req.body.rules ? String(req.body.rules) : null,
        isMulti: req.body.isMulti === true || req.body.isMulti === "true",
      })
      .returning();

    await db.insert(hunchPrizeTiersTable).values(
      resolvedTiers.map((t) => ({ hunchId: hunch.id, rank: t.rank, prizeId: t.prizeId })),
    );

    // Save questions for multi-prediction hunches
    const isMulti = req.body.isMulti === true || req.body.isMulti === "true";
    if (isMulti && Array.isArray(req.body.questions)) {
      const qs = req.body.questions as Array<{ prompt: string; answerType: string; placeholder?: string; sortOrder?: number }>;
      const validQs = qs.filter((q) => q.prompt?.trim());
      if (validQs.length > 0) {
        await db.insert(hunchQuestionsTable).values(
          validQs.map((q, i) => ({
            hunchId: hunch.id,
            sortOrder: q.sortOrder ?? i,
            prompt: q.prompt.trim(),
            answerType: q.answerType ?? "integer",
            placeholder: q.placeholder?.trim() || null,
          }))
        );
      }
    }

    res.status(201).json(hunch);
  },
);

router.patch(
  "/admin/hunches/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const {
      title,
      description,
      imageUrl,
      categoryId,
      prizeId,
      featured,
      endsAt,
      status,
      winnerOption,
      answerType,
    } = req.body as Record<string, string | boolean | number | undefined>;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates["title"] = String(title);
    if ("slug" in req.body) updates["slug"] = req.body.slug ? String(req.body.slug).trim() : (title ? toSlug(String(title)) : undefined);
    if (description !== undefined) updates["description"] = String(description);
    if (imageUrl !== undefined)
      updates["imageUrl"] = imageUrl ? String(imageUrl) : null;
    if ("imageFocalPoint" in req.body)
      updates["imageFocalPoint"] = req.body.imageFocalPoint ? String(req.body.imageFocalPoint) : null;
    if (categoryId !== undefined && Number(categoryId) > 0) updates["categoryId"] = Number(categoryId);
    if (prizeId !== undefined && Number(prizeId) > 0) updates["prizeId"] = Number(prizeId);
    if (featured !== undefined)
      updates["featured"] = featured === true || featured === "true";
    if (endsAt !== undefined) updates["endsAt"] = new Date(String(endsAt));
    if (status !== undefined) updates["status"] = status;
    if (winnerOption !== undefined)
      updates["winnerOption"] = winnerOption ? String(winnerOption) : null;
    if (answerType !== undefined) updates["answerType"] = String(answerType);
    if (req.body.ticketCost !== undefined) updates["ticketCost"] = Number(req.body.ticketCost);
    if ("rules" in req.body) updates["rules"] = req.body.rules ? String(req.body.rules) : null;
    if ("isMulti" in req.body) updates["isMulti"] = req.body.isMulti === true || req.body.isMulti === "true";
    if ("winnerAnswers" in req.body) {
      updates["winnerAnswers"] = req.body.winnerAnswers
        ? (typeof req.body.winnerAnswers === "string" ? req.body.winnerAnswers : JSON.stringify(req.body.winnerAnswers))
        : null;
    }
    if ("winnerUserId" in req.body) {
      updates["winnerUserId"] = req.body.winnerUserId ? Number(req.body.winnerUserId) : null;
    }
    if ("resultText" in req.body) {
      updates["resultText"] = req.body.resultText ? String(req.body.resultText) : null;
    }
    if ("resultSources" in req.body) {
      updates["resultSources"] = req.body.resultSources
        ? (typeof req.body.resultSources === "string" ? req.body.resultSources : JSON.stringify(req.body.resultSources))
        : null;
    }

    // Prize tiers
    if (Array.isArray(req.body.prizeTiers)) {
      const rawTiers = (req.body.prizeTiers as { rank: number; prizeLabel: string }[]).filter((t) => t.prizeLabel?.trim());
      if (rawTiers.length > 0) {
        const resolvedTiers = await Promise.all(
          rawTiers.map(async (t) => ({ rank: t.rank, prizeId: await findOrCreatePrize(t.prizeLabel) }))
        );
        updates["prizeId"] = resolvedTiers[0].prizeId;
        await db.delete(hunchPrizeTiersTable).where(eq(hunchPrizeTiersTable.hunchId, id));
        await db.insert(hunchPrizeTiersTable).values(
          resolvedTiers.map((t) => ({ hunchId: id, rank: t.rank, prizeId: t.prizeId })),
        );
      }
    }

    // Questions (full replace when provided — only for multi-prediction hunches)
    const isMultiReq = req.body.isMulti === true || req.body.isMulti === "true";
    if (isMultiReq && Array.isArray(req.body.questions)) {
      await db.delete(hunchQuestionsTable).where(eq(hunchQuestionsTable.hunchId, id));
      const qs = req.body.questions as Array<{ prompt: string; answerType: string; placeholder?: string; sortOrder?: number }>;
      const validQs = qs.filter((q) => q.prompt?.trim());
      if (validQs.length > 0) {
        await db.insert(hunchQuestionsTable).values(
          validQs.map((q, i) => ({
            hunchId: id,
            sortOrder: q.sortOrder ?? i,
            prompt: q.prompt.trim(),
            answerType: q.answerType ?? "integer",
            placeholder: q.placeholder?.trim() || null,
          }))
        );
      }
      // isMulti flag follows question count when questions are provided
      if (!("isMulti" in req.body)) {
        updates["isMulti"] = validQs.length >= 2;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [hunch] = await db
      .update(hunchesTable)
      .set(updates)
      .where(eq(hunchesTable.id, id))
      .returning();

    if (!hunch) {
      res.status(404).json({ error: "Hunch not found" });
      return;
    }

    res.json(hunch);
  },
);

router.delete(
  "/admin/hunches/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    await db.delete(optionsTable).where(eq(optionsTable.hunchId, id));
    await db.delete(hunchesTable).where(eq(hunchesTable.id, id));

    res.json({ ok: true });
  },
);

router.get(
  "/admin/categories",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder, categoriesTable.id);
    res.json(cats);
  },
);

router.post(
  "/admin/categories/reorder",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const { order } = req.body as { order?: number[] };
    if (!Array.isArray(order) || order.length === 0) {
      res.status(400).json({ error: "order must be a non-empty array of ids" });
      return;
    }
    await Promise.all(
      order.map((id, index) =>
        db.update(categoriesTable).set({ sortOrder: index }).where(eq(categoriesTable.id, id)),
      ),
    );
    res.json({ ok: true });
  },
);

router.post(
  "/admin/categories",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const { slug, name, icon, color, enabled } = req.body as Record<string, string | boolean | undefined>;
    if (!slug || !name || !icon || !color) {
      res.status(400).json({ error: "slug, name, icon and color are required" });
      return;
    }
    const [cat] = await db
      .insert(categoriesTable)
      .values({
        slug: String(slug),
        name: String(name),
        icon: String(icon),
        color: String(color),
        enabled: enabled !== false && enabled !== "false",
      })
      .returning();
    res.status(201).json(cat);
  },
);

router.patch(
  "/admin/categories/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { name, icon, color, enabled } = req.body as Record<string, string | boolean | undefined>;
    const updates: Record<string, unknown> = {};
    if (name    !== undefined) updates["name"]    = String(name);
    if (icon    !== undefined) updates["icon"]    = String(icon);
    if (color   !== undefined) updates["color"]   = String(color);
    if (enabled !== undefined) updates["enabled"] = enabled === true || enabled === "true";

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [cat] = await db
      .update(categoriesTable)
      .set(updates)
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    res.json(cat);
  },
);

router.delete(
  "/admin/categories/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ ok: true });
  },
);

router.get(
  "/admin/prizes",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const prizes = await db.select().from(prizesTable);
    res.json(prizes);
  },
);

// ── Users ──────────────────────────────────────────────────────────────────

router.get(
  "/admin/users",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const search = typeof req.query["search"] === "string" ? req.query["search"].trim() : "";
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = 25;
    const offset = (page - 1) * limit;

    const where = search
      ? or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.phone, `%${search}%`))
      : undefined;

    const [users, [{ count }]] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          phone: usersTable.phone,
          status: usersTable.status,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(where)
        .orderBy(usersTable.createdAt)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(where),
    ]);

    res.json({ users, total: count, page, limit });
  },
);

router.get(
  "/admin/users/count",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);
    res.json({ count });
  },
);

router.get(
  "/admin/users/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  },
);

// ── User detail (rich) ─────────────────────────────────────────────────────

function extractCountry(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

router.get(
  "/admin/users/:id/detail",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // ── Ticket stats ─────────────────────────────────────────────────────
    const txRows = await db
      .select({ amount: ticketTransactionsTable.amount })
      .from(ticketTransactionsTable)
      .where(eq(ticketTransactionsTable.userId, id));

    const totalReceived = txRows
      .filter((r) => r.amount > 0)
      .reduce((s, r) => s + r.amount, 0);
    const totalSpent = Math.abs(
      txRows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0),
    );

    // ── Hunch participation ───────────────────────────────────────────────
    const preds = await db
      .select({
        hunchId: predictionsTable.hunchId,
        optionId: predictionsTable.optionId,
        hunchTitle: hunchesTable.title,
        hunchSlug: hunchesTable.slug,
        hunchStatus: hunchesTable.status,
        hunchWinnerOption: hunchesTable.winnerOption,
        hunchEndsAt: hunchesTable.endsAt,
        optionLabel: optionsTable.label,
      })
      .from(predictionsTable)
      .leftJoin(hunchesTable, eq(predictionsTable.hunchId, hunchesTable.id))
      .leftJoin(optionsTable, eq(predictionsTable.optionId, optionsTable.id))
      .where(eq(predictionsTable.userId, id));

    const hunchMap = new Map<number, {
      hunchId: number; title: string; slug: string;
      status: string; endsAt: Date | null;
      predictions: number; won: boolean; prizeLabel: string | null;
    }>();

    for (const p of preds) {
      if (!p.hunchId) continue;
      if (!hunchMap.has(p.hunchId)) {
        hunchMap.set(p.hunchId, {
          hunchId: p.hunchId,
          title: p.hunchTitle ?? "",
          slug: p.hunchSlug ?? "",
          status: p.hunchStatus ?? "open",
          endsAt: p.hunchEndsAt,
          predictions: 0,
          won: false,
          prizeLabel: null,
        });
      }
      const entry = hunchMap.get(p.hunchId)!;
      entry.predictions++;
      if (p.hunchWinnerOption && String(p.optionId) === p.hunchWinnerOption) {
        entry.won = true;
      }
    }

    // Fetch prize labels for won hunches
    const wonHunchIds = [...hunchMap.values()].filter((h) => h.won).map((h) => h.hunchId);
    if (wonHunchIds.length > 0) {
      const wonPrizes = await db
        .select({
          hunchId: hunchPrizeTiersTable.hunchId,
          prizeLabel: prizesTable.label,
        })
        .from(hunchPrizeTiersTable)
        .leftJoin(prizesTable, eq(hunchPrizeTiersTable.prizeId, prizesTable.id))
        .where(and(
          eq(hunchPrizeTiersTable.rank, 1),
        ));
      for (const wp of wonPrizes) {
        const entry = hunchMap.get(wp.hunchId);
        if (entry?.won) entry.prizeLabel = wp.prizeLabel ?? null;
      }
    }

    const hunchParticipation = [...hunchMap.values()];
    const activeHunches = hunchParticipation.filter((h) => h.status === "open");
    const prizesWon = hunchParticipation.filter((h) => h.won);

    // ── Active subscription ───────────────────────────────────────────────
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, id), eq(subscriptionsTable.status, "active")))
      .limit(1);

    // ── Stripe data ───────────────────────────────────────────────────────
    let lifetimeSpendCents = 0;
    let subscriptionSpendCents = 0;
    let paymentMethods: Array<{
      id: string; brand: string; last4: string; expMonth: number; expYear: number;
    }> = [];

    if (user.stripeCustomerId) {
      try {
        const stripe = await getUncachableStripeClient();
        const [charges, invoices, pms] = await Promise.all([
          stripe.charges.list({ customer: user.stripeCustomerId, limit: 100 }),
          stripe.invoices.list({ customer: user.stripeCustomerId, status: "paid", limit: 100 }),
          stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card" }),
        ]);

        lifetimeSpendCents = charges.data
          .filter((c) => c.status === "succeeded")
          .reduce((s, c) => s + c.amount, 0);

        subscriptionSpendCents = invoices.data
          .reduce((s, i) => s + i.amount_paid, 0);

        paymentMethods = pms.data.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand ?? "unknown",
          last4: pm.card?.last4 ?? "????",
          expMonth: pm.card?.exp_month ?? 0,
          expYear: pm.card?.exp_year ?? 0,
        }));
      } catch {
        // Stripe errors are non-fatal — return partial data
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      stripeCustomerId: user.stripeCustomerId,
      country: extractCountry(user.address),
      lastAccessAt: (user as unknown as Record<string, unknown>)["last_access_at"] ?? null,
      ticketStats: {
        currentBalance: user.tickets,
        totalReceived,
        totalSpent,
      },
      lifetimeSpendCents,
      subscriptionSpendCents,
      hunchParticipation,
      activeHunches,
      prizesWon,
      subscription: subscription ?? null,
      paymentMethods,
    });
  },
);

router.patch(
  "/admin/users/:id/status",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { status } = req.body as { status?: string };
    if (!status || !["active", "suspended", "banned"].includes(status)) {
      res.status(400).json({ error: "status must be one of: active, suspended, banned" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ status: status as "active" | "suspended" | "banned" })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  },
);

router.delete(
  "/admin/users/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    // predictions has NO ACTION FK — must delete before user
    await db.delete(predictionsTable).where(eq(predictionsTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  },
);

// ── Campaigns ──────────────────────────────────────────────────────────────

router.get("/admin/campaigns", requireAdmin, requireAdminHeader, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: campaignsTable.id,
      name: campaignsTable.name,
      createdAt: campaignsTable.createdAt,
      codeCount: sql<number>`cast(count(${ticketCodesTable.id}) as int)`,
      activeCount: sql<number>`cast(count(case when ${ticketCodesTable.isActive} then 1 end) as int)`,
      redemptionCount: sql<number>`cast(coalesce(sum(${ticketCodesTable.currentUses}), 0) as int)`,
    })
    .from(campaignsTable)
    .leftJoin(ticketCodesTable, eq(ticketCodesTable.campaignId, campaignsTable.id))
    .groupBy(campaignsTable.id, campaignsTable.name, campaignsTable.createdAt)
    .orderBy(desc(campaignsTable.createdAt));
  res.json(rows);
});

router.post("/admin/campaigns", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Campaign name required" }); return; }
  try {
    const [row] = await db.insert(campaignsTable).values({ name: name.trim() }).returning();
    res.status(201).json(row);
  } catch {
    res.status(409).json({ error: "A campaign with that name already exists" });
  }
});

router.patch("/admin/campaigns/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const body = req.body as Record<string, unknown>;

  if (body["name"]) {
    await db.update(campaignsTable).set({ name: String(body["name"]).trim() }).where(eq(campaignsTable.id, id));
  }

  const codeUpdates: Record<string, unknown> = { updatedAt: new Date() };
  if ("isActive" in body) codeUpdates["isActive"] = body["isActive"] === true || body["isActive"] === "true";
  if ("scope" in body) codeUpdates["scope"] = body["scope"];
  if ("bonusTickets" in body) codeUpdates["bonusTickets"] = Number(body["bonusTickets"]);
  if ("startsAt" in body) codeUpdates["startsAt"] = body["startsAt"] ? new Date(String(body["startsAt"])) : null;
  if ("expiresAt" in body) codeUpdates["expiresAt"] = body["expiresAt"] ? new Date(String(body["expiresAt"])) : null;
  if ("instructions" in body) codeUpdates["instructions"] = body["instructions"] ? String(body["instructions"]) : null;
  if ("termsAndConditions" in body) codeUpdates["termsAndConditions"] = body["termsAndConditions"] ? String(body["termsAndConditions"]) : null;

  if (Object.keys(codeUpdates).length > 1) {
    await db.update(ticketCodesTable).set(codeUpdates).where(eq(ticketCodesTable.campaignId, id));
  }

  const [updated] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  res.json(updated);
});

router.delete("/admin/campaigns/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const codes = await db.select({ id: ticketCodesTable.id }).from(ticketCodesTable).where(eq(ticketCodesTable.campaignId, id));
  for (const c of codes) {
    await db.delete(ticketCodeRedemptionsTable).where(eq(ticketCodeRedemptionsTable.ticketCodeId, c.id));
  }
  await db.delete(ticketCodesTable).where(eq(ticketCodesTable.campaignId, id));
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.json({ ok: true });
});

router.get("/admin/campaigns/:id/codes", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const codes = await db.select().from(ticketCodesTable).where(eq(ticketCodesTable.campaignId, id)).orderBy(ticketCodesTable.createdAt);
  res.json(codes);
});

router.get("/admin/ticket-codes/uncategorized", requireAdmin, requireAdminHeader, async (_req, res): Promise<void> => {
  const codes = await db.select().from(ticketCodesTable)
    .where(sql`${ticketCodesTable.campaignId} is null`)
    .orderBy(desc(ticketCodesTable.createdAt));
  res.json(codes);
});

// ── Ticket Codes ───────────────────────────────────────────────────────────

function generateUniqueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$!";
  const bytes = crypto.randomBytes(9);
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

router.get(
  "/admin/ticket-codes/generate-code",
  requireAdmin,
  requireAdminHeader,
  (_req, res): void => {
    res.json({ code: generateUniqueCode() });
  },
);

router.get(
  "/admin/ticket-codes",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const codes = await db
      .select()
      .from(ticketCodesTable)
      .orderBy(desc(ticketCodesTable.createdAt));
    res.json(codes);
  },
);

router.post(
  "/admin/ticket-codes",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const {
      code, codeType, scope, bonusTickets, maxUses,
      startsAt, expiresAt, instructions, termsAndConditions, isActive, campaignId,
    } = req.body as Record<string, unknown>;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      res.status(400).json({ error: "Code is required" }); return;
    }
    if (!codeType || !["generic", "unique"].includes(String(codeType))) {
      res.status(400).json({ error: "codeType must be 'generic' or 'unique'" }); return;
    }
    if (!bonusTickets || Number(bonusTickets) < 1) {
      res.status(400).json({ error: "bonusTickets must be at least 1" }); return;
    }

    const [row] = await db
      .insert(ticketCodesTable)
      .values({
        campaignId: campaignId != null ? Number(campaignId) : null,
        code: String(code).trim().toUpperCase(),
        codeType: codeType as "generic" | "unique",
        scope: (scope as "registration" | "general" | "both") ?? "both",
        bonusTickets: Number(bonusTickets),
        maxUses: maxUses != null && maxUses !== "" ? Number(maxUses) : null,
        startsAt: startsAt ? new Date(String(startsAt)) : null,
        expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
        instructions: instructions ? String(instructions) : null,
        termsAndConditions: termsAndConditions ? String(termsAndConditions) : null,
        isActive: isActive !== false && isActive !== "false",
      })
      .returning();
    res.status(201).json(row);
  },
);

router.post(
  "/admin/ticket-codes/bulk-generate",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const { count, scope, bonusTickets, startsAt, expiresAt, instructions, termsAndConditions, isActive, campaignId } =
      req.body as Record<string, unknown>;

    const n = Math.min(500, Math.max(1, parseInt(String(count ?? "1"), 10)));
    if (isNaN(n)) { res.status(400).json({ error: "count must be a number 1–500" }); return; }
    if (!bonusTickets || Number(bonusTickets) < 1) { res.status(400).json({ error: "bonusTickets must be at least 1" }); return; }

    const codeSet = new Set<string>();
    while (codeSet.size < n) codeSet.add(generateUniqueCode());

    const rows = await db.insert(ticketCodesTable).values(
      Array.from(codeSet).map((code) => ({
        campaignId: campaignId != null ? Number(campaignId) : null,
        code,
        codeType: "unique" as const,
        scope: (scope as "registration" | "general" | "both") ?? "both",
        bonusTickets: Number(bonusTickets),
        maxUses: null,
        startsAt: startsAt ? new Date(String(startsAt)) : null,
        expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
        instructions: instructions ? String(instructions) : null,
        termsAndConditions: termsAndConditions ? String(termsAndConditions) : null,
        isActive: isActive !== false && isActive !== "false",
      })),
    ).returning();

    res.status(201).json({ codes: rows, count: rows.length });
  },
);

router.get(
  "/admin/ticket-codes/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(ticketCodesTable).where(eq(ticketCodesTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  },
);

router.get(
  "/admin/ticket-codes/:id/redemptions",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    const rows = await db
      .select({
        id: ticketCodeRedemptionsTable.id,
        userId: ticketCodeRedemptionsTable.userId,
        userEmail: usersTable.email,
        ticketsGranted: ticketCodeRedemptionsTable.ticketsGranted,
        context: ticketCodeRedemptionsTable.context,
        redeemedAt: ticketCodeRedemptionsTable.redeemedAt,
      })
      .from(ticketCodeRedemptionsTable)
      .leftJoin(usersTable, eq(ticketCodeRedemptionsTable.userId, usersTable.id))
      .where(eq(ticketCodeRedemptionsTable.ticketCodeId, id))
      .orderBy(desc(ticketCodeRedemptionsTable.redeemedAt));

    res.json(rows);
  },
);

router.patch(
  "/admin/ticket-codes/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    const {
      code, codeType, scope, bonusTickets, maxUses,
      startsAt, expiresAt, instructions, termsAndConditions, isActive,
    } = req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (code !== undefined) updates["code"] = String(code).trim().toUpperCase();
    if (codeType !== undefined) updates["codeType"] = codeType;
    if (scope !== undefined) updates["scope"] = scope;
    if (bonusTickets !== undefined) updates["bonusTickets"] = Number(bonusTickets);
    if ("maxUses" in req.body) updates["maxUses"] = maxUses != null && maxUses !== "" ? Number(maxUses) : null;
    if ("startsAt" in req.body) updates["startsAt"] = startsAt ? new Date(String(startsAt)) : null;
    if ("expiresAt" in req.body) updates["expiresAt"] = expiresAt ? new Date(String(expiresAt)) : null;
    if ("instructions" in req.body) updates["instructions"] = instructions ? String(instructions) : null;
    if ("termsAndConditions" in req.body) updates["termsAndConditions"] = termsAndConditions ? String(termsAndConditions) : null;
    if (isActive !== undefined) updates["isActive"] = isActive === true || isActive === "true";

    const [row] = await db
      .update(ticketCodesTable)
      .set(updates)
      .where(eq(ticketCodesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  },
);

router.delete(
  "/admin/ticket-codes/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(ticketCodeRedemptionsTable).where(eq(ticketCodeRedemptionsTable.ticketCodeId, id));
    await db.delete(ticketCodesTable).where(eq(ticketCodesTable.id, id));
    res.json({ ok: true });
  },
);

// ── Top Notifications ───────────────────────────────────────────────────────

router.get("/admin/notifications", requireAdmin, requireAdminHeader, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(topNotificationsTable)
    .orderBy(desc(topNotificationsTable.createdAt));
  res.json(rows);
});

router.post("/admin/notifications", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const { message, linkUrl, linkLabel, type, isActive, expiresAt } = req.body as {
    message?: string;
    linkUrl?: string;
    linkLabel?: string;
    type?: string;
    isActive?: boolean;
    expiresAt?: string | null;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const VALID_TYPES = ["info", "warning", "success", "promo"];
  const notifType = VALID_TYPES.includes(type ?? "") ? (type as string) : "info";

  const [row] = await db
    .insert(topNotificationsTable)
    .values({
      message: message.trim(),
      linkUrl: linkUrl?.trim() || null,
      linkLabel: linkLabel?.trim() || null,
      type: notifType,
      isActive: isActive !== false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  res.status(201).json(row);
});

router.patch("/admin/notifications/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { message, linkUrl, linkLabel, type, isActive, expiresAt } = req.body as {
    message?: string;
    linkUrl?: string | null;
    linkLabel?: string | null;
    type?: string;
    isActive?: boolean;
    expiresAt?: string | null;
  };

  const VALID_TYPES = ["info", "warning", "success", "promo"];
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (message !== undefined) update.message = message.trim();
  if (linkUrl !== undefined) update.linkUrl = linkUrl?.trim() || null;
  if (linkLabel !== undefined) update.linkLabel = linkLabel?.trim() || null;
  if (type !== undefined && VALID_TYPES.includes(type)) update.type = type;
  if (isActive !== undefined) update.isActive = isActive;
  if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;

  const [row] = await db
    .update(topNotificationsTable)
    .set(update)
    .where(eq(topNotificationsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/notifications/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(topNotificationsTable).where(eq(topNotificationsTable.id, id));
  res.json({ ok: true });
});

router.get(
  "/admin/hunches/:id/predictions",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    // Check if this is a multi-prediction hunch
    const [hunchRow] = await db
      .select({ isMulti: hunchesTable.isMulti })
      .from(hunchesTable)
      .where(eq(hunchesTable.id, id));

    const preds = await db
      .select({
        id: predictionsTable.id,
        userId: predictionsTable.userId,
        optionId: predictionsTable.optionId,
        questionId: predictionsTable.questionId,
        optionLabel: optionsTable.label,
        createdAt: predictionsTable.createdAt,
        username: usersTable.username,
        phone: usersTable.phone,
      })
      .from(predictionsTable)
      .leftJoin(optionsTable, eq(predictionsTable.optionId, optionsTable.id))
      .leftJoin(usersTable, eq(predictionsTable.userId, usersTable.id))
      .where(eq(predictionsTable.hunchId, id))
      .orderBy(asc(predictionsTable.createdAt));

    const total = preds.length;

    // byOption — for single-prediction display
    const groupMap = new Map<string, {
      participants: Array<{ id: number; userId: number | null; username: string | null; phone: string | null; createdAt: Date }>;
    }>();

    for (const p of preds) {
      const label = p.optionLabel ?? "?";
      if (!groupMap.has(label)) groupMap.set(label, { participants: [] });
      groupMap.get(label)!.participants.push({
        id: p.id,
        userId: p.userId,
        username: p.username ?? null,
        phone: p.phone ?? null,
        createdAt: p.createdAt,
      });
    }

    const byOption = Array.from(groupMap.entries())
      .map(([label, g]) => ({
        label,
        count: g.participants.length,
        pct: total > 0 ? Math.round((g.participants.length / total) * 100) : 0,
        participants: g.participants,
      }))
      .sort((a, b) => b.count - a.count);

    // byUser — for multi-prediction: group by user with all their answers
    let byUser: Array<{
      userId: number;
      username: string | null;
      phone: string | null;
      answers: Array<{ questionId: number; answerLabel: string }>;
      firstAt: string;
    }> = [];

    if (hunchRow?.isMulti) {
      const questions = await db
        .select({ id: hunchQuestionsTable.id, sortOrder: hunchQuestionsTable.sortOrder, prompt: hunchQuestionsTable.prompt })
        .from(hunchQuestionsTable)
        .where(eq(hunchQuestionsTable.hunchId, id))
        .orderBy(hunchQuestionsTable.sortOrder);

      const userMap = new Map<number, {
        userId: number;
        username: string | null;
        phone: string | null;
        answers: Array<{ questionId: number; questionPrompt: string; answerLabel: string; sortOrder: number }>;
        firstAt: Date;
      }>();

      for (const p of preds) {
        if (!p.userId) continue;
        if (!userMap.has(p.userId)) {
          userMap.set(p.userId, {
            userId: p.userId,
            username: p.username ?? null,
            phone: p.phone ?? null,
            answers: [],
            firstAt: p.createdAt,
          });
        }
        const entry = userMap.get(p.userId)!;
        const q = questions.find((q) => q.id === p.questionId);
        entry.answers.push({
          questionId: p.questionId ?? 0,
          questionPrompt: q?.prompt ?? `Question ${p.questionId ?? "?"}`,
          answerLabel: p.optionLabel ?? "?",
          sortOrder: q?.sortOrder ?? 0,
        });
      }

      byUser = Array.from(userMap.values())
        .map((u) => ({
          userId: u.userId,
          username: u.username,
          phone: u.phone,
          answers: u.answers
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((a) => ({ questionId: a.questionId, questionPrompt: a.questionPrompt, answerLabel: a.answerLabel })),
          firstAt: u.firstAt.toISOString(),
        }))
        .sort((a, b) => new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime());
    }

    res.json({ total, byOption, byUser });
  },
);

// ─── Metrics ─────────────────────────────────────────────────────────────────

type MetricsPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "this_month"
  | "last_30_days"
  | "this_year"
  | "last_12_months";

router.get("/admin/metrics/users", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const period = (req.query.period as MetricsPeriod) ?? "last_7_days";

  // Build the generate_series range and grouping based on period
  let seriesQuery: string;
  let labelExpr: string;
  let joinExpr: string;
  let prevStart: string;
  let prevEnd: string;

  switch (period) {
    case "today":
      seriesQuery = `generate_series(date_trunc('day', now() AT TIME ZONE 'UTC'), date_trunc('day', now() AT TIME ZONE 'UTC') + interval '23 hours', interval '1 hour')`;
      labelExpr = `to_char(gs, 'HH12 AM')`;
      joinExpr = `date_trunc('hour', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day'`;
      prevEnd = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 second'`;
      break;
    case "yesterday":
      seriesQuery = `generate_series(date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day', date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 hour', interval '1 hour')`;
      labelExpr = `to_char(gs, 'HH12 AM')`;
      joinExpr = `date_trunc('hour', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '2 days'`;
      prevEnd = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day' - interval '1 second'`;
      break;
    case "this_week":
      seriesQuery = `generate_series(date_trunc('week', now() AT TIME ZONE 'UTC'), date_trunc('day', now() AT TIME ZONE 'UTC'), interval '1 day')`;
      labelExpr = `to_char(gs, 'Dy DD')`;
      joinExpr = `date_trunc('day', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('week', now() AT TIME ZONE 'UTC') - interval '7 days'`;
      prevEnd = `date_trunc('week', now() AT TIME ZONE 'UTC') - interval '1 second'`;
      break;
    case "last_7_days":
      seriesQuery = `generate_series(date_trunc('day', now() AT TIME ZONE 'UTC') - interval '6 days', date_trunc('day', now() AT TIME ZONE 'UTC'), interval '1 day')`;
      labelExpr = `to_char(gs, 'Mon DD')`;
      joinExpr = `date_trunc('day', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '13 days'`;
      prevEnd = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '7 days' - interval '1 second'`;
      break;
    case "this_month":
      seriesQuery = `generate_series(date_trunc('month', now() AT TIME ZONE 'UTC'), date_trunc('day', now() AT TIME ZONE 'UTC'), interval '1 day')`;
      labelExpr = `to_char(gs, 'Mon DD')`;
      joinExpr = `date_trunc('day', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month'`;
      prevEnd = `date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 second'`;
      break;
    case "last_30_days":
      seriesQuery = `generate_series(date_trunc('day', now() AT TIME ZONE 'UTC') - interval '29 days', date_trunc('day', now() AT TIME ZONE 'UTC'), interval '1 day')`;
      labelExpr = `to_char(gs, 'Mon DD')`;
      joinExpr = `date_trunc('day', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '59 days'`;
      prevEnd = `date_trunc('day', now() AT TIME ZONE 'UTC') - interval '30 days' - interval '1 second'`;
      break;
    case "this_year":
      seriesQuery = `generate_series(date_trunc('year', now() AT TIME ZONE 'UTC'), date_trunc('month', now() AT TIME ZONE 'UTC'), interval '1 month')`;
      labelExpr = `to_char(gs, 'Mon')`;
      joinExpr = `date_trunc('month', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('year', now() AT TIME ZONE 'UTC') - interval '1 year'`;
      prevEnd = `date_trunc('year', now() AT TIME ZONE 'UTC') - interval '1 second'`;
      break;
    case "last_12_months":
    default:
      seriesQuery = `generate_series(date_trunc('month', now() AT TIME ZONE 'UTC') - interval '11 months', date_trunc('month', now() AT TIME ZONE 'UTC'), interval '1 month')`;
      labelExpr = `to_char(gs, 'Mon YY')`;
      joinExpr = `date_trunc('month', created_at AT TIME ZONE 'UTC') = gs`;
      prevStart = `date_trunc('month', now() AT TIME ZONE 'UTC') - interval '23 months'`;
      prevEnd = `date_trunc('month', now() AT TIME ZONE 'UTC') - interval '12 months' - interval '1 second'`;
      break;
  }

  const [dataRows, prevRows] = await Promise.all([
    db.execute(sql.raw(`
      SELECT
        ${labelExpr} AS label,
        COUNT(u.id)::int AS count
      FROM ${seriesQuery} AS gs
      LEFT JOIN users u ON ${joinExpr}
      GROUP BY gs, label
      ORDER BY gs
    `)),
    db.execute(sql.raw(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE created_at >= ${prevStart}
        AND created_at <= ${prevEnd}
    `)),
  ]);

  const data = (dataRows.rows as { label: string; count: number }[]).map((r) => ({
    label: r.label,
    count: Number(r.count),
  }));

  const total = data.reduce((s, r) => s + r.count, 0);
  const previousTotal = Number((prevRows.rows as { total: number }[])[0]?.total ?? 0);

  res.json({ period, total, previousTotal, data });
});

export default router;
