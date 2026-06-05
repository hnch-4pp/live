import { Router } from "express";
import { eq, and, desc, sql, isNull, or, count, sum, ilike } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  affiliatesTable,
  affiliateClicksTable,
  referralsTable,
  affiliateTiersTable,
  affiliateCommissionsTable,
  affiliatePayoutsTable,
  usersTable,
  subscriptionsTable,
} from "@workspace/db";

const router = Router();

// ─── Reserved slugs ───────────────────────────────────────────────────────────

const RESERVED_SLUGS = new Set([
  "admin", "affiliate", "affiliates", "login", "signup", "api", "dashboard",
  "checkout", "terms", "privacy", "responsible", "backstage", "account",
  "tickets", "pricing", "hunch", "hunches", "home", "me", "settings",
  "my-hunches", "not-found", "404", "health", "static", "assets",
]);

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "hunch-salt").digest("hex").slice(0, 16);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

async function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  if (!req.session?.admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function requireAdminHeader(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  if (req.headers["x-admin-request"] !== "1") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

async function requireUser(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// ─── Helper: find affiliate by userId, fall back to email, auto-link ─────────

async function findAffiliateForUser(userId: number): Promise<typeof affiliatesTable.$inferSelect | null> {
  // Primary: match by userId
  const [byId] = await db.select().from(affiliatesTable)
    .where(eq(affiliatesTable.userId, userId)).limit(1);
  if (byId) return byId;

  // Fallback: match by email (affiliate created before user signed up)
  const [user] = await db.select({ email: usersTable.email }).from(usersTable)
    .where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  const [byEmail] = await db.select().from(affiliatesTable)
    .where(eq(affiliatesTable.email, user.email)).limit(1);
  if (!byEmail) return null;

  // Auto-link: set userId on the affiliate record for future lookups
  await db.update(affiliatesTable)
    .set({ userId })
    .where(eq(affiliatesTable.id, byEmail.id));

  return { ...byEmail, userId };
}

async function requireActiveAffiliate(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const aff = await findAffiliateForUser(req.session.userId);
  if (!aff) {
    res.status(403).json({ error: "Affiliate account not found" });
    return;
  }
  if (aff.status !== "active") {
    res.status(403).json({ error: "Affiliate account is not active", status: aff.status });
    return;
  }
  (req as any).affiliate = aff;
  next();
}

// ─── Helper: compute affiliate tier ──────────────────────────────────────────

async function getAffiliateTier(affiliateId: number): Promise<{
  current: typeof affiliateTiersTable.$inferSelect | null;
  next: typeof affiliateTiersTable.$inferSelect | null;
  activePremiumCount: number;
}> {
  const [row] = await db
    .select({ cnt: count() })
    .from(referralsTable)
    .innerJoin(subscriptionsTable, eq(subscriptionsTable.userId, referralsTable.referredUserId))
    .where(
      and(
        eq(referralsTable.affiliateId, affiliateId),
        eq(subscriptionsTable.status, "active"),
      ),
    );
  const activePremiumCount = Number(row?.cnt ?? 0);

  const tiers = await db
    .select()
    .from(affiliateTiersTable)
    .where(eq(affiliateTiersTable.isActive, true))
    .orderBy(affiliateTiersTable.minActivePremiumUsers);

  let current: typeof affiliateTiersTable.$inferSelect | null = null;
  let next: typeof affiliateTiersTable.$inferSelect | null = null;

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    const max = t.maxActivePremiumUsers ?? Infinity;
    if (activePremiumCount >= t.minActivePremiumUsers && activePremiumCount <= max) {
      current = t;
      next = tiers[i + 1] ?? null;
      break;
    }
  }
  if (!current && tiers.length > 0) {
    current = tiers[0]!;
    next = tiers[1] ?? null;
  }

  return { current, next, activePremiumCount };
}

// ─── Public: list active commission tiers ────────────────────────────────────

router.get("/affiliates/tiers", async (_req, res): Promise<void> => {
  const tiers = await db.select().from(affiliateTiersTable)
    .where(eq(affiliateTiersTable.isActive, true))
    .orderBy(affiliateTiersTable.minActivePremiumUsers);
  res.json({ tiers });
});

// ─── Public: get affiliate by slug ───────────────────────────────────────────

router.get("/affiliates/public/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const [row] = await db
    .select({
      id: affiliatesTable.id,
      name: affiliatesTable.name,
      slug: affiliatesTable.slug,
      affiliateAvatarUrl: affiliatesTable.avatarUrl,
      userAvatarUrl: usersTable.avatarUrl,
      bio: affiliatesTable.bio,
      niche: affiliatesTable.niche,
      customMessage: affiliatesTable.customMessage,
    })
    .from(affiliatesTable)
    .leftJoin(usersTable, eq(usersTable.id, affiliatesTable.userId))
    .where(and(eq(affiliatesTable.slug, slug.toLowerCase()), eq(affiliatesTable.status, "active")))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Affiliate not found" });
    return;
  }
  res.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    avatarUrl: row.affiliateAvatarUrl ?? row.userAvatarUrl,
    bio: row.bio,
    niche: row.niche,
    customMessage: row.customMessage,
  });
});

