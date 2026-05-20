import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  hunchesTable,
  categoriesTable,
  prizesTable,
  optionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    admin: boolean;
  }
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
        createdAt: hunchesTable.createdAt,
      })
      .from(hunchesTable)
      .orderBy(hunchesTable.createdAt);
    res.json(hunches);
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
    } = req.body as Record<string, string | boolean | number | undefined>;

    if (!title || !description || !categoryId || !prizeId || !endsAt) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [hunch] = await db
      .insert(hunchesTable)
      .values({
        title: String(title),
        description: String(description),
        imageUrl: imageUrl ? String(imageUrl) : null,
        categoryId: Number(categoryId),
        prizeId: Number(prizeId),
        featured: featured === true || featured === "true",
        endsAt: new Date(String(endsAt)),
        status: (status as "open" | "closed" | "resolved") ?? "open",
      })
      .returning();

    res.status(201).json(hunch);
  },
);

router.patch(
  "/admin/hunches/:id",
  requireAdmin,
  requireAdminHeader,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params["id"] ?? "0", 10);
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
    } = req.body as Record<string, string | boolean | number | undefined>;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates["title"] = String(title);
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
    const id = parseInt(req.params["id"] ?? "0", 10);
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
    const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
    res.json(cats);
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
    const id = parseInt(req.params["id"] ?? "0", 10);
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

router.get(
  "/admin/prizes",
  requireAdmin,
  requireAdminHeader,
  async (_req, res): Promise<void> => {
    const prizes = await db.select().from(prizesTable);
    res.json(prizes);
  },
);

export default router;
