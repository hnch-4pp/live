import { Router, type IRouter } from "express";
import { eq, and, count, sql, inArray, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  hunchesTable,
  categoriesTable,
  prizesTable,
  optionsTable,
  predictionsTable,
  hunchTranslationsTable,
  hunchPrizeTiersTable,
} from "@workspace/db";
import {
  ListHunchesQueryParams,
  GetHunchParams,
  GetHunchQueryParams,
  SubmitPredictionParams,
  SubmitPredictionBody,
} from "@workspace/api-zod";
import { isTranslatableLanguage, translateOneHunch } from "../translate";

const router: IRouter = Router();

type HunchDetail = Awaited<ReturnType<typeof buildHunch>>;

function parsePrizeAmount(value: string): number {
  const m = value.match(/\$?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

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

  const tiers = await db
    .select()
    .from(hunchPrizeTiersTable)
    .where(eq(hunchPrizeTiersTable.hunchId, hunch.id))
    .orderBy(hunchPrizeTiersTable.rank);

  const prizeTiers = await Promise.all(
    tiers.map(async (t) => {
      const p = await db.select().from(prizesTable).where(eq(prizesTable.id, t.prizeId)).then((r) => r[0]);
      return {
        rank: t.rank,
        prize: {
          id: p?.id ?? 0,
          label: p?.label ?? "",
          type: (p?.type ?? "gift_card") as "gift_card" | "merch" | "cash_equivalent",
          value: p?.value ?? "",
          imageUrl: p?.imageUrl ?? null,
        },
      };
    }),
  );

  const prizePoolTotal = prizeTiers.length > 1
    ? "$" + prizeTiers.reduce((sum, t) => sum + parsePrizeAmount(t.prize.value), 0).toLocaleString()
    : null;

  const options = await db
    .select()
    .from(optionsTable)
    .where(eq(optionsTable.hunchId, hunch.id));

  return {
    id: hunch.id,
    slug: hunch.slug ?? String(hunch.id),
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
    prizeTiers,
    prizePoolTotal,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      percentage: o.percentage,
    })),
    featured: hunch.featured,
    imageUrl: hunch.imageUrl ?? null,
    winnerOption: hunch.winnerOption ?? null,
    rules: hunch.rules ?? null,
    answerType: hunch.answerType,
  };
}

/**
 * Apply cached or fresh translations to a list of hunches.
 * Uses a single DB lookup + one batch MyMemory call for all uncached hunches.
 */
async function withTranslations(hunches: HunchDetail[], lang: string): Promise<HunchDetail[]> {
  if (!lang || lang === "en" || !isTranslatableLanguage(lang)) return hunches;
  if (hunches.length === 0) return hunches;

  const ids = hunches.map((h) => h.id);

  const cached = await db
    .select()
    .from(hunchTranslationsTable)
    .where(and(inArray(hunchTranslationsTable.hunchId, ids), eq(hunchTranslationsTable.lang, lang)));

  const cachedMap = new Map(cached.map((c) => [c.hunchId, c]));

  const uncached = hunches.filter((h) => !cachedMap.has(h.id));

  if (uncached.length > 0) {
    const results = await Promise.all(
      uncached.map((h) =>
        translateOneHunch(h.id, h.title, h.description, h.options, lang).then((t) => ({
          hunchId: h.id,
          lang,
          title: t.title,
          description: t.description,
          optionTranslations: t.optionTranslations,
        }))
      )
    );

    if (results.length > 0) {
      await db
        .insert(hunchTranslationsTable)
        .values(results)
        .onConflictDoNothing();

      results.forEach((r) => cachedMap.set(r.hunchId, { ...r, id: 0, createdAt: new Date() }));
    }
  }

  return hunches.map((h) => {
    const t = cachedMap.get(h.id);
    if (!t) return h;
    const opts = t.optionTranslations as Record<number, string>;
    return {
      ...h,
      title: t.title,
      description: t.description,
      options: h.options.map((o) => ({ ...o, label: opts[o.id] ?? o.label })),
    };
  });
}

router.get("/hunches", async (req, res): Promise<void> => {
  const parsed = ListHunchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, status, featured, limit = 20, offset = 0, lang, q } = parsed.data;

  const conditions = [];

  if (q) {
    conditions.push(ilike(hunchesTable.title, `%${q}%`));
  }

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
  const translated = await withTranslations(hunches, lang ?? "en");

  res.json({ hunches: translated, total });
});

router.get("/hunches/featured", async (req, res): Promise<void> => {
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";

  const rows = await db
    .select()
    .from(hunchesTable)
    .where(and(eq(hunchesTable.featured, true), eq(hunchesTable.status, "open")))
    .limit(5);

  const hunches = await Promise.all(rows.map(buildHunch));
  const translated = await withTranslations(hunches, lang);
  res.json(translated);
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

  const queryParams = GetHunchQueryParams.safeParse(req.query);
  const lang = queryParams.success ? (queryParams.data.lang ?? "en") : "en";

  const isNumeric = /^\d+$/.test(rawId);
  const [hunch] = await db
    .select()
    .from(hunchesTable)
    .where(isNumeric ? eq(hunchesTable.id, parseInt(rawId, 10)) : eq(hunchesTable.slug, rawId));

  if (!hunch) {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  const built = await buildHunch(hunch);
  const [translated] = await withTranslations([built], lang);

  res.json(translated);
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

  const normalizedLabel = body.data.freeText.trim();

  const existingOptions = await db
    .select()
    .from(optionsTable)
    .where(eq(optionsTable.hunchId, params.data.id));

  const matchedOption = existingOptions.find(
    (o) => o.label.trim().toLowerCase() === normalizedLabel.toLowerCase()
  );

  let optionId: number;

  if (matchedOption) {
    optionId = matchedOption.id;
  } else {
    const [newOption] = await db
      .insert(optionsTable)
      .values({ hunchId: params.data.id, label: normalizedLabel, percentage: 0 })
      .returning();
    optionId = newOption.id;
  }

  const [prediction] = await db
    .insert(predictionsTable)
    .values({ hunchId: params.data.id, optionId })
    .returning();

  await db
    .update(hunchesTable)
    .set({ participantCount: hunch.participantCount + 1 })
    .where(eq(hunchesTable.id, params.data.id));

  const predictionCounts = await db
    .select({ optionId: predictionsTable.optionId, cnt: count() })
    .from(predictionsTable)
    .where(eq(predictionsTable.hunchId, params.data.id))
    .groupBy(predictionsTable.optionId);

  const total = predictionCounts.reduce((sum, r) => sum + Number(r.cnt), 0);

  if (total > 0) {
    const countMap = new Map(predictionCounts.map((r) => [r.optionId, Number(r.cnt)]));
    const allOptions = matchedOption
      ? existingOptions
      : [...existingOptions, { id: optionId, label: normalizedLabel, percentage: 0, hunchId: params.data.id }];

    await Promise.all(
      allOptions.map((o) => {
        const pct = ((countMap.get(o.id) ?? 0) / total) * 100;
        return db
          .update(optionsTable)
          .set({ percentage: pct })
          .where(eq(optionsTable.id, o.id));
      })
    );
  }

  res.status(201).json({
    id: prediction.id,
    hunchId: prediction.hunchId,
    optionId,
    optionLabel: normalizedLabel,
    createdAt: prediction.createdAt.toISOString(),
  });
});

export default router;