// ─── Public: track click ─────────────────────────────────────────────────────

router.post("/affiliates/click", async (req, res): Promise<void> => {
  const { slug, visitorId, landingPage } = req.body as {
    slug?: string; visitorId?: string; landingPage?: string;
  };
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  const [aff] = await db.select({ id: affiliatesTable.id })
    .from(affiliatesTable)
    .where(and(eq(affiliatesTable.slug, slug.toLowerCase()), eq(affiliatesTable.status, "active")))
    .limit(1);
  if (!aff) { res.status(404).json({ error: "Affiliate not found" }); return; }

  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "";
  await db.insert(affiliateClicksTable).values({
    affiliateId: aff.id,
    slug: slug.toLowerCase(),
    visitorId: visitorId ?? null,
    ipHash: hashIp(rawIp),
    userAgent: req.headers["user-agent"]?.slice(0, 512) ?? null,
    landingPage: landingPage?.slice(0, 512) ?? null,
  });

  res.json({ ok: true });
});

// ─── Public: apply to affiliate program ──────────────────────────────────────

router.post("/affiliates/apply", async (req, res): Promise<void> => {
  const { name, email, slug, bio, niche, customMessage, socialLinks } = req.body as {
    name?: string; email?: string; slug?: string;
    bio?: string; niche?: string; customMessage?: string;
    socialLinks?: Record<string, string>;
  };

  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" }); return;
  }
  if (!slug) { res.status(400).json({ error: "Slug required" }); return; }

  const normalized = normalizeSlug(slug);
  if (!isValidSlug(normalized)) {
    res.status(400).json({ error: "Invalid slug. Use 3-50 lowercase letters, numbers, or hyphens." }); return;
  }

  const [existing] = await db.select({ id: affiliatesTable.id })
    .from(affiliatesTable).where(eq(affiliatesTable.slug, normalized)).limit(1);
  if (existing) { res.status(409).json({ error: "This slug is already taken" }); return; }

  const userId = req.session?.userId ?? null;

  const cleanedLinks: Record<string, string> = {};
  if (socialLinks && typeof socialLinks === "object") {
    for (const [k, v] of Object.entries(socialLinks)) {
      const trimmed = String(v).trim();
      if (trimmed) cleanedLinks[k] = trimmed;
    }
  }

  const [aff] = await db.insert(affiliatesTable).values({
    userId,
    name: name.trim(),
    slug: normalized,
    email: email.toLowerCase().trim(),
    bio: bio?.trim() ?? null,
    niche: niche?.trim() ?? null,
    customMessage: customMessage?.trim() ?? null,
    socialLinks: Object.keys(cleanedLinks).length > 0 ? cleanedLinks : null,
    status: "pending",
  }).returning();

  res.json({ ok: true, affiliate: { id: aff.id, slug: aff.slug, status: aff.status } });
});

// ─── Affiliate: get my affiliate record ──────────────────────────────────────

router.get("/affiliate/me", requireUser, async (req, res): Promise<void> => {
  const aff = await findAffiliateForUser(req.session!.userId!);
  if (!aff) { res.status(404).json({ error: "Not an affiliate" }); return; }
  res.json(aff);
});

// ─── Affiliate: dashboard stats ───────────────────────────────────────────────

