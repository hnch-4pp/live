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

// ── Production OG page ──────────────────────────────────────────────────────
// Serves a self-contained minimal page with OG tags + an immediate browser
// redirect to the canonical SPA URL. No dependency on finding index.html.
//
// - Social bots (WhatsApp, Telegram, Twitter…) do NOT execute JS: they read
//   the OG tags and render the correct preview.
// - Browsers DO execute the window.location.replace() script and land on the
//   canonical /hunch/:slug route served by the SPA.
function buildOgPage({
  title,
  description,
  image,
  url,
  redirectTo,
}: {
  title: string;
  description: string;
  image: string;
  url: string;
  redirectTo?: string;
}): string {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const img = escapeAttr(image);
  const u = escapeAttr(url);

  const redirectScript = redirectTo
    ? `<script>window.location.replace(${JSON.stringify(redirectTo)})</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${t}</title>
  <meta name="description" content="${d}"/>
  <meta property="og:title" content="${t}"/>
  <meta property="og:description" content="${d}"/>
  <meta property="og:image" content="${img}"/>
  <meta property="og:url" content="${u}"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${t}"/>
  <meta name="twitter:description" content="${d}"/>
  <meta name="twitter:image" content="${img}"/>
  ${redirectScript}
</head>
<body></body>
</html>`;
}

// ── Dev-only: inject OG tags into index.html ────────────────────────────────
// Used only by the /hunch/:slug route in Replit dev (artifact.toml routes
// /hunch/* to Express). Not used in production.
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
        path.join(process.cwd(), "artifacts/hunches/dist/public/index.html"),
        path.join(process.cwd(), "../hunches/dist/public/index.html"),
        path.join(process.cwd(), "../../artifacts/hunches/dist/public/index.html"),
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

async function fetchHunchData(slug: string): Promise<{
  title: string;
  description: string;
  image: string;
  url: string;
}> {
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

  return { title, description, image, url: `${APP_URL}/hunch/${slug}` };
}

// Dev / Replit: /hunch/:slug is routed directly to Express via artifact.toml.
// Injects OG tags into index.html so the SPA boots normally in the same response.
router.get("/hunch/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const data = await fetchHunchData(slug);
  const html = injectOgTags(getIndexHtml(), data);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.send(html);
});

// Production (Render): /hunch/:slug in the static site _redirects to this endpoint.
//
// - Social bots (WhatsApp, Telegram, Twitter…): user-agent detection → minimal
//   OG-only HTML. Bots read the tags and never follow the redirect script anyway.
//
// - Browsers: served the full SPA HTML with OG tags injected + a
//   history.replaceState() that silently fixes the address bar back to
//   /hunch/:slug — no navigation, no loop.
const BOT_RE =
  /whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|applebot|crawler|spider\b|bot\b/i;

router.get("/api/og/hunch/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const data = await fetchHunchData(slug);

  const ua = req.headers["user-agent"] ?? "";
  const isBot = BOT_RE.test(ua);

  if (isBot) {
    // Pure OG page — no redirect script, bots don't execute JS anyway.
    const html = buildOgPage({ ...data });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.send(html);
    return;
  }

  // Browser: serve the full SPA with OG tags so it boots normally,
  // then silently rewrite the address bar to the canonical /hunch/:slug URL.
  // We do NOT redirect — that would loop back through _redirects.
  const indexHtml = getIndexHtml();
  let injected = injectOgTags(indexHtml, data);
  const fixUrl = `<script>if(window.history)window.history.replaceState(null,'',${JSON.stringify(`/hunch/${slug}`)})</script>`;
  injected = injected.replace("</body>", `${fixUrl}</body>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(injected);
});

export default router;
