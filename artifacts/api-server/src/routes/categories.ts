import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, hunchesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.enabled, true))
    .orderBy(categoriesTable.sortOrder, categoriesTable.id);

  const result = await Promise.all(
    cats.map(async (cat) => {
      const [{ total }] = await db
        .select({ total: count() })
        .from(hunchesTable)
        .where(eq(hunchesTable.categoryId, cat.id));

      return {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        hunchCount: Number(total),
      };
    }),
  );

  res.json(result);
});

export default router;