router.get("/affiliate/dashboard", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;

  const [clicks, referrals, commissions, payouts, tier] = await Promise.all([
    db.select({ cnt: count() }).from(affiliateClicksTable)
      .where(eq(affiliateClicksTable.affiliateId, aff.id)),
    db.select({ cnt: count(), status: referralsTable.status })
      .from(referralsTable)
      .where(eq(referralsTable.affiliateId, aff.id))
      .groupBy(referralsTable.status),
    db.select({
      status: affiliateCommissionsTable.status,
      total: sum(affiliateCommissionsTable.commissionAmount),
    })
      .from(affiliateCommissionsTable)
      .where(eq(affiliateCommissionsTable.affiliateId, aff.id))
      .groupBy(affiliateCommissionsTable.status),
    db.select({
      status: affiliatePayoutsTable.status,
      total: sum(affiliatePayoutsTable.amount),
    })
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.affiliateId, aff.id))
      .groupBy(affiliatePayoutsTable.status),
    getAffiliateTier(aff.id),
  ]);

  const totalClicks = Number(clicks[0]?.cnt ?? 0);
  const signups = referrals.find(r => r.status === "signed_up");
  const converted = referrals.find(r => r.status === "converted");
  const active = referrals.find(r => r.status === "active");

  const totalSignups = referrals.reduce((s, r) => s + Number(r.cnt), 0);
  const totalConverted = Number(converted?.cnt ?? 0) + Number(active?.cnt ?? 0);

  const commMap: Record<string, number> = {};
  for (const c of commissions) {
    commMap[c.status] = Number(c.total ?? 0);
  }
  const payMap: Record<string, number> = {};
  for (const p of payouts) {
    payMap[p.status] = Number(p.total ?? 0);
  }

  res.json({
    affiliate: {
      id: aff.id, name: aff.name, slug: aff.slug,
      avatarUrl: aff.avatarUrl, bio: aff.bio, niche: aff.niche,
      status: aff.status,
    },
    stats: {
      totalClicks,
      totalSignups,
      totalConverted,
      activePremiumUsers: tier.activePremiumCount,
      conversionRate: totalClicks > 0 ? Math.round((totalSignups / totalClicks) * 10000) / 100 : 0,
      commissionPending: commMap["pending"] ?? 0,
      commissionApproved: commMap["approved"] ?? 0,
      commissionPaid: (commMap["paid"] ?? 0) + (payMap["paid"] ?? 0),
      commissionTotal: Object.values(commMap).reduce((s, v) => s + v, 0),
    },
    tier: {
      current: tier.current,
      next: tier.next,
      activePremiumCount: tier.activePremiumCount,
      usersToNextTier: tier.next
        ? Math.max(0, tier.next.minActivePremiumUsers - tier.activePremiumCount)
        : 0,
    },
  });
});

// ─── Affiliate: referrals list ────────────────────────────────────────────────

router.get("/affiliate/referrals", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;
  const refs = await db
    .select({
      id: referralsTable.id,
      status: referralsTable.status,
      signupAt: referralsTable.signupAt,
      convertedAt: referralsTable.convertedAt,
      firstPurchaseAt: referralsTable.firstPurchaseAt,
      username: usersTable.username,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(usersTable.id, referralsTable.referredUserId))
    .where(eq(referralsTable.affiliateId, aff.id))
    .orderBy(desc(referralsTable.signupAt))
    .limit(200);
  res.json({ referrals: refs });
});

// ─── Affiliate: commissions list ──────────────────────────────────────────────

router.get("/affiliate/commissions", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;
  const comms = await db
    .select()
    .from(affiliateCommissionsTable)
    .where(eq(affiliateCommissionsTable.affiliateId, aff.id))
    .orderBy(desc(affiliateCommissionsTable.earnedAt))
    .limit(200);
  res.json({ commissions: comms });
});

// ─── Affiliate: payouts list ──────────────────────────────────────────────────

router.get("/affiliate/payouts", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;
  const pays = await db
    .select()
    .from(affiliatePayoutsTable)
    .where(eq(affiliatePayoutsTable.affiliateId, aff.id))
    .orderBy(desc(affiliatePayoutsTable.createdAt))
    .limit(100);
  res.json({ payouts: pays });
});

// ─── Affiliate: update profile ────────────────────────────────────────────────

router.put("/affiliate/profile", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;
  const { bio, niche, customMessage, avatarUrl } = req.body as {
    bio?: string; niche?: string; customMessage?: string; avatarUrl?: string;
  };
  await db.update(affiliatesTable).set({
    bio: bio?.trim() ?? aff.bio,
    niche: niche?.trim() ?? aff.niche,
    customMessage: customMessage?.trim() ?? aff.customMessage,
    avatarUrl: avatarUrl?.trim() ?? aff.avatarUrl,
    updatedAt: new Date(),
  }).where(eq(affiliatesTable.id, aff.id));
  res.json({ ok: true });
});

// ─── Affiliate: revenue by month ──────────────────────────────────────────────

