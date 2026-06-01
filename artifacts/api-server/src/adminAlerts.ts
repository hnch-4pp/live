import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

export type AlertEvent =
  | "new_user"
  | "ticket_pack_purchase"
  | "subscription_start"
  | "subscription_cancel"
  | "account_delete"
  | "hunch_reminder_3d"
  | "hunch_reminder_1d"
  | "hunch_reminder_1h";

export interface AlertEventPrefs {
  email: boolean;
  sms: boolean;
}

export interface AlertPrefs {
  adminEmail: string;
  adminPhone: string;
  events: Record<AlertEvent, AlertEventPrefs>;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  adminEmail: "",
  adminPhone: "",
  events: {
    new_user:             { email: true,  sms: false },
    ticket_pack_purchase: { email: true,  sms: false },
    subscription_start:   { email: true,  sms: false },
    subscription_cancel:  { email: true,  sms: true  },
    account_delete:       { email: true,  sms: false },
    hunch_reminder_3d:    { email: true,  sms: false },
    hunch_reminder_1d:    { email: true,  sms: false },
    hunch_reminder_1h:    { email: false, sms: false },
  },
};

export async function getAdminAlertPrefs(): Promise<AlertPrefs> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "admin_alert_prefs"))
    .limit(1);
  if (!row) return { ...DEFAULT_ALERT_PREFS };
  try {
    const parsed = JSON.parse(row.value) as Partial<AlertPrefs>;
    return {
      adminEmail: parsed.adminEmail ?? "",
      adminPhone: parsed.adminPhone ?? "",
      events: { ...DEFAULT_ALERT_PREFS.events, ...parsed.events },
    };
  } catch {
    return { ...DEFAULT_ALERT_PREFS };
  }
}

export async function saveAdminAlertPrefs(prefs: AlertPrefs): Promise<void> {
  const value = JSON.stringify(prefs);
  await db
    .insert(appSettingsTable)
    .values({ key: "admin_alert_prefs", value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

async function sendAdminEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { logger.warn("RESEND_API_KEY not configured — admin email not sent"); return; }

  const html = `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a;max-width:560px">
    <h2 style="margin:0 0 12px;font-size:16px">${subject}</h2>
    <pre style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:13px;white-space:pre-wrap">${text}</pre>
    <p style="margin-top:20px;font-size:12px;color:#888">Hunches Admin Alerts</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Hunches Alerts <noreply@hunches.app>", to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "Resend admin alert error");
  }
}

async function sendAdminSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) { logger.warn("Twilio not configured — admin SMS not sent"); return; }

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, text }, "Twilio admin alert error");
  }
}

export async function sendAdminAlert(
  event: AlertEvent,
  subject: string,
  emailBody: string,
  smsBody: string,
): Promise<void> {
  try {
    const prefs = await getAdminAlertPrefs();
    const evPrefs = prefs.events[event];
    if (!evPrefs) return;

    const tasks: Promise<void>[] = [];
    if (evPrefs.email && prefs.adminEmail.trim()) {
      tasks.push(sendAdminEmail(prefs.adminEmail.trim(), subject, emailBody));
    }
    if (evPrefs.sms && prefs.adminPhone.trim()) {
      tasks.push(sendAdminSms(prefs.adminPhone.trim(), smsBody));
    }
    await Promise.allSettled(tasks);
  } catch (err) {
    logger.error({ err, event }, "sendAdminAlert failed");
  }
}

const REMINDER_KEY_PREFIX = "hunch_reminder_sent:";

export async function isReminderAlreadySent(hunchId: number, window: "3d" | "1d" | "1h"): Promise<boolean> {
  const key = `${REMINDER_KEY_PREFIX}${hunchId}:${window}`;
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  return !!row;
}

export async function markReminderSent(hunchId: number, window: "3d" | "1d" | "1h"): Promise<void> {
  const key = `${REMINDER_KEY_PREFIX}${hunchId}:${window}`;
  await db
    .insert(appSettingsTable)
    .values({ key, value: new Date().toISOString() })
    .onConflictDoNothing();
}
