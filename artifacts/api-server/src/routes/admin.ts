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
} from "@workspace/db";
import { eq, or, ilike, sql, desc, and } from "drizzle-orm";

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
    res.json({ ...hunch, prizeTiers: tiers });
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
      })
      .returning();

    await db.insert(hunchPrizeTiersTable).values(
      resolvedTiers.map((t) => ({ hunchId: hunch.id, rank: t.rank, prizeId: t.prizeId })),
    );

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
    if (categoryId !== undefined) updates["categoryId"] = Number(categoryId);
    if (prizeId !== undefined) updates["prizeId"] = Number(prizeId);
    if (featured !== undefined)
      updates["featured"] = featured === true || featured === "true";
    if (endsAt !== undefined) updates["endsAt"] = new Date(String(endsAt));
    if (status !== undefined) updates["status"] = status;
    if (winnerOption !== undefined)
      updates["winnerOption"] = winnerOption ? String(winnerOption) : null;
    if (answerType !== undefined) updates["answerType"] = String(answerType);
    if (req.body.ticketCost !== undefined) updates["ticketCost"] = Number(req.body.ticketCost);
    if ("rules" in req.body) updates["rules"] = req.body.rules ? String(req.body.rules) : null;

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

export default router;