router.get("/affiliate/revenue", requireActiveAffiliate, async (req, res): Promise<void> => {
  const aff = (req as any).affiliate as typeof affiliatesTable.$inferSelect;
  const rows = await db.execute(sql.raw(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', earned_at), 'Mon YY') AS month,
      DATE_TRUNC('month', earned_at) AS month_start,
      SUM(revenue_amount) AS revenue,
      SUM(commission_amount) AS commission,
      COUNT(DISTINCT referred_user_id) AS users
    FROM affiliate_commissions
    WHERE affiliate_id = ${aff.id}
    GROUP BY DATE_TRUNC('month', earned_at)
    ORDER BY month_start DESC
    LIMIT 12
  `));
  res.json({ revenue: rows.rows });
});

// ─── Admin: list affiliates ───────────────────────────────────────────────────

router.get("/admin/affiliates", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const { q, status } = req.query as { q?: string; status?: string };
  let query = db.select().from(affiliatesTable);
  const filters: any[] = [];
  if (status && ["pending", "active", "suspended", "rejected"].includes(status)) {
    filters.push(eq(affiliatesTable.status, status as any));
  }
  if (q?.trim()) {
    filters.push(or(
      ilike(affiliatesTable.name, `%${q.trim()}%`),
      ilike(affiliatesTable.slug, `%${q.trim()}%`),
      ilike(affiliatesTable.email, `%${q.trim()}%`),
    ));
  }
  const affiliates = filters.length > 0
    ? await db.select().from(affiliatesTable).where(and(...filters)).orderBy(desc(affiliatesTable.createdAt)).limit(200)
    : await db.select().from(affiliatesTable).orderBy(desc(affiliatesTable.createdAt)).limit(200);
  res.json({ affiliates });
});

// ─── Admin: get affiliate detail ──────────────────────────────────────────────

router.get("/admin/affiliates/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [aff] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, id)).limit(1);
  if (!aff) { res.status(404).json({ error: "Not found" }); return; }

  const [clicks, referralRows, commRow, tierData] = await Promise.all([
    db.select({ cnt: count() }).from(affiliateClicksTable).where(eq(affiliateClicksTable.affiliateId, id)),
    db.select({ cnt: count(), status: referralsTable.status })
      .from(referralsTable).where(eq(referralsTable.affiliateId, id)).groupBy(referralsTable.status),
    db.select({ total: sum(affiliateCommissionsTable.commissionAmount) })
      .from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.affiliateId, id)),
    getAffiliateTier(id),
  ]);

  res.json({
    affiliate: aff,
    stats: {
      totalClicks: Number(clicks[0]?.cnt ?? 0),
      totalSignups: referralRows.reduce((s, r) => s + Number(r.cnt), 0),
      totalCommission: Number(commRow[0]?.total ?? 0),
      activePremiumUsers: tierData.activePremiumCount,
    },
    tier: tierData.current,
  });
});

// ─── Admin: create affiliate ──────────────────────────────────────────────────

router.post("/admin/affiliates", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const { name, email, slug, bio, niche, customMessage, status } = req.body as {
    name?: string; email?: string; slug?: string; bio?: string;
    niche?: string; customMessage?: string; status?: string;
  };

  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" }); return;
  }
  if (!slug) { res.status(400).json({ error: "Slug required" }); return; }

  const normalized = normalizeSlug(slug);
  if (!isValidSlug(normalized)) {
    res.status(400).json({ error: "Invalid slug" }); return;
  }

  const [existing] = await db.select({ id: affiliatesTable.id })
    .from(affiliatesTable).where(eq(affiliatesTable.slug, normalized)).limit(1);
  if (existing) { res.status(409).json({ error: "Slug already taken" }); return; }

  const approvedStatus = (status === "active") ? "active" : "pending";
  const [aff] = await db.insert(affiliatesTable).values({
    name: name.trim(),
    slug: normalized,
    email: email.toLowerCase().trim(),
    bio: bio?.trim() ?? null,
    niche: niche?.trim() ?? null,
    customMessage: customMessage?.trim() ?? null,
    status: approvedStatus,
    approvedAt: approvedStatus === "active" ? new Date() : null,
  }).returning();

  res.json({ ok: true, affiliate: aff });
});

// ─── Admin: update affiliate ──────────────────────────────────────────────────

router.put("/admin/affiliates/:id", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { name, email, slug, bio, niche, customMessage, status } = req.body as {
    name?: string; email?: string; slug?: string; bio?: string;
    niche?: string; customMessage?: string; status?: string;
  };

  const [aff] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, id)).limit(1);
  if (!aff) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Partial<typeof affiliatesTable.$inferInsert> = { updatedAt: new Date() };

  if (name?.trim()) updates.name = name.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) updates.email = email.toLowerCase().trim();
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (niche !== undefined) updates.niche = niche.trim() || null;
  if (customMessage !== undefined) updates.customMessage = customMessage.trim() || null;

  if (slug) {
    const normalized = normalizeSlug(slug);
    if (!isValidSlug(normalized)) { res.status(400).json({ error: "Invalid slug" }); return; }
    if (normalized !== aff.slug) {
      const [existing] = await db.select({ id: affiliatesTable.id })
        .from(affiliatesTable).where(eq(affiliatesTable.slug, normalized)).limit(1);
      if (existing) { res.status(409).json({ error: "Slug already taken" }); return; }
    }
    updates.slug = normalized;
  }

  const beingApproved = status === "active" && aff.status !== "active";

  if (status && ["pending", "active", "suspended", "rejected"].includes(status)) {
    updates.status = status as any;
    if (beingApproved) {
      updates.approvedAt = new Date();
    }
  }

  await db.update(affiliatesTable).set(updates).where(eq(affiliatesTable.id, id));

  if (beingApproved) {
    const finalSlug = updates.slug ?? aff.slug;
    sendAffiliateWelcomeEmail({ name: updates.name ?? aff.name, email: updates.email ?? aff.email, slug: finalSlug }).catch(() => {});
  }

  res.json({ ok: true });
});

// ─── Admin: invite affiliate ──────────────────────────────────────────────────

router.post("/admin/affiliates/invite", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const { name, email, slug, message } = req.body as {
    name?: string; email?: string; slug?: string; message?: string;
  };
  if (!name?.trim() || !email || !slug) {
    res.status(400).json({ error: "name, email, and slug required" }); return;
  }

  const normalized = normalizeSlug(slug);
  const inviteLink = `${process.env.APP_URL ?? "https://hunch.fan"}/affiliate?invite=${encodeURIComponent(normalized)}&email=${encodeURIComponent(email.toLowerCase())}`;

  // Send email via Resend
  await sendAffiliateInviteEmail({ name: name.trim(), email: email.toLowerCase(), inviteLink, message });

  res.json({ ok: true, inviteLink });
});

/**
 * Send affiliate invitation email via Resend.
 * Connect to Resend, SendGrid, or Postmark by updating this function.
 */
async function sendAffiliateInviteEmail({
  name, email, inviteLink, message,
}: { name: string; email: string; inviteLink: string; message?: string }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured — cannot send invitation email");
  }
  const body = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a2e">You're invited to join Hunch as an affiliate</h2>
      <p style="color:#555;font-size:15px;margin:0 0 12px">Hi ${name},</p>
      ${message ? `<p style="color:#555;font-size:15px;margin:0 0 20px">${message}</p>` : ""}
      <p style="color:#555;font-size:15px;margin:0 0 20px">
        Click the button below to set up your affiliate account and start earning commissions.
      </p>
      <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
        Accept invitation
      </a>
      <p style="color:#aaa;font-size:12px;margin:24px 0 0">
        Hunch — a skill-based prediction platform. No money wagered.
      </p>
    </div>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Hunch <no-reply@hunch.fan>", to: [email], subject: "You're invited to Hunch's affiliate program", html: body }),
  }).catch(() => {});
}

async function sendAffiliateWelcomeEmail({ name, email, slug }: { name: string; email: string; slug: string }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[AFFILIATES] RESEND_API_KEY not configured — welcome email not sent");
    return;
  }
  const affiliateLink = `https://hunch.fan/${slug}`;
  const dashboardLink = `https://hunch.fan/affiliate/dashboard`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <!-- Header -->
      <div style="background:#7c3aed;padding:32px 32px 28px">
        <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px">hunch</p>
        <p style="margin:8px 0 0;font-size:13px;color:#ddd6fe;text-transform:uppercase;letter-spacing:1px">Programa de afiliados</p>
      </div>

      <!-- Body -->
      <div style="padding:32px">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Bienvenido al programa, ${name}</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6b7280">Tu solicitud fue aprobada. Ya puedes empezar a compartir tu link y ganar comisiones.</p>

        <!-- Link box -->
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px 24px;margin-bottom:28px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.8px">Tu link de afiliado</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#4c1d95;word-break:break-all">${affiliateLink}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#7c3aed">Comparte este link con tu comunidad. Cada usuario que se registre quedara asociado a ti.</p>
        </div>

        <!-- Steps -->
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827">Como empezar</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <tr>
            <td style="vertical-align:top;padding:0 14px 18px 0;width:32px">
              <div style="width:28px;height:28px;background:#7c3aed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff">1</div>
            </td>
            <td style="vertical-align:top;padding-bottom:18px">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827">Comparte tu link</p>
              <p style="margin:0;font-size:13px;color:#6b7280">Publica <strong>${affiliateLink}</strong> en tus redes sociales, videos, stories o donde sea que este tu comunidad.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 14px 18px 0">
              <div style="width:28px;height:28px;background:#7c3aed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff">2</div>
            </td>
            <td style="vertical-align:top;padding-bottom:18px">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827">Tus seguidores se registran</p>
              <p style="margin:0;font-size:13px;color:#6b7280">Cada usuario que llegue desde tu link recibe <strong>50% de descuento en su primer mes premium</strong>. Eso motiva la conversion.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 14px 0 0">
              <div style="width:28px;height:28px;background:#7c3aed;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff">3</div>
            </td>
            <td style="vertical-align:top">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827">Cobra comisiones recurrentes</p>
              <p style="margin:0;font-size:13px;color:#6b7280">Ganas comision cada mes que tus usuarios mantengan su suscripcion premium. A mas usuarios activos, mayor es tu tier.</p>
            </td>
          </tr>
        </table>

        <!-- Tiers -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:28px">
          <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Tiers de comision</p>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 8px 6px 0;font-size:13px;font-weight:600;color:#374151;width:80px">Starter</td>
              <td style="padding:6px 8px;font-size:13px;color:#6b7280">0 – 50 usuarios premium activos</td>
              <td style="padding:6px 0 6px 8px;font-size:13px;font-weight:700;color:#7c3aed;text-align:right">20%</td>
            </tr>
            <tr style="background:#f3f4f6">
              <td style="padding:6px 8px 6px 0;font-size:13px;font-weight:600;color:#374151;border-radius:4px 0 0 4px">Growth</td>
              <td style="padding:6px 8px;font-size:13px;color:#6b7280">51 – 250 usuarios premium activos</td>
              <td style="padding:6px 0 6px 8px;font-size:13px;font-weight:700;color:#7c3aed;text-align:right">25%</td>
            </tr>
            <tr>
              <td style="padding:6px 8px 6px 0;font-size:13px;font-weight:600;color:#374151">Pro</td>
              <td style="padding:6px 8px;font-size:13px;color:#6b7280">251 – 1,000 usuarios premium activos</td>
              <td style="padding:6px 0 6px 8px;font-size:13px;font-weight:700;color:#7c3aed;text-align:right">30%</td>
            </tr>
            <tr style="background:#f3f4f6">
              <td style="padding:6px 8px 6px 0;font-size:13px;font-weight:600;color:#374151">Elite</td>
              <td style="padding:6px 8px;font-size:13px;color:#6b7280">1,001+ usuarios premium activos</td>
              <td style="padding:6px 0 6px 8px;font-size:13px;font-weight:700;color:#7c3aed;text-align:right">35%</td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">Tickets: 10% de comision fija independiente del tier. Comisiones calculadas sobre revenue neto.</p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:28px">
          <a href="${dashboardLink}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
            Ver mi dashboard de afiliado
          </a>
        </div>

        <!-- Tips -->
        <div style="border-left:3px solid #7c3aed;padding:12px 16px;background:#faf5ff;border-radius:0 8px 8px 0;margin-bottom:24px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#4c1d95">Tips para maximizar tus comisiones</p>
          <ul style="margin:0;padding-left:16px;font-size:13px;color:#6b7280;line-height:1.8">
            <li>Menciona la plataforma en contexto: cuando hagas predicciones o comentarios de resultados</li>
            <li>Recuerda el descuento del 50% — es tu mejor argumento de conversion</li>
            <li>Comparte tu link regularmente, no solo una vez</li>
            <li>Engancha a tu comunidad con hunches de su nicho</li>
          </ul>
        </div>

        <p style="margin:0;font-size:14px;color:#6b7280">Si tienes preguntas, responde a este correo o contactanos en <a href="mailto:hola@hunch.fan" style="color:#7c3aed;text-decoration:none">hola@hunch.fan</a>.</p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
          Hunch es una plataforma de predicciones basada en habilidad. No se apuesta dinero real.<br>
          <a href="https://hunch.fan/terms" style="color:#9ca3af">Terminos</a> &nbsp;·&nbsp;
          <a href="https://hunch.fan/privacy" style="color:#9ca3af">Privacidad</a> &nbsp;·&nbsp;
          <a href="https://hunch.fan/responsible" style="color:#9ca3af">Juego responsable</a>
        </p>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Hunch <no-reply@hunch.fan>",
      to: [email],
      subject: `Bienvenido al programa de afiliados, ${name}`,
      html,
    }),
  }).catch((err) => {
    console.error("[AFFILIATES] Failed to send welcome email:", err);
  });
}

