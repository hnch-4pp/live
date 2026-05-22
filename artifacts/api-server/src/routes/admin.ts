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
} from "@workspace/db";
import { eq, or, ilike, sql } from "drizzle-orm";

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
      .select({ rank: hunchPrizeTiersTable.rank, prizeId: hunchPrizeTiersTable.prizeId })
      .from(hunchPrizeTiersTable)
      .where(eq(hunchPrizeTiersTable.hunchId, id))
      .orderBy(hunchPrizeTiersTable.rank);
    res.json({ ...hunch, prizeTiers: tiers });
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
      prizeId,
      featured,
      endsAt,
      status,
      answerType,
    } = req.body as Record<string, string | boolean | number | undefined>;

    if (!title || !description || !categoryId || !prizeId || !endsAt) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const providedSlug = req.body.slug ? String(req.body.slug).trim() : null;
    const generatedSlug = toSlug(String(title));

    const prizeTiers = Array.isArray(req.body.prizeTiers)
      ? (req.body.prizeTiers as { rank: number; prizeId: number }[])
      : [];
    const firstPrizeId = prizeTiers.length > 0 ? prizeTiers[0].prizeId : Number(prizeId);

    const [hunch] = await db
      .insert(hunchesTable)
      .values({
        slug: providedSlug || generatedSlug,
        title: String(title),
        description: String(description),
        imageUrl: imageUrl ? String(imageUrl) : null,
        categoryId: Number(categoryId),
        prizeId: firstPrizeId,
        featured: featured === true || featured === "true",
        endsAt: new Date(String(endsAt)),
        status: (status as "open" | "closed" | "resolved") ?? "open",
        answerType: (answerType as string) ?? "integer",
        rules: req.body.rules ? String(req.body.rules) : null,
      })
      .returning();

    if (prizeTiers.length > 0) {
      await db.insert(hunchPrizeTiersTable).values(
        prizeTiers.map((t) => ({ hunchId: hunch.id, rank: t.rank, prizeId: t.prizeId })),
      );
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
    if (categoryId !== undefined) updates["categoryId"] = Number(categoryId);
    if (prizeId !== undefined) updates["prizeId"] = Number(prizeId);
    if (featured !== undefined)
      updates["featured"] = featured === true || featured === "true";
    if (endsAt !== undefined) updates["endsAt"] = new Date(String(endsAt));
    if (status !== undefined) updates["status"] = status;
    if (winnerOption !== undefined)
      updates["winnerOption"] = winnerOption ? String(winnerOption) : null;
    if (answerType !== undefined) updates["answerType"] = String(answerType);
    if ("rules" in req.body) updates["rules"] = req.body.rules ? String(req.body.rules) : null;

    // Prize tiers
    if (Array.isArray(req.body.prizeTiers)) {
      const tiers = req.body.prizeTiers as { rank: number; prizeId: number }[];
      if (tiers.length > 0) {
        updates["prizeId"] = tiers[0].prizeId;
        await db.delete(hunchPrizeTiersTable).where(eq(hunchPrizeTiersTable.hunchId, id));
        await db.insert(hunchPrizeTiersTable).values(
          tiers.map((t) => ({ hunchId: id, rank: t.rank, prizeId: t.prizeId })),
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

router.delete(
  "/admin/users/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  },
);

export default router;
