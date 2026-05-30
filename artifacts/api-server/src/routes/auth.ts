import { Router, type IRouter } from "express";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable, otpsTable, ticketCodesTable, ticketCodeRedemptionsTable,
  ticketTransactionsTable, predictionsTable, optionsTable, hunchesTable, categoriesTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

const isDev = process.env.NODE_ENV !== "production";

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createOtp(identifier: string, type: "email" | "phone"): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpsTable).values({ identifier, type, code, expiresAt });
  return code;
}

async function verifyOtp(identifier: string, type: "email" | "phone", code: string): Promise<boolean> {
  const [otp] = await db
    .select()
    .from(otpsTable)
    .where(
      and(
        eq(otpsTable.identifier, identifier),
        eq(otpsTable.type, type),
        eq(otpsTable.code, code),
        gt(otpsTable.expiresAt, new Date()),
        isNull(otpsTable.usedAt),
      ),
    )
    .limit(1);

  if (!otp) return false;

  await db.update(otpsTable).set({ usedAt: new Date() }).where(eq(otpsTable.id, otp.id));
  return true;
}

async function sendEmailOtp(email: string, code: string): Promise<void> {
  if (isDev) {
    console.log(`[AUTH DEV] Email OTP for ${email}: ${code}`);
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hunch <no-reply@hunch.fan>",
      to: [email],
      subject: "Your Hunch verification code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a2e">Your verification code</h2>
          <p style="margin:0 0 24px;color:#555;font-size:15px">
            Use the code below to verify your email address. It expires in 10 minutes.
          </p>
          <div style="background:#f4f4f8;border-radius:10px;padding:20px 0;text-align:center">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a1a2e">${code}</span>
          </div>
          <p style="margin:24px 0 0;color:#888;font-size:13px">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
          <p style="margin:0;color:#aaa;font-size:12px">
            Hunch — a skill-based prediction platform. No money wagered.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
}

async function sendPhoneOtp(phone: string, code: string): Promise<void> {
  if (isDev) {
    console.log(`[AUTH DEV] SMS OTP for ${phone}: ${code}`);
  }

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  const body = new URLSearchParams({
    To:   phone,
    From: TWILIO_FROM_NUMBER,
    Body: `Your Hunch verification code is: ${code}. It expires in 10 minutes.`,
  });

  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Twilio error ${response.status}: ${text}`);
  }
}

// ── Signup flow ────────────────────────────────────────────────────────────

router.post("/auth/signup/send-email-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists. Please log in." });
    return;
  }

  const code = await createOtp(email.toLowerCase(), "email");
  await sendEmailOtp(email, code);

  req.session.pendingSignup = { email: email.toLowerCase() };
  res.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/signup/verify-email-otp", async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  const email = req.session.pendingSignup?.email;

  if (!email) { res.status(400).json({ error: "Session expired. Please restart signup." }); return; }
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const valid = await verifyOtp(email, "email", code.trim());
  if (!valid) { res.status(400).json({ error: "Invalid or expired code" }); return; }

  req.session.pendingSignup = { ...req.session.pendingSignup, emailVerified: true };
  res.json({ ok: true });
});

router.post("/auth/signup/send-phone-otp", async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!req.session.pendingSignup?.emailVerified) {
    res.status(400).json({ error: "Email must be verified first" });
    return;
  }
  if (!phone || phone.trim().length < 7) {
    res.status(400).json({ error: "Valid phone number required" });
    return;
  }

  const normalizedPhone = phone.replace(/\s+/g, "");
  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "This phone number is already registered." });
    return;
  }

  const code = await createOtp(normalizedPhone, "phone");
  await sendPhoneOtp(normalizedPhone, code);

  req.session.pendingSignup = { ...req.session.pendingSignup, phone: normalizedPhone };
  res.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/signup/verify-phone-otp", async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  const phone = req.session.pendingSignup?.phone;

  if (!phone) { res.status(400).json({ error: "Session expired. Please restart signup." }); return; }
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const valid = await verifyOtp(phone, "phone", code.trim());
  if (!valid) { res.status(400).json({ error: "Invalid or expired code" }); return; }

  req.session.pendingSignup = { ...req.session.pendingSignup, phoneVerified: true };
  res.json({ ok: true });
});

router.post("/auth/signup/set-password", async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  const pending = req.session.pendingSignup;

  if (!pending?.phoneVerified) {
    res.status(400).json({ error: "Phone must be verified before setting a password." });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  req.session.pendingSignup = { ...pending, passwordHash, passwordSet: true };
  res.json({ ok: true });
});

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

router.get("/auth/signup/check-username", async (req, res): Promise<void> => {
  const { username } = req.query as { username?: string };
  if (!username || !USERNAME_RE.test(username)) {
    res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, _ or ." });
    return;
  }
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username.toLowerCase()))
    .limit(1);
  res.json({ available: !existing });
});

router.post("/auth/signup/complete", async (req, res): Promise<void> => {
  const { address, dateOfBirth, username } = req.body as { address?: string; dateOfBirth?: string; username?: string };
  const pending = req.session.pendingSignup;

  if (!pending?.emailVerified || !pending?.phoneVerified || !pending?.passwordSet) {
    res.status(400).json({ error: "Email, phone, and password must be set before completing signup." });
    return;
  }
  if (!username || !USERNAME_RE.test(username)) {
    res.status(400).json({ error: "Valid username required." });
    return;
  }
  const [existingUsername] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username.toLowerCase()))
    .limit(1);
  if (existingUsername) {
    res.status(409).json({ error: "Username is already taken." });
    return;
  }
  if (!address || address.trim().length < 5) {
    res.status(400).json({ error: "Full address required" });
    return;
  }
  if (!dateOfBirth) {
    res.status(400).json({ error: "Date of birth required" });
    return;
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

  if (age < 18) {
    res.status(400).json({ error: "You must be 18 or older to create an account." });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: pending.email!,
      phone: pending.phone!,
      username: username.toLowerCase(),
      address: address.trim(),
      dateOfBirth,
      passwordHash: pending.passwordHash,
      tickets: 15,
    })
    .returning();

  await db.insert(ticketTransactionsTable).values({
    userId: user.id,
    type: "welcome",
    amount: 15,
    label: "Welcome bonus — 15 tickets",
  });

  req.session.pendingSignup = undefined;
  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email } });
});

// ── Login flow ─────────────────────────────────────────────────────────────

router.post("/auth/login/send-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with this email." });
    return;
  }

  const code = await createOtp(email.toLowerCase(), "email");
  await sendEmailOtp(email, code);
  req.session.loginEmail = email.toLowerCase();
  res.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/login/verify-otp", async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  const email = req.session.loginEmail;

  if (!email) { res.status(400).json({ error: "Session expired." }); return; }
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const valid = await verifyOtp(email, "email", code.trim());
  if (!valid) { res.status(400).json({ error: "Invalid or expired code" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) { res.status(404).json({ error: "Account not found" }); return; }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Your account has been suspended. Please contact support." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "Your account has been permanently banned." });
    return;
  }

  req.session.loginEmail = undefined;
  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email } });
});

// ── Session ────────────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    req.session.userId = undefined;
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ id: user.id, email: user.email, phone: user.phone, username: user.username, address: user.address, dateOfBirth: user.dateOfBirth, avatarUrl: user.avatarUrl, tickets: user.tickets });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { username, address, avatarUrl } = req.body as { username?: string; address?: string; avatarUrl?: string | null };

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (username !== undefined) {
    if (!USERNAME_RE.test(username)) {
      res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, _ or ." });
      return;
    }
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase()))
      .limit(1);
    if (existing && existing.id !== req.session.userId) {
      res.status(409).json({ error: "Username is already taken." });
      return;
    }
    updates.username = username.toLowerCase();
  }

  if (address !== undefined) {
    if (address.trim().length < 5) {
      res.status(400).json({ error: "Please enter a valid address." });
      return;
    }
    updates.address = address.trim();
  }

  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  res.json({ id: updated.id, email: updated.email, phone: updated.phone, username: updated.username, address: updated.address, dateOfBirth: updated.dateOfBirth, avatarUrl: updated.avatarUrl, tickets: updated.tickets });
});

router.delete("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { confirm } = req.body as { confirm?: boolean };
  if (!confirm) { res.status(400).json({ error: "Confirmation required." }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, req.session.userId));
  req.session.destroy(() => {
    res.clearCookie("hunch.sid");
    res.json({ ok: true });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("hunch.sid");
    res.json({ ok: true });
  });
});

// ── Ticket code validation & redemption ────────────────────────────────────

async function lookupAndValidateCode(
  code: string,
  userId: number,
  context: "registration" | "general",
): Promise<{ ok: true; row: typeof ticketCodesTable.$inferSelect } | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(ticketCodesTable)
    .where(eq(ticketCodesTable.code, code.trim().toUpperCase()))
    .limit(1);

  if (!row) return { ok: false, error: "Code not found." };
  if (!row.isActive) return { ok: false, error: "This code is no longer active." };

  const now = new Date();
  if (row.startsAt && now < row.startsAt) return { ok: false, error: "This code is not active yet." };
  if (row.expiresAt && now > row.expiresAt) return { ok: false, error: "This code has expired." };

  const scopeOk =
    row.scope === "both" ||
    row.scope === context;
  if (!scopeOk) {
    return { ok: false, error: context === "registration" ? "This code can only be used by existing users." : "This code is only valid during registration." };
  }

  if (row.codeType === "generic" && row.maxUses != null && row.currentUses >= row.maxUses) {
    return { ok: false, error: "This code has reached its maximum number of uses." };
  }

  const [existing] = await db
    .select({ id: ticketCodeRedemptionsTable.id })
    .from(ticketCodeRedemptionsTable)
    .where(and(eq(ticketCodeRedemptionsTable.ticketCodeId, row.id), eq(ticketCodeRedemptionsTable.userId, userId)))
    .limit(1);

  if (existing) return { ok: false, error: "You have already redeemed this code." };

  if (row.codeType === "unique" && row.currentUses >= 1) {
    return { ok: false, error: "This code has already been used." };
  }

  return { ok: true, row };
}

router.post("/auth/ticket-codes/validate", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { code, context } = req.body as { code?: string; context?: string };
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const ctx = context === "registration" ? "registration" : "general";
  const result = await lookupAndValidateCode(code, req.session.userId, ctx);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  res.json({
    valid: true,
    bonusTickets: result.row.bonusTickets,
    instructions: result.row.instructions,
    termsAndConditions: result.row.termsAndConditions,
    scope: result.row.scope,
    codeType: result.row.codeType,
  });
});

router.post("/auth/ticket-codes/redeem", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { code, context } = req.body as { code?: string; context?: string };
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const ctx = context === "registration" ? "registration" : "general";
  const result = await lookupAndValidateCode(code, req.session.userId, ctx);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  const { row } = result;
  const dbContext: "registration" | "manual" = ctx === "registration" ? "registration" : "manual";

  await db.insert(ticketCodeRedemptionsTable).values({
    ticketCodeId: row.id,
    userId: req.session.userId,
    ticketsGranted: row.bonusTickets,
    context: dbContext,
  });

  await db
    .update(ticketCodesTable)
    .set({ currentUses: row.currentUses + 1, updatedAt: new Date() })
    .where(eq(ticketCodesTable.id, row.id));

  const [updated] = await db
    .update(usersTable)
    .set({ tickets: (await db.select({ tickets: usersTable.tickets }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1))[0]!.tickets + row.bonusTickets })
    .where(eq(usersTable.id, req.session.userId))
    .returning({ tickets: usersTable.tickets });

  await db.insert(ticketTransactionsTable).values({
    userId: req.session.userId,
    type: "promo",
    amount: row.bonusTickets,
    label: `Promo code: ${row.code}`,
    reference: row.code,
  });

  res.json({ ok: true, ticketsGranted: row.bonusTickets, newTotal: updated?.tickets ?? null });
});

// ── My Hunches ──────────────────────────────────────────────────────────────

router.get("/auth/my-hunches", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const rows = await db
    .select({
      predictionId: predictionsTable.id,
      predictionCreatedAt: predictionsTable.createdAt,
      optionId: optionsTable.id,
      optionLabel: optionsTable.label,
      optionPercentage: optionsTable.percentage,
      hunchId: hunchesTable.id,
      hunchSlug: hunchesTable.slug,
      hunchTitle: hunchesTable.title,
      hunchStatus: hunchesTable.status,
      hunchEndsAt: hunchesTable.endsAt,
      hunchImageUrl: hunchesTable.imageUrl,
      hunchWinnerOption: hunchesTable.winnerOption,
      hunchParticipantCount: hunchesTable.participantCount,
      hunchTicketCost: hunchesTable.ticketCost,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
    })
    .from(predictionsTable)
    .innerJoin(hunchesTable, eq(hunchesTable.id, predictionsTable.hunchId))
    .innerJoin(optionsTable, eq(optionsTable.id, predictionsTable.optionId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, hunchesTable.categoryId))
    .where(eq(predictionsTable.userId, req.session.userId))
    .orderBy(desc(hunchesTable.endsAt));
  res.json(rows);
});

// ── Ticket activity ─────────────────────────────────────────────────────────

router.get("/auth/tickets/activity", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const rows = await db
    .select()
    .from(ticketTransactionsTable)
    .where(eq(ticketTransactionsTable.userId, req.session.userId))
    .orderBy(ticketTransactionsTable.createdAt);
  res.json(rows);
});

export default router;