// ─── Admin: affiliate tiers CRUD ──────────────────────────────────────────────

async function getTiersHandler(_req: import("express").Request, res: import("express").Response): Promise<void> {
  const tiers = await db.select().from(affiliateTiersTable).orderBy(affiliateTiersTable.minActivePremiumUsers);
  res.json({ tiers });
}

async function createTierHandler(req: import("express").Request, res: import("express").Response): Promise<void> {
  const { name, minActivePremiumUsers, maxActivePremiumUsers, commissionPercentage } = req.body as {
    name?: string; minActivePremiumUsers?: unknown; maxActivePremiumUsers?: unknown; commissionPercentage?: unknown;
  };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const pct = Number(commissionPercentage);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    res.status(400).json({ error: "Commission percentage must be a number between 0 and 100" }); return;
  }
  const minUsers = Number(minActivePremiumUsers ?? 0);
  const maxUsersRaw = maxActivePremiumUsers != null && String(maxActivePremiumUsers).trim() !== "" ? Number(maxActivePremiumUsers) : null;
  const [tier] = await db.insert(affiliateTiersTable).values({
    name: name.trim(),
    minActivePremiumUsers: isNaN(minUsers) ? 0 : minUsers,
    maxActivePremiumUsers: maxUsersRaw !== null && isNaN(maxUsersRaw) ? null : maxUsersRaw,
    commissionPercentage: pct,
    isActive: true,
  }).returning();
  res.json({ ok: true, tier });
}

