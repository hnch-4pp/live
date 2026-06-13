import { Router, type IRouter } from "express";
import { eq, and, gt, isNull, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable, otpsTable, ticketCodesTable, ticketCodeRedemptionsTable,
  ticketTransactionsTable, predictionsTable, optionsTable, hunchesTable, categoriesTable,
  subscriptionsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { sendAdminAlert } from "../adminAlerts";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import { attributeUserToAffiliate } from "./affiliates";

const router: IRouter = Router();

const isDev = process.env.NODE_ENV !== "production";

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Referral code generation ─────────────────────────────────────────────────

function generateReferralCode(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const special = "@#$!";
  const all = alpha + special;
  const chars: string[] = [special[Math.floor(Math.random() * special.length)]!];
  while (chars.length < 8) chars.push(all[Math.floor(Math.random() * all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = generateReferralCode();
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique referral code");
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

// ── Welcome email ──────────────────────────────────────────────────────────

async function sendWelcomeEmail(email: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a1a;line-height:1.7;font-size:16px">

      <p style="margin:0 0 20px">Hola,</p>

      <p style="margin:0 0 20px">Quiero darte personalmente las gracias por unirte a Hunch.</p>

      <p style="margin:0 0 20px">En internet todos tienen opiniones.</p>

      <p style="margin:0 0 6px">Todos creen saber quién ganará el partido.</p>
      <p style="margin:0 0 6px">Qué tecnología será la próxima gran revolución.</p>
      <p style="margin:0 0 6px">Qué artista romperá récords.</p>
      <p style="margin:0 0 20px">Qué tendencia explotará antes que las demás.</p>

      <p style="margin:0 0 20px">Pero pocas veces existe una forma de demostrar quién realmente lo vio venir.</p>

      <p style="margin:0 0 20px">Por eso creamos Hunch.</p>

      <p style="margin:0 0 20px">Un lugar donde puedes poner a prueba tu intuición, tu conocimiento y tu capacidad para anticipar lo que sucederá antes que los demás.</p>

      <p style="margin:0 0 20px">Aquí no necesitas ser un experto profesional.</p>

      <p style="margin:0 0 6px">Sólo necesitas una corazonada.</p>
      <p style="margin:0 0 20px">Un buen Hunch.</p>

      <p style="margin:0 0 20px">Cada vez que participas en un Hunch estás diciendo:</p>

      <p style="margin:0 0 20px;font-style:italic;padding-left:16px;border-left:3px solid #e0e0e0;color:#444">"Yo creo que esto va a pasar."</p>

      <p style="margin:0 0 20px">Y cuando aciertas, no sólo ganas premios, puntos o reconocimiento.</p>

      <p style="margin:0 0 6px">Demuestras que tenías razón.</p>
      <p style="margin:0 0 20px">Y eso se siente increíble.</p>

      <p style="margin:0 0 20px">Como nuevo miembro, ya tienes acceso para participar en tu primer Hunch.</p>

      <p style="margin:0 0 20px">Te tomará menos de un minuto.</p>

      <p style="margin:0 0 6px">Haz tu predicción.</p>
      <p style="margin:0 0 6px">Confía en tu instinto.</p>
      <p style="margin:0 0 20px">Y descubre cómo se siente acertar antes que los demás.</p>

      <p style="margin:0 0 28px">
        <a href="https://hunch.fan"
           style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;font-size:15px;font-weight:600">
          Participa ahora en tu primer Hunch &rarr;
        </a>
      </p>

      <p style="margin:0 0 20px">Estamos apenas comenzando y me emociona muchísimo que formes parte de esta comunidad desde el inicio.</p>

      <p style="margin:0 0 6px">Gracias por confiar en nosotros.</p>
      <p style="margin:0 0 28px">Nos vemos dentro.</p>

      <p style="margin:0 0 4px;font-weight:600">Jerry L</p>
      <p style="margin:0 0 32px;color:#555;font-size:14px">Fundador de Hunch</p>

      <p style="margin:0 0 32px;color:#555;font-size:14px">
        <em>P.D. Si algún día tienes una idea para mejorar Hunch, quiero escucharla. Estamos construyendo esto junto con nuestra comunidad.</em>
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px"/>
      <p style="margin:0;color:#aaa;font-family:sans-serif;font-size:12px">
        Hunch &mdash; plataforma de predicciones basada en habilidades. No se apuesta dinero.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Jerry L de Hunch <jerry@hunch.me>",
      to: [email],
      subject: "Ya eres parte de Hunch 🚀",
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend welcome email error ${response.status}: ${body}`);
  }
}

// ── Referral notification email ──────────────────────────────────────────────

async function sendReferralNotificationEmail(referrerEmail: string, newUsername: string, ticketsEarned: number): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a1a;line-height:1.7;font-size:16px">
      <p style="margin:0 0 20px">Hola,</p>
      <p style="margin:0 0 20px">Alguien que conoces acaba de unirse a Hunch usando tu código de referido.</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:20px 24px;margin:0 0 24px">
        <p style="margin:0 0 4px;font-size:13px;color:#888;font-family:sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Nuevo usuario</p>
        <p style="margin:0;font-size:18px;font-weight:700;font-family:sans-serif">@${newUsername}</p>
      </div>
      <p style="margin:0 0 12px">Como gracias por compartir Hunch, hemos añadido <strong>${ticketsEarned} tickets</strong> a tu cuenta.</p>
      <p style="margin:0 0 28px">Sigue compartiendo tu código y sigue ganando tickets con cada nuevo referido.</p>
      <p style="margin:0 0 28px">
        <a href="https://hunch.fan/referral"
           style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;font-size:15px;font-weight:600">
          Ver mis referidos &rarr;
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px"/>
      <p style="margin:0;color:#aaa;font-family:sans-serif;font-size:12px">
        Hunch &mdash; plataforma de predicciones basada en habilidades. No se apuesta dinero.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hunch <noreply@hunch.fan>",
      to: [referrerEmail],
      subject: `Alguien usó tu código — +${ticketsEarned} tickets`,
      html,
    }),
  });
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

router.post("/auth/signup/set-name", async (req, res): Promise<void> => {
  const { firstName, lastName } = req.body as { firstName?: string; lastName?: string };
  const pending = req.session.pendingSignup;

  if (!pending?.phoneVerified) {
    res.status(400).json({ error: "Phone must be verified before setting your name." });
    return;
  }
  const fn = firstName?.trim() ?? "";
  const ln = lastName?.trim() ?? "";
  if (fn.length < 1) { res.status(400).json({ error: "El nombre es requerido." }); return; }
  if (ln.length < 1) { res.status(400).json({ error: "Los apellidos son requeridos." }); return; }

  req.session.pendingSignup = { ...pending, firstName: fn, lastName: ln, nameSet: true };
  res.json({ ok: true });
});

router.post("/auth/signup/set-password", async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  const pending = req.session.pendingSignup;

  if (!pending?.phoneVerified || !pending?.nameSet) {
    res.status(400).json({ error: "Phone and name must be set before setting a password." });
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

  const { affiliateRef: bodyAffiliateRef } = req.body as { affiliateRef?: string };

  const [user] = await db
    .insert(usersTable)
    .values({
      email: pending.email!,
      phone: pending.phone!,
      username: username.toLowerCase(),
      firstName: pending.firstName ?? null,
      lastName: pending.lastName ?? null,
      address: address.trim(),
      dateOfBirth,
      passwordHash: pending.passwordHash,
      tickets: 5,
    })
    .returning();

  await db.insert(ticketTransactionsTable).values({
    userId: user.id,
    type: "welcome",
    amount: 5,
    label: "Welcome bonus — 5 tickets",
  });

  // Generate unique referral code for the new user
  try {
    const newReferralCode = await generateUniqueReferralCode();
    await db.update(usersTable).set({ referralCode: newReferralCode }).where(eq(usersTable.id, user.id));
  } catch { /* non-fatal — backfill migration will cover it on next restart */ }

  // Affiliate attribution — prefer body param, fall back to session
  const affiliateRef = bodyAffiliateRef?.trim() || req.session.pendingSignup?.affiliateRef;
  req.session.pendingSignup = undefined;
  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email } });

  if (affiliateRef) {
    attributeUserToAffiliate(user.id, affiliateRef).catch(() => {});
  }

  sendWelcomeEmail(user.email).catch(() => {});

  sendAdminAlert(
    "new_user",
    "New user registered",
    `Email: ${user.email}\nPhone: ${user.phone}\nUsername: @${user.username}`,
    `Hunches: new signup — ${user.email}`,
  ).catch(() => {});
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

// ── Login with password ─────────────────────────────────────────────────────

router.post("/auth/login/check-method", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "No account found with this email." });
    return;
  }

  const loginMethod = user.loginMethod ?? "password";

  res.json({
    loginMethod,
    hasPassword: !!user.passwordHash,
  });
});

router.post("/auth/login/password", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "This account does not have a password set. Use one-time code instead." });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Your account has been suspended. Please contact support." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "Your account has been permanently banned." });
    return;
  }

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email } });
});

// ── Password reset ──────────────────────────────────────────────────────────

async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (isDev) {
    console.log(`[AUTH DEV] Password reset OTP for ${email}: ${code}`);
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
      subject: "Reset your Hunch password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a2e">Reset your password</h2>
          <p style="margin:0 0 24px;color:#555;font-size:15px">
            Use the code below to reset your Hunch password. It expires in 10 minutes.
          </p>
          <div style="background:#f4f4f8;border-radius:10px;padding:20px 0;text-align:center">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a1a2e">${code}</span>
          </div>
          <p style="margin:24px 0 0;color:#888;font-size:13px">
            If you didn't request a password reset, you can safely ignore this email.
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

router.post("/auth/password-reset/request", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.json({ ok: true });
    return;
  }

  const code = await createOtp(email.toLowerCase(), "email");
  await sendPasswordResetEmail(email, code);
  req.session.passwordResetEmail = email.toLowerCase();
  req.session.passwordResetVerified = false;
  res.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/password-reset/verify-otp", async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  const email = req.session.passwordResetEmail;

  if (!email) { res.status(400).json({ error: "Session expired. Please start again." }); return; }
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const valid = await verifyOtp(email, "email", code.trim());
  if (!valid) { res.status(400).json({ error: "Invalid or expired code" }); return; }

  req.session.passwordResetVerified = true;
  res.json({ ok: true });
});

router.post("/auth/password-reset/set", async (req, res): Promise<void> => {
  const { newPassword } = req.body as { newPassword?: string };
  const email = req.session.passwordResetEmail;

  if (!email || !req.session.passwordResetVerified) {
    res.status(400).json({ error: "Session expired. Please start again." });
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) { res.status(404).json({ error: "Account not found." }); return; }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Your account has been suspended. Please contact support." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "Your account has been permanently banned." });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.execute(sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`);

  req.session.passwordResetEmail = undefined;
  req.session.passwordResetVerified = undefined;
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
  // Track last access (fire and forget)
  void db.update(usersTable)
    .set({ lastAccessAt: new Date() })
    .where(eq(usersTable.id, req.session.userId))
    .catch((err: unknown) => logger.error({ err }, "Failed to update lastAccessAt"));
  const loginMethod = user.loginMethod ?? "password";
  res.json({ id: user.id, email: user.email, phone: user.phone, username: user.username, firstName: user.firstName, lastName: user.lastName, address: user.address, dateOfBirth: user.dateOfBirth, avatarUrl: user.avatarUrl, tickets: user.tickets, loginMethod, hasPassword: !!user.passwordHash });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { username, address, avatarUrl, loginMethod, referralSource, firstName, lastName } = req.body as { username?: string; address?: string; avatarUrl?: string | null; loginMethod?: string; referralSource?: string; firstName?: string; lastName?: string };

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

  if (firstName !== undefined) {
    const fn = firstName.trim();
    if (fn.length < 1) { res.status(400).json({ error: "El nombre no puede estar vacío." }); return; }
    updates.firstName = fn;
  }

  if (lastName !== undefined) {
    const ln = lastName.trim();
    if (ln.length < 1) { res.status(400).json({ error: "Los apellidos no pueden estar vacíos." }); return; }
    updates.lastName = ln;
  }

  if (referralSource !== undefined) {
    updates.referralSource = referralSource.trim().slice(0, 100) || null;
  }

  if (loginMethod !== undefined) {
    if (loginMethod !== "password" && loginMethod !== "otp") {
      res.status(400).json({ error: "loginMethod must be 'password' or 'otp'." });
      return;
    }
  }

  if (Object.keys(updates).length === 0 && loginMethod === undefined && referralSource === undefined) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  if (loginMethod !== undefined) {
    await db.execute(
      sql`UPDATE users SET login_method = ${loginMethod} WHERE id = ${req.session.userId}`
    );
  }

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session.userId));
  }

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  res.json({ id: updated.id, email: updated.email, phone: updated.phone, username: updated.username, firstName: updated.firstName, lastName: updated.lastName, address: updated.address, dateOfBirth: updated.dateOfBirth, avatarUrl: updated.avatarUrl, tickets: updated.tickets, loginMethod: updated.loginMethod ?? "password", hasPassword: !!updated.passwordHash });
});

