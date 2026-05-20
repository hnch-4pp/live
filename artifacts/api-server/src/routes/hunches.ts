import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  hunchesTable,
  categoriesTable,
  prizesTable,
  optionsTable,
  predictionsTable,
} from "@workspace/db";
import {
  ListHunchesQueryParams,
  GetHunchParams,
  SubmitPredictionParams,
  SubmitPredictionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildHunch(hunch: typeof hunchesTable.$inferSelect) {
  const category = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, hunch.categoryId))
    .then((r) => r[0]);

  const prize = await db
    .select()
    .from(prizesTable)
    .where(eq(prizesTable.id, hunch.prizeId))
    .then((r) => r[0]);

  const options = await db
    .select()
    .from(optionsTable)
    .where(eq(optionsTable.hunchId, hunch.id));

  return {
    id: hunch.id,
    title: hunch.title,
    description: hunch.description,
    categorySlug: category?.slug ?? "",
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "",
    status: hunch.status as "open" | "closed" | "resolved",
    participantCount: hunch.participantCount,
    endsAt: hunch.endsAt.toISOString(),
    resolvedAt: hunch.resolvedAt ? hunch.resolvedAt.toISOString() : null,
    prize: {
      id: prize?.id ?? 0,
      label: prize?.label ?? "",
      type: (prize?.type ?? "gift_card") as "gift_card" | "merch" | "cash_equivalent",
      value: prize?.value ?? "",
      imageUrl: prize?.imageUrl ?? null,
    },
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      percentage: o.percentage,
    })),
    featured: hunch.featured,
    imageUrl: hunch.imageUrl ?? null,
    winnerOption: hunch.winnerOption ?? null,
  };
}

router.get("/hunches", async (req, res): Promise<void> => {
  const parsed = ListHunchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, status, featured, limit = 20, offset = 0 } = parsed.data;

  const conditions = [];

  if (status) {
    conditions.push(eq(hunchesTable.status, status));
  }

  if (featured === true) {
    conditions.push(eq(hunchesTable.featured, true));
  }

  let hunchRows;
  if (category) {
    const cat = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, category))
      .then((r) => r[0]);

    if (!cat) {
      res.json({ hunches: [], total: 0 });
      return;
    }
    conditions.push(eq(hunchesTable.categoryId, cat.id));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  hunchRows = await db
    .select()
    .from(hunchesTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(hunchesTable.createdAt);

  const [{ total }] = await db
    .select({ total: count() })
    .from(hunchesTable)
    .where(whereClause);

  const hunches = await Promise.all(hunchRows.map(buildHunch));

  res.json({ hunches, total });
});

router.get("/hunches/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(hunchesTable)
    .where(and(eq(hunchesTable.featured, true), eq(hunchesTable.status, "open")))
    .limit(5);

  const hunches = await Promise.all(rows.map(buildHunch));
  res.json(hunches);
});

router.get("/hunches/stats", async (_req, res): Promise<void> => {
  const [totalRow] = await db.select({ total: count() }).from(hunchesTable);
  const [activeRow] = await db
    .select({ total: count() })
    .from(hunchesTable)
    .where(eq(hunchesTable.status, "open"));
  const [participantsRow] = await db
    .select({ total: sql<number>`coalesce(sum(${hunchesTable.participantCount}), 0)` })
    .from(hunchesTable);
  const [resolvedRow] = await db
    .select({ total: count() })
    .from(hunchesTable)
    .where(eq(hunchesTable.status, "resolved"));

  res.json({
    totalHunches: totalRow.total,
    totalParticipants: Number(participantsRow.total),
    totalPrizesAwarded: resolvedRow.total,
    activeHunches: activeRow.total,
  });
});

router.get("/hunches/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetHunchParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [hunch] = await db
    .select()
    .from(hunchesTable)
    .where(eq(hunchesTable.id, params.data.id));

  if (!hunch) {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  res.json(await buildHunch(hunch));
});

router.post("/hunches/:id/predict", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SubmitPredictionParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SubmitPredictionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [hunch] = await db
    .select()
    .from(hunchesTable)
    .where(eq(hunchesTable.id, params.data.id));

  if (!hunch) {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  if (hunch.status !== "open") {
    res.status(400).json({ error: "This hunch is no longer open for predictions" });
    return;
  }

  const [option] = await db
    .select()
    .from(optionsTable)
    .where(and(eq(optionsTable.id, body.data.optionId), eq(optionsTable.hunchId, params.data.id)));

  if (!option) {
    res.status(400).json({ error: "Invalid option for this hunch" });
    return;
  }

  const [prediction] = await db
    .insert(predictionsTable)
    .values({ hunchId: params.data.id, optionId: body.data.optionId })
    .returning();

  await db
    .update(hunchesTable)
    .set({ participantCount: hunch.participantCount + 1 })
    .where(eq(hunchesTable.id, params.data.id));

  res.status(201).json({
    id: prediction.id,
    hunchId: prediction.hunchId,
    optionId: prediction.optionId,
    optionLabel: option.label,
    createdAt: prediction.createdAt.toISOString(),
  });
});

export default router;
