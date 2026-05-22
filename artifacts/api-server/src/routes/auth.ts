import { Router, type IRouter } from "express";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, otpsTable } from "@workspace/db";

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
    return;
  }
  // Production: configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  // and integrate nodemailer or a transactional email service here
}

async function sendPhoneOtp(phone: string, code: string): Promise<void> {
  if (isDev) {
    console.log(`[AUTH DEV] SMS OTP for ${phone}: ${code}`);
    return;
  }
  // Production: configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE
  // and integrate Twilio here
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

router.post("/auth/signup/complete", async (req, res): Promise<void> => {
  const { address, dateOfBirth } = req.body as { address?: string; dateOfBirth?: string };
  const pending = req.session.pendingSignup;

  if (!pending?.emailVerified || !pending?.phoneVerified) {
    res.status(400).json({ error: "Email and phone must be verified before completing signup." });
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
      address: address.trim(),
      dateOfBirth,
    })
    .returning();

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
  res.json({ id: user.id, email: user.email, phone: user.phone, address: user.address, dateOfBirth: user.dateOfBirth });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("hunch.sid");
    res.json({ ok: true });
  });
});

export default router;