async function updateTierHandler(req: import("express").Request, res: import("express").Response): Promise<void> {
  const id = Number(req.params["id"]);
  const { name, minActivePremiumUsers, maxActivePremiumUsers, commissionPercentage, isActive } = req.body as {
    name?: string; minActivePremiumUsers?: number; maxActivePremiumUsers?: number | null;
    commissionPercentage?: number; isActive?: boolean;
  };
  const updates: Partial<typeof affiliateTiersTable.$inferInsert> = { updatedAt: new Date() };
  if (name?.trim()) updates.name = name.trim();
  if (minActivePremiumUsers != null) updates.minActivePremiumUsers = Number(minActivePremiumUsers);
  if (maxActivePremiumUsers !== undefined) updates.maxActivePremiumUsers = maxActivePremiumUsers != null ? Number(maxActivePremiumUsers) : null;
  if (commissionPercentage != null) updates.commissionPercentage = Number(commissionPercentage);
  if (isActive != null) updates.isActive = isActive;
  await db.update(affiliateTiersTable).set(updates).where(eq(affiliateTiersTable.id, id));
  res.json({ ok: true });
}

async function deleteTierHandler(req: import("express").Request, res: import("express").Response): Promise<void> {
  const id = Number(req.params["id"]);
  await db.delete(affiliateTiersTable).where(eq(affiliateTiersTable.id, id));
  res.json({ ok: true });
}

