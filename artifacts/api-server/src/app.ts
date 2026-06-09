import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import ogRouter from "./routes/og";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();
app.set("trust proxy", 1);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) throw new Error("SESSION_SECRET env var is required");

// ── PostgreSQL session store ───────────────────────────────────────────────
const PgSession = connectPg(session);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Stripe webhook ─────────────────────────────────────────────────────────
// MUST be registered BEFORE express.json() so req.body stays a raw Buffer.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// ── Standard middleware ────────────────────────────────────────────────────
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    name: "hunch.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — survives deploys
    },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, cb) {
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https?:\/\/(www\.)?hunch\.fan$/.test(origin) ||
        /\.replit\.dev$/.test(origin) ||
        /\.repl\.co$/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(ogRouter);
app.use("/api", router);

// ── Frontend static file serving (production) ──────────────────────────────
// When Express serves all traffic (not split with a separate static site),
// it must serve the Vite-built frontend AND provide an SPA fallback so React
// Router handles client-side navigation. The OG router above must remain
// mounted first so /hunch/:slug is intercepted before static serving.
if (process.env.NODE_ENV === "production") {
  const frontendCandidates = [
    path.join(process.cwd(), "../hunches/dist/public"),
    path.join(process.cwd(), "../../artifacts/hunches/dist/public"),
    path.join(process.cwd(), "artifacts/hunches/dist/public"),
  ];
  const frontendDist = frontendCandidates.find((p) => existsSync(p));

  if (frontendDist) {
    app.use(express.static(frontendDist, { index: false }));

    // SPA catch-all: return index.html for any non-API, non-hunch path
    // so React Router handles client-side routing.
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }
}

// Global error handler — must have 4 params for Express to treat it as error middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled server error");
  let message = "Internal server error";
  if (err instanceof Error) {
    const raw = err.message;
    // Don't expose raw SQL query strings to clients
    if (raw.startsWith("Failed query:") || raw.includes("insert into") || raw.includes("select ")) {
      message = "Database operation failed. Please try again.";
    } else {
      message = raw || message;
    }
  }
  res.status(500).json({ error: message });
});

export default app;
