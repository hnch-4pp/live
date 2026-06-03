import { Router } from "express";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { db } from "@workspace/db";
import { hunchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const APP_URL = process.env.APP_URL ?? "https://hunch.fan";
const DEFAULT_TITLE = "Hunch";
const DEFAULT_DESCRIPTION =
  "Hunch — the skill-based prediction platform. Call outcomes of sports, music, entertainment, and finance to win real prizes. No money wagered.";
const DEFAULT_IMAGE = `${APP_URL}/favicon.png`;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3).trimEnd() + "...";
}

let cachedHtml: string | null = null;

function getIndexHtml(): string {
  if (cachedHtml && process.env.NODE_ENV === "production") return cachedHtml;

  const isDev = process.env.NODE_ENV !== "production";
  const candidates = isDev
    ? [
        path.join(process.cwd(), "../hunches/index.html"),
        path.join(process.cwd(), "../../artifacts/hunches/index.html"),
      ]
    : [
        path.join(process.cwd(), "../hunches/dist/public/index.html"),
        path.join(process.cwd(), "../../artifacts/hunches/dist/public/index.html"),
        path.join(process.cwd(), "../hunches/index.html"),
      ];

  for (const p of candidates) {
    if (existsSync(p)) {
      const html = readFileSync(p, "utf-8");
      if (process.env.NODE_ENV === "production") cachedHtml = html;
      return html;
    }
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Hunch</title></head><body><div id="root"></div></body></html>`;
}

function injectOgTags(
  html: string,
  { title, description, image, url }: { title: string; description: string; image: string; url: string },
): string {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const img = escapeAttr(image);
  const u = escapeAttr(url);

  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  result = result.replace(/<meta name="description"[^>]*\/?>/, `<meta name="description" content="${d}" />`);
  result = result.replace(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${t}" />`);
  result = result.replace(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${d}" />`);
  result = result.replace(/<meta name="twitter:title"[^>]*\/?>/, `<meta name="twitter:title" content="${t}" />`);
  result = result.replace(/<meta name="twitter:description"[^>]*\/?>/, `<meta name="twitter:description" content="${d}" />`);

  const extraTags = [
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join("\n    ");

  if (result.includes('property="og:image"')) {
    result = result.replace(/<meta property="og:image"[^>]*\/?>/, `<meta property="og:image" content="${img}" />`);
    if (!result.includes('property="og:url"')) {
      result = result.replace("</head>", `    <meta property="og:url" content="${u}" />\n  </head>`);
    }
  } else {
    result = result.replace("</head>", `    ${extraTags}\n  </head>`);
  }

  return result;
}

router.get("/hunch/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let image = DEFAULT_IMAGE;

  try {
    const [hunch] = await db
      .select({
        title: hunchesTable.title,
        description: hunchesTable.description,
        imageUrl: hunchesTable.imageUrl,
      })
      .from(hunchesTable)
      .where(eq(hunchesTable.slug, slug))
      .limit(1);

    if (hunch) {
      title = `${hunch.title} — Hunch`;
      const plain = stripHtml(hunch.description ?? "");
      if (plain) description = truncate(plain, 200);
      if (hunch.imageUrl) image = hunch.imageUrl;
    }
  } catch {
  }

  const url = `${APP_URL}/hunch/${slug}`;

  const html = injectOgTags(getIndexHtml(), { title, description, image, url });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.send(html);
});

export default router;
