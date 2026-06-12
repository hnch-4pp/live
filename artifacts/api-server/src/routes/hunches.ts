import { Router, type IRouter } from "express";
import { eq, and, count, sql, inArray, ilike, isNotNull, asc, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  hunchesTable,
  categoriesTable,
  prizesTable,
  optionsTable,
  predictionsTable,
  hunchTranslationsTable,
  hunchPrizeTiersTable,
  usersTable,
  hunchQuestionsTable,
  trendingTopicsTable,
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

// ── Prediction confirmation email ─────────────────────────────────────────────

async function sendPredictionEmail(
  email: string,
  hunch: typeof hunchesTable.$inferSelect,
  entries: Array<{ question?: string; answer: string }>,
): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const prize = await db
    .select()
    .from(prizesTable)
    .where(eq(prizesTable.id, hunch.prizeId))
    .then((r) => r[0]);

  const hunchUrl = `https://hunch.fan/hunches/${hunch.slug ?? hunch.id}`;

  const fmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
  const endsAtStr = fmt.format(new Date(hunch.endsAt));

  const isMulti = entries.length > 1 || entries.some((e) => e.question);

  const predictionsHtml = isMulti
    ? `<table style="width:100%;border-collapse:collapse">
        ${entries.map((e, i) => `
          <tr>
            <td style="padding:8px 0;border-top:${i > 0 ? "1px solid #f0f0f0" : "none"}">
              ${e.question ? `<div style="font-size:12px;color:#888;margin-bottom:3px">${e.question}</div>` : ""}
              <div style="font-size:14px;font-weight:600;color:#1a1a1a">${e.answer}</div>
            </td>
          </tr>
        `).join("")}
       </table>`
    : `<div style="font-size:22px;font-weight:700;color:#7c3aed;padding:16px;background:#f9f8ff;border:1px solid #e8e0ff;border-radius:10px;text-align:center">${entries[0]?.answer ?? ""}</div>`;

  const prizeStr = prize
    ? `${prize.label}${prize.value ? ` — ${prize.value}` : ""}`
    : "Premio especial";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#ffffff;color:#1a1a1a">
      <div style="background:#18082e;padding:24px 32px;border-radius:12px 12px 0 0">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">hunch</span>
      </div>
      <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1a1a1a">Prediccion registrada</h1>
        <p style="margin:0 0 28px;font-size:14px;color:#666">Tu hunch ha sido guardado correctamente. Aqui estan los detalles.</p>

        <div style="background:#f9f8ff;border:1px solid #e8e0ff;border-radius:12px;padding:18px 20px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px">HUNCH</div>
          <div style="font-size:16px;font-weight:700;color:#1a1a1a;line-height:1.45">${hunch.title}</div>
        </div>

        <div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Tu prediccion</div>
          ${predictionsHtml}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr>
            <td style="width:50%;padding-right:6px">
              <div style="background:#f5f5f5;border-radius:10px;padding:14px">
                <div style="font-size:11px;color:#888;font-weight:500;margin-bottom:4px">Cierra</div>
                <div style="font-size:13px;font-weight:600;color:#1a1a1a">${endsAtStr}</div>
              </div>
            </td>
            <td style="width:50%;padding-left:6px">
              <div style="background:#f5f5f5;border-radius:10px;padding:14px">
                <div style="font-size:11px;color:#888;font-weight:500;margin-bottom:4px">Premio</div>
                <div style="font-size:13px;font-weight:600;color:#1a1a1a">${prizeStr}</div>
              </div>
            </td>
          </tr>
        </table>

        <a href="${hunchUrl}"
           style="display:block;background:#7c3aed;color:#ffffff;text-align:center;text-decoration:none;padding:14px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:24px">
          Ver tu prediccion &rarr;
        </a>

        <hr style="border:none;border-top:1px solid #eee;margin:0 0 18px"/>
        <p style="margin:0;font-size:12px;color:#aaa;text-align:center">
          Hunch &mdash; plataforma de predicciones basada en habilidades. No se apuesta dinero.
        </p>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hunch <notifications@hunch.app>",
      to: [email],
      subject: `Tu prediccion en "${hunch.title}" fue registrada`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend prediction email error ${response.status}: ${body}`);
  }
}

type HunchDetail = Awaited<ReturnType<typeof buildHunch>>;

function parsePrizeAmount(value: string): number {
  const m = value.match(/\$?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function toSlug(text: string, id: number): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) +
    "-" +
    id
  );
}

async function buildHunch(hunch: typeof hunchesTable.$inferSelect) {
  // Lazily populate slug if missing — saves it so subsequent reads are fast
  if (!hunch.slug) {
    const generated = toSlug(hunch.title, hunch.id);
    await db
      .update(hunchesTable)
      .set({ slug: generated })
      .where(eq(hunchesTable.id, hunch.id));
    hunch = { ...hunch, slug: generated };
  }
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

  const allOptions = await db
    .select()
    .from(optionsTable)
    .where(eq(optionsTable.hunchId, hunch.id));

  // Fetch questions for multi-prediction hunches
  const isMulti = hunch.isMulti ?? false;
  let questions: Array<{
    id: number;
    sortOrder: number;
    prompt: string;
    answerType: string;
    placeholder: string | null;
    options: Array<{ id: number; label: string; percentage: number }>;
  }> = [];

  if (isMulti) {
    const rawQuestions = await db
      .select()
      .from(hunchQuestionsTable)
      .where(eq(hunchQuestionsTable.hunchId, hunch.id))
      .orderBy(hunchQuestionsTable.sortOrder);

    questions = rawQuestions.map((q) => ({
      id: q.id,
      sortOrder: q.sortOrder,
      prompt: q.prompt,
      answerType: q.answerType,
      placeholder: q.placeholder ?? null,
      options: allOptions
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, label: o.label, percentage: o.percentage })),
    }));
  }

  // Parse winnerAnswers for multi hunches
  let winnerAnswers: Array<{ questionId: number; answer: string }> | null = null;
  if (isMulti && hunch.winnerAnswers) {
    try {
      winnerAnswers = JSON.parse(hunch.winnerAnswers) as Array<{ questionId: number; answer: string }>;
    } catch {
      winnerAnswers = null;
    }
  }

  return {
    id: hunch.id,
    slug: hunch.slug ?? String(hunch.id),
    title: hunch.title,
    description: hunch.description,
    categorySlug: category?.slug ?? "",
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "",
    status: (hunch.status === "open" && hunch.endsAt < new Date() ? "closed" : hunch.status) as "open" | "closed" | "resolved",
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
    options: isMulti
      ? []
      : allOptions.map((o) => ({ id: o.id, label: o.label, percentage: o.percentage })),
    questions,
    isMulti,
    featured: hunch.featured,
    imageUrl: hunch.imageUrl ?? null,
    imageFocalPoint: hunch.imageFocalPoint ?? null,
    winnerOption: hunch.winnerOption ?? null,
    winnerAnswers,
    winnerUserId: hunch.winnerUserId ?? null,
    resultText: hunch.resultText ?? null,
    resultSources: hunch.resultSources ?? null,
    rules: hunch.rules ?? null,
    answerType: hunch.answerType,
    ticketCost: hunch.ticketCost,
    tags: hunch.tags ?? null,
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

router.get("/trending-topics", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(trendingTopicsTable)
    .where(eq(trendingTopicsTable.active, true))
    .orderBy(trendingTopicsTable.sortOrder, trendingTopicsTable.id);
  res.json(rows);
});

router.get("/hunches", async (req, res): Promise<void> => {
  const parsed = ListHunchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, status, featured, limit = 20, offset = 0, lang, q, tag } = parsed.data;

  const conditions = [ne(hunchesTable.status, "draft")];

  if (q) {
    conditions.push(ilike(hunchesTable.title, `%${q}%`));
  }

  if (tag) {
    conditions.push(sql<boolean>`(',' || ${hunchesTable.tags} || ',') ILIKE ${'%,' + tag + ',%'}`);
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
    .orderBy(hunchesTable.featuredOrder, hunchesTable.id)
    .limit(8);

  const hunches = await Promise.all(rows.map(buildHunch));
  const translated = await withTranslations(hunches, lang);
  res.json(translated);
});

router.get("/hunches/stats", async (_req, res): Promise<void> => {
  const [totalRow] = await db.select({ total: count() }).from(hunchesTable).where(ne(hunchesTable.status, "draft"));
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

  if (!hunch || hunch.status === "draft") {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  const built = await buildHunch(hunch);
  const [translated] = await withTranslations([built], lang);

  res.json(translated);
});

// ─── Activity feed ───────────────────────────────────────────────────────────

router.get("/hunches/:id/activity", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const isNumeric = /^\d+$/.test(rawId);
  const [hunch] = await db
    .select({ id: hunchesTable.id })
    .from(hunchesTable)
    .where(isNumeric ? eq(hunchesTable.id, parseInt(rawId, 10)) : eq(hunchesTable.slug, rawId));

  if (!hunch) {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  // One row per user — take the most recent prediction per user
  const rows = await db
    .selectDistinctOn([predictionsTable.userId], {
      userId: predictionsTable.userId,
      joinedAt: predictionsTable.createdAt,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(predictionsTable)
    .leftJoin(usersTable, eq(predictionsTable.userId, usersTable.id))
    .where(and(eq(predictionsTable.hunchId, hunch.id), isNotNull(predictionsTable.userId)))
    .orderBy(asc(predictionsTable.userId), asc(predictionsTable.createdAt));

  // Sort by joinedAt desc (most recent first) after deduplication
  const participants = rows
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 30)
    .map((r) => ({
      userId: r.userId,
      username: r.username ?? null,
      avatarUrl: r.avatarUrl ?? null,
      joinedAt: r.joinedAt,
    }));

  res.json({ participants, total: rows.length });
});

// ─── Winners ─────────────────────────────────────────────────────────────────

router.get("/hunches/:id/winners", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const isNumeric = /^\d+$/.test(rawId);
  const [hunch] = await db
    .select()
    .from(hunchesTable)
    .where(isNumeric ? eq(hunchesTable.id, parseInt(rawId, 10)) : eq(hunchesTable.slug, rawId));

  if (!hunch) {
    res.status(404).json({ error: "Hunch not found" });
    return;
  }

  if (hunch.status !== "resolved") {
    res.json({ winners: [] });
    return;
  }

  const isMulti = hunch.isMulti ?? false;

  // For each winning questionId → collect valid optionIds (case-insensitive label match)
  async function winningOptionIds(questionId: number | null, answerLabel: string): Promise<number[]> {
    const opts = await db
      .select({ id: optionsTable.id })
      .from(optionsTable)
      .where(
        and(
          eq(optionsTable.hunchId, hunch.id),
          questionId !== null ? eq(optionsTable.questionId, questionId) : isNotNull(optionsTable.id),
          sql`lower(${optionsTable.label}) = lower(${answerLabel})`,
        ),
      );
    return opts.map((o) => o.id);
  }

  // Build a map: questionId (null for single) → valid optionIds[]
  const winnerMap = new Map<number | null, number[]>();

  if (hunch.winnerRanks) {
    // Ranked winners — applies to both isMulti and !isMulti when multiple prize tiers exist
    let rankedEntries: Array<{ rank: number; userId: number }>;
    try { rankedEntries = (JSON.parse(hunch.winnerRanks) as Array<{ rank: number; userId: number }>).sort((a, b) => a.rank - b.rank); }
    catch { res.json({ winners: [] }); return; }

    const mainPrize = await db.select().from(prizesTable).where(eq(prizesTable.id, hunch.prizeId)).then((r) => r[0]);
    const tiers = await db
      .select()
      .from(hunchPrizeTiersTable)
      .where(eq(hunchPrizeTiersTable.hunchId, hunch.id))
      .orderBy(hunchPrizeTiersTable.rank);

    const winners = await Promise.all(
      rankedEntries.map(async ({ rank, userId }) => {
        const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));
        const tier = tiers.find((t) => t.rank === rank);
        let prizeLabel = mainPrize?.label ?? "";
        let prizeValue = mainPrize?.value ?? "";
        if (tier) {
          const tierPrize = await db.select().from(prizesTable).where(eq(prizesTable.id, tier.prizeId)).then((r) => r[0]);
          prizeLabel = tierPrize?.label ?? prizeLabel;
          prizeValue = tierPrize?.value ?? prizeValue;
        }
        const [pred] = await db
          .select({ label: optionsTable.label })
          .from(predictionsTable)
          .leftJoin(optionsTable, eq(predictionsTable.optionId, optionsTable.id))
          .where(and(eq(predictionsTable.hunchId, hunch.id), eq(predictionsTable.userId, userId)))
          .orderBy(asc(predictionsTable.createdAt))
          .limit(1);
        return { username: user?.username ?? "Anonymous", prizeLabel, prizeValue, rank, prediction: pred?.label ?? null };
      }),
    );
    res.json({ winners });
    return;
  } else if (!isMulti) {
    if (!hunch.winnerOption) { res.json({ winners: [] }); return; }
    const ids = await winningOptionIds(null, hunch.winnerOption);
    if (ids.length === 0) { res.json({ winners: [] }); return; }
    winnerMap.set(null, ids);
  } else if (hunch.winnerUserId) {
    // Multi-prediction: admin selected a specific user as winner (single prize / legacy)
    const [winnerUser] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, hunch.winnerUserId));
    const mainPrize = await db.select().from(prizesTable).where(eq(prizesTable.id, hunch.prizeId)).then((r) => r[0]);
    const tiers = await db
      .select()
      .from(hunchPrizeTiersTable)
      .where(eq(hunchPrizeTiersTable.hunchId, hunch.id))
      .orderBy(hunchPrizeTiersTable.rank);
    let prizeLabel = mainPrize?.label ?? "";
    let prizeValue = mainPrize?.value ?? "";
    if (tiers.length > 0) {
      const firstTierPrize = await db
        .select()
        .from(prizesTable)
        .where(eq(prizesTable.id, tiers[0].prizeId))
        .then((r) => r[0]);
      prizeLabel = firstTierPrize?.label ?? prizeLabel;
      prizeValue = firstTierPrize?.value ?? prizeValue;
    }
    const [winnerPred] = await db
      .select({ label: optionsTable.label })
      .from(predictionsTable)
      .leftJoin(optionsTable, eq(predictionsTable.optionId, optionsTable.id))
      .where(and(eq(predictionsTable.hunchId, hunch.id), eq(predictionsTable.userId, hunch.winnerUserId!)))
      .orderBy(asc(predictionsTable.createdAt))
      .limit(1);
    res.json({ winners: [{ username: winnerUser?.username ?? "Anonymous", prizeLabel, prizeValue, rank: null, prediction: winnerPred?.label ?? null }] });
    return;
  } else if (hunch.winnerAnswers) {
    let answers: Array<{ questionId: number; answer: string }>;
    try { answers = JSON.parse(hunch.winnerAnswers) as Array<{ questionId: number; answer: string }>; }
    catch { res.json({ winners: [] }); return; }
    for (const wa of answers) {
      const ids = await winningOptionIds(wa.questionId, wa.answer);
      winnerMap.set(wa.questionId, ids);
    }
  } else if (hunch.winnerOption) {
    // Fallback: multi-hunch where admin used winnerOption (e.g. from participants panel).
    // Match any prediction with that option label across all questions.
    const ids = await winningOptionIds(null, hunch.winnerOption);
    if (ids.length === 0) { res.json({ winners: [] }); return; }
    winnerMap.set(null, ids);
  } else {
    res.json({ winners: [] }); return;
  }

  // Fetch all predictions for this hunch, ordered by time
  const allPreds = await db
    .select()
    .from(predictionsTable)
    .where(and(eq(predictionsTable.hunchId, hunch.id), isNotNull(predictionsTable.userId)))
    .orderBy(asc(predictionsTable.createdAt));

  // Group by userId: questionId → optionId; also track all optionIds per user for fallback
  const userAnswers = new Map<number, Map<number | null, number>>();
  const userAllOptionIds = new Map<number, Set<number>>();
  const userFirstTime = new Map<number, Date>();
  for (const p of allPreds) {
    if (p.userId === null) continue;
    if (!userAnswers.has(p.userId)) userAnswers.set(p.userId, new Map());
    userAnswers.get(p.userId)!.set(p.questionId, p.optionId);
    if (!userAllOptionIds.has(p.userId)) userAllOptionIds.set(p.userId, new Set());
    userAllOptionIds.get(p.userId)!.add(p.optionId);
    if (!userFirstTime.has(p.userId)) userFirstTime.set(p.userId, p.createdAt);
  }

  // Determine winners: users who match ALL entries in winnerMap
  const winnerEntries: Array<{ userId: number; firstPredAt: Date }> = [];
  for (const [userId, predMap] of userAnswers.entries()) {
    let correct = true;
    for (const [qId, validIds] of winnerMap.entries()) {
      let userOptionId: number | undefined;
      if (qId === null && isMulti) {
        // Fallback path: any matching option across all questions counts
        userOptionId = [...(userAllOptionIds.get(userId) ?? new Set())].find((id) => validIds.includes(id));
      } else {
        userOptionId = predMap.get(qId);
      }
      if (userOptionId === undefined || !validIds.includes(userOptionId)) { correct = false; break; }
    }
    if (correct) winnerEntries.push({ userId, firstPredAt: userFirstTime.get(userId) ?? new Date() });
  }

  // Sort by first prediction time (earliest = rank 1)
  winnerEntries.sort((a, b) => a.firstPredAt.getTime() - b.firstPredAt.getTime());

  // Fetch prize tiers (for multi-prize hunches)
  const tiers = await db
    .select()
    .from(hunchPrizeTiersTable)
    .where(eq(hunchPrizeTiersTable.hunchId, hunch.id))
    .orderBy(hunchPrizeTiersTable.rank);

  const mainPrize = await db.select().from(prizesTable).where(eq(prizesTable.id, hunch.prizeId)).then((r) => r[0]);

  // Batch-fetch option labels for all winner predictions
  const winnerUserIds = winnerEntries.map((e) => e.userId);
  const allWinnerOptionIds = winnerUserIds.flatMap((uid) => {
    const answers = userAnswers.get(uid);
    if (!answers) return [];
    return [...answers.values()];
  });
  const uniqueOptionIds = [...new Set(allWinnerOptionIds)];
  const optionLabelsMap = new Map<number, string>();
  if (uniqueOptionIds.length > 0) {
    const optRows = await db.select({ id: optionsTable.id, label: optionsTable.label })
      .from(optionsTable)
      .where(inArray(optionsTable.id, uniqueOptionIds));
    for (const o of optRows) optionLabelsMap.set(o.id, o.label);
  }

  const winners = await Promise.all(
    winnerEntries.map(async ({ userId }, idx) => {
      const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));

      let prizeLabel = mainPrize?.label ?? "";
      let prizeValue = mainPrize?.value ?? "";

      if (tiers.length > 1 && idx < tiers.length) {
        const tierPrize = await db.select().from(prizesTable).where(eq(prizesTable.id, tiers[idx]!.prizeId)).then((r) => r[0]);
        prizeLabel = tierPrize?.label ?? prizeLabel;
        prizeValue = tierPrize?.value ?? prizeValue;
      }

      const answers = userAnswers.get(userId);
      let prediction: string | null = null;
      if (answers) {
        const labels = [...answers.values()]
          .map((oid) => optionLabelsMap.get(oid))
          .filter((l): l is string => l !== undefined);
        if (labels.length > 0) prediction = labels.join(" | ");
      }

      return {
        username: user?.username ?? "Anonymous",
        prizeLabel,
        prizeValue,
        rank: tiers.length > 1 ? idx + 1 : null,
        prediction,
      };
    }),
  );

  res.json({ winners });
});

// ─── Prediction submission (single & multi) ──────────────────────────────────

router.post("/hunches/:id/predict", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "You must be signed in to make a prediction." });
    return;
  }

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

  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!currentUser) {
    res.status(401).json({ error: "User not found." });
    return;
  }

  const cost = hunch.ticketCost;
  if (currentUser.tickets < cost) {
    res.status(402).json({ error: `Not enough tickets. This hunch costs ${cost} ticket${cost !== 1 ? "s" : ""}. You have ${currentUser.tickets}.` });
    return;
  }

  const isMulti = hunch.isMulti ?? false;

  // ── Multi-prediction path ─────────────────────────────────────────────────
  if (isMulti) {
    const answers = body.data.answers;
    if (!answers || answers.length === 0) {
      res.status(400).json({ error: "Answers are required for multi-prediction hunches." });
      return;
    }

    // Validate all questions are answered
    const questionRows = await db
      .select()
      .from(hunchQuestionsTable)
      .where(eq(hunchQuestionsTable.hunchId, hunch.id));

    if (questionRows.length === 0) {
      res.status(400).json({ error: "This hunch has no questions configured." });
      return;
    }

    const answeredIds = new Set(answers.map((a) => a.questionId));
    const missing = questionRows.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing answers for: ${missing.map((q) => q.prompt).join(", ")}` });
      return;
    }

    // Process each answer — find/create option per question
    const createdPredictions: Array<{ questionId: number; optionId: number; label: string }> = [];

    for (const answer of answers) {
      const normalizedLabel = answer.freeText.trim();
      if (!normalizedLabel) continue;

      const existingOptions = await db
        .select()
        .from(optionsTable)
        .where(and(eq(optionsTable.hunchId, hunch.id), eq(optionsTable.questionId, answer.questionId)));

      const matchedOption = existingOptions.find(
        (o) => o.label.trim().toLowerCase() === normalizedLabel.toLowerCase()
      );

      let optionId: number;
      let allOptionsForQ = existingOptions;

      if (matchedOption) {
        optionId = matchedOption.id;
      } else {
        const [newOption] = await db
          .insert(optionsTable)
          .values({ hunchId: hunch.id, questionId: answer.questionId, label: normalizedLabel, percentage: 0 })
          .returning();
        optionId = newOption.id;
        allOptionsForQ = [...existingOptions, { id: optionId, label: normalizedLabel, percentage: 0, hunchId: hunch.id, questionId: answer.questionId }];
      }

      await db
        .insert(predictionsTable)
        .values({ hunchId: hunch.id, optionId, questionId: answer.questionId, userId: req.session.userId })
        .returning();

      // Recalculate percentages for this question
      const predCounts = await db
        .select({ optionId: predictionsTable.optionId, cnt: count() })
        .from(predictionsTable)
        .where(and(eq(predictionsTable.hunchId, hunch.id), eq(predictionsTable.questionId, answer.questionId)))
        .groupBy(predictionsTable.optionId);

      const total = predCounts.reduce((s, r) => s + Number(r.cnt), 0);
      if (total > 0) {
        const countMap = new Map(predCounts.map((r) => [r.optionId, Number(r.cnt)]));
        await Promise.all(
          allOptionsForQ.map((o) => {
            const pct = ((countMap.get(o.id) ?? 0) / total) * 100;
            return db.update(optionsTable).set({ percentage: pct }).where(eq(optionsTable.id, o.id));
          })
        );
      }

      createdPredictions.push({ questionId: answer.questionId, optionId, label: normalizedLabel });
    }

    // Increment participant count and deduct tickets once
    await db
      .update(hunchesTable)
      .set({ participantCount: hunch.participantCount + 1 })
      .where(eq(hunchesTable.id, hunch.id));

    await db
      .update(usersTable)
      .set({ tickets: currentUser.tickets - cost })
      .where(eq(usersTable.id, req.session.userId));

    res.status(201).json({ hunchId: hunch.id, predictions: createdPredictions });
    sendPredictionEmail(
      currentUser.email,
      hunch,
      createdPredictions.map((p) => ({
        question: questionRows.find((q) => q.id === p.questionId)?.prompt,
        answer: p.label,
      })),
    ).catch(() => {});
    return;
  }

  // ── Single-prediction path (unchanged) ────────────────────────────────────
  const normalizedLabel = (body.data.freeText ?? "").trim();
  if (!normalizedLabel) {
    res.status(400).json({ error: "Answer cannot be empty." });
    return;
  }

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
    .values({ hunchId: params.data.id, optionId, userId: req.session.userId })
    .returning();

  await db
    .update(hunchesTable)
    .set({ participantCount: hunch.participantCount + 1 })
    .where(eq(hunchesTable.id, params.data.id));

  await db
    .update(usersTable)
    .set({ tickets: currentUser.tickets - cost })
    .where(eq(usersTable.id, req.session.userId));

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
      : [...existingOptions, { id: optionId, label: normalizedLabel, percentage: 0, hunchId: params.data.id, questionId: null }];

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
  sendPredictionEmail(currentUser.email, hunch, [{ answer: normalizedLabel }]).catch(() => {});
});

export default router;