// Primary paths
router.get("/admin/affiliate-tiers", requireAdmin, requireAdminHeader, getTiersHandler);
router.post("/admin/affiliate-tiers", requireAdmin, requireAdminHeader, createTierHandler);
router.put("/admin/affiliate-tiers/:id", requireAdmin, requireAdminHeader, updateTierHandler);
router.delete("/admin/affiliate-tiers/:id", requireAdmin, requireAdminHeader, deleteTierHandler);

// Legacy alias paths (for any clients that call /affiliates/admin/... instead of /admin/...)
router.get("/affiliates/admin/affiliate-tiers", requireAdmin, requireAdminHeader, getTiersHandler);
router.post("/affiliates/admin/affiliate-tiers", requireAdmin, requireAdminHeader, createTierHandler);
router.put("/affiliates/admin/affiliate-tiers/:id", requireAdmin, requireAdminHeader, updateTierHandler);
router.delete("/affiliates/admin/affiliate-tiers/:id", requireAdmin, requireAdminHeader, deleteTierHandler);

// ─── Admin: global metrics ────────────────────────────────────────────────────

router.get("/admin/affiliates-metrics", requireAdmin, requireAdminHeader, async (req, res): Promise<void> => {
  const [totalAff, activeAff, clickRow, signupRow, commRow, paidRow] = await Promise.all([
    db.select({ cnt: count() }).from(affiliatesTable),
    db.select({ cnt: count() }).from(affiliatesTable).where(eq(affiliatesTable.status, "active")),
    db.select({ cnt: count() }).from(affiliateClicksTable),
    db.select({ cnt: count() }).from(referralsTable),
    db.select({ total: sum(affiliateCommissionsTable.commissionAmount) })
      .from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.status, "pending")),
    db.select({ total: sum(affiliateCommissionsTable.commissionAmount) })
      .from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.status, "paid")),
  ]);
  res.json({
    totalAffiliates: Number(totalAff[0]?.cnt ?? 0),
    activeAffiliates: Number(activeAff[0]?.cnt ?? 0),
    totalClicks: Number(clickRow[0]?.cnt ?? 0),
    totalSignups: Number(signupRow[0]?.cnt ?? 0),
    commissionPending: Number(commRow[0]?.total ?? 0),
    commissionPaid: Number(paidRow[0]?.total ?? 0),
  });
});

