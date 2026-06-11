import { Router } from "express";
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

// /api/og/hunch/:slug — OG endpoint for social bots and share links.
//
// /hunch/* is served by the static SPA (artifact.toml paths = ["/api"] only).
//
// - Social bots (WhatsApp, Telegram, Twitter…): user-agent detection →
//   minimal OG-only HTML so the platform renders a rich preview.
// - Browsers: 302 redirect to the canonical /hunch/:slug SPA route,
//   which is served by the static file handler and never fails.
const BOT_RE =
  /whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|applebot|crawler|spider\b|bot\b/i;

router.get("/api/og/hunch/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const ua = req.headers["user-agent"] ?? "";
  const isBot = BOT_RE.test(ua);

  if (isBot) {
    const data = await fetchHunchData(slug);
    const html = buildOgPage({ ...data });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.send(html);
    return;
  }

  // Regular browser: redirect to the SPA route — static file handler serves
  // index.html reliably regardless of API server state.
  res.redirect(302, `/hunch/${encodeURIComponent(slug)}`);
});

export default router;
