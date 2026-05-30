import Stripe from "stripe";

async function getCredentialsFromReplit(): Promise<{ publishableKey: string; secretKey: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as { items?: Array<{ settings: { publishable: string; secret: string } }> };
    const settings = data.items?.[0]?.settings;
    if (!settings?.secret) return null;

    return { publishableKey: settings.publishable, secretKey: settings.secret };
  } catch {
    return null;
  }
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  // 1. Direct env vars (Render, or any non-Replit deployment)
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    };
  }

  // 2. Replit connector (dev environment)
  const replit = await getCredentialsFromReplit();
  if (replit) return replit;

  throw new Error(
    "No Stripe credentials found. Set STRIPE_SECRET_KEY (and optionally STRIPE_PUBLISHABLE_KEY) " +
    "as environment variables, or connect the Stripe integration via the Replit Integrations tab.",
  );
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSyncInstance: import("stripe-replit-sync").StripeSync | null = null;

export async function getStripeSync(): Promise<import("stripe-replit-sync").StripeSync> {
  if (!stripeSyncInstance) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSyncInstance = new StripeSync({
      poolConfig: { connectionString: process.env.DATABASE_URL!, max: 2 },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSyncInstance;
}