// ─── Commission calculation (called from webhook handlers) ───────────────────

export async function recordAffiliateCommission(opts: {
  userId: number;
  subscriptionId?: number;
  transactionId?: number;
  revenueAmountCents: number;
  type: "subscription" | "ticket_purchase";
}): Promise<void> {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, opts.userId),
    columns: { referredByAffiliateId: true },
  });
  if (!user?.referredByAffiliateId) return;

  const affiliateId = user.referredByAffiliateId;

  // Prevent self-referral
  const [aff] = await db.select({ userId: affiliatesTable.userId })
    .from(affiliatesTable).where(eq(affiliatesTable.id, affiliateId)).limit(1);
  if (aff?.userId === opts.userId) return;

  // Get commission percentage
  let commissionPercentage: number;
  if (opts.type === "ticket_purchase") {
    commissionPercentage = 10;
  } else {
    const tierData = await getAffiliateTier(affiliateId);
    commissionPercentage = tierData.current?.commissionPercentage ?? 20;
  }

  if (opts.revenueAmountCents <= 0) return;

  const commissionAmount = Math.floor(opts.revenueAmountCents * commissionPercentage / 100);

  await db.insert(affiliateCommissionsTable).values({
    affiliateId,
    referredUserId: opts.userId,
    subscriptionId: opts.subscriptionId ?? null,
    transactionId: opts.transactionId ?? null,
    revenueAmount: opts.revenueAmountCents,
    commissionPercentage,
    commissionAmount,
    commissionType: opts.type,
    status: "pending",
  });

  // Update referral status if needed
  await db.update(referralsTable)
    .set({ status: "active", convertedAt: new Date(), firstPurchaseAt: new Date() })
    .where(
      and(
        eq(referralsTable.affiliateId, affiliateId),
        eq(referralsTable.referredUserId, opts.userId),
        or(eq(referralsTable.status, "signed_up"), eq(referralsTable.status, "converted")),
      ),
    );
}

// ─── Attribution: link user to affiliate at signup ───────────────────────────

export async function attributeUserToAffiliate(
  userId: number,
  affiliateSlug: string,
): Promise<void> {
  const slug = affiliateSlug.toLowerCase().trim();
  const [aff] = await db.select({ id: affiliatesTable.id })
    .from(affiliatesTable)
    .where(and(eq(affiliatesTable.slug, slug), eq(affiliatesTable.status, "active")))
    .limit(1);
  if (!aff) return;

  // Check not already attributed
  const [user] = await db.select({ referredByAffiliateId: usersTable.referredByAffiliateId })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.referredByAffiliateId) return;

  await db.update(usersTable).set({ referredByAffiliateId: aff.id }).where(eq(usersTable.id, userId));

  // Check not self-referral
  const [affFull] = await db.select({ userId: affiliatesTable.userId })
    .from(affiliatesTable).where(eq(affiliatesTable.id, aff.id)).limit(1);
  if (affFull?.userId === userId) {
    await db.update(usersTable).set({ referredByAffiliateId: null }).where(eq(usersTable.id, userId));
    return;
  }

  await db.insert(referralsTable).values({
    affiliateId: aff.id,
    referredUserId: userId,
    referralSlug: slug,
    status: "signed_up",
  });
}

export default router;