router.post("/auth/me/set-password", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  if (user.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password is required to set a new one." });
      return;
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(403).json({ error: "Current password is incorrect." });
      return;
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.execute(sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${req.session.userId}`);
  res.json({ ok: true });
});

// GET /auth/me/account-status — subscription + ticket info for the deletion flow
router.get("/auth/me/account-status", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db
    .select({ tickets: usersTable.tickets })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [sub] = await db
    .select({
      tier: subscriptionsTable.tier,
      status: subscriptionsTable.status,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionsTable.cancelAtPeriodEnd,
    })
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, req.session.userId), eq(subscriptionsTable.status, "active")))
    .limit(1);
  res.json({ tickets: user.tickets, subscription: sub ?? null });
});

router.delete("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { confirm } = req.body as { confirm?: boolean };
  if (!confirm) { res.status(400).json({ error: "Confirmation required." }); return; }

  const userId = req.session.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  // Check for active paid subscription
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
    .limit(1);

  if (sub) {
    // Paid plan: cancel at period end (if not already), schedule account deletion
    if (!sub.cancelAtPeriodEnd) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
        await db
          .update(subscriptionsTable)
          .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
      } catch (err: unknown) {
        logger.error({ err }, "Failed to cancel Stripe subscription during account deletion");
      }
    }
    const deletionDate = sub.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db
      .update(usersTable)
      .set({ pendingDeletion: true, deletionScheduledFor: deletionDate })
      .where(eq(usersTable.id, userId));
    sendAdminAlert(
      "account_delete",
      "User scheduled account deletion",
      `Email: ${user.email}\nUser ID: ${userId}\nDeletion date: ${deletionDate.toISOString()}`,
      `Hunches: account deletion scheduled — ${user.email}`,
    ).catch(() => {});
    res.json({ ok: true, scheduled: true, deletionDate: deletionDate.toISOString() });
    return;
  }

  // Free plan: delete immediately (FK-safe order)
  await db.delete(predictionsTable).where(eq(predictionsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  req.session.destroy(() => {
    res.clearCookie("hunch.sid");
    res.json({ ok: true, deleted: true });
  });

  sendAdminAlert(
    "account_delete",
    "User deleted their account",
    `Email: ${user.email}\nUser ID: ${userId}`,
    `Hunches: account deleted — ${user.email}`,
  ).catch(() => {});
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

// ── Member-Get-Member: referral code redemption ──────────────────────────────

const MGM_NEW_USER_TICKETS = 5;
const MGM_REFERRER_TICKETS = 10;

router.post("/auth/referral-codes/redeem", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { code } = req.body as { code?: string };
  if (!code?.trim()) { res.status(400).json({ error: "Code required" }); return; }

  const normalized = code.trim().toUpperCase();
  const currentUserId = req.session.userId;

  // Find referrer by code
  const [referrer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, normalized))
    .limit(1);

  if (!referrer) { res.status(400).json({ error: "Code not found." }); return; }
  if (referrer.id === currentUserId) { res.status(400).json({ error: "You cannot use your own referral code." }); return; }

  // Check current user hasn't already been referred
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId))
    .limit(1);
  if (!currentUser) { res.status(404).json({ error: "User not found." }); return; }
  if (currentUser.referredByUserId) { res.status(400).json({ error: "You have already used a referral code." }); return; }

  // Award +5 tickets to new user
  await db.update(usersTable)
    .set({ tickets: sql`tickets + ${MGM_NEW_USER_TICKETS}`, referredByUserId: referrer.id })
    .where(eq(usersTable.id, currentUserId));

  await db.insert(ticketTransactionsTable).values({
    userId: currentUserId,
    type: "referral",
    amount: MGM_NEW_USER_TICKETS,
    label: `Referral bonus — ${MGM_NEW_USER_TICKETS} tickets`,
    reference: referrer.username ?? referrer.email,
  });

  // Award +10 tickets to referrer
  await db.update(usersTable)
    .set({ tickets: sql`tickets + ${MGM_REFERRER_TICKETS}` })
    .where(eq(usersTable.id, referrer.id));

  await db.insert(ticketTransactionsTable).values({
    userId: referrer.id,
    type: "referral",
    amount: MGM_REFERRER_TICKETS,
    label: `Referido registrado — +${MGM_REFERRER_TICKETS} tickets`,
    reference: currentUser.username ?? currentUser.email,
  });

  res.json({ ok: true, ticketsGranted: MGM_NEW_USER_TICKETS });

  // Send notification email to referrer (non-blocking)
  sendReferralNotificationEmail(referrer.email, currentUser.username ?? currentUser.email, MGM_REFERRER_TICKETS).catch(() => {});
});

// ── My referral info ─────────────────────────────────────────────────────────

router.get("/auth/me/referral", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [user] = await db
    .select({ referralCode: usersTable.referralCode })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const referrals = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.referredByUserId, req.session.userId))
    .orderBy(desc(usersTable.createdAt));

  res.json({
    referralCode: user.referralCode,
    referredCount: referrals.length,
    referrals,
  });
});

export default router;
