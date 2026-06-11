import { Router } from "express";
import { logger } from "../lib/logger";

const BUG_REPORT_RECIPIENT = "ger@hunch.me";

const router = Router();

router.post("/api/bug-reports", async (req, res): Promise<void> => {
  const { description, email, username, pageUrl } = req.body as {
    description?: string;
    email?: string;
    username?: string;
    pageUrl?: string;
  };

  if (!description || String(description).trim().length < 10) {
    res.status(400).json({ error: "La descripción debe tener al menos 10 caracteres." });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not configured — bug report email not sent");
    res.json({ ok: true });
    return;
  }

  try {
    const adminEmail = BUG_REPORT_RECIPIENT;

    const fromLabel = username ? `${username}${email ? ` (${email})` : ""}` : email ?? "Visitante anónimo";
    const pageLine = pageUrl ? `<tr><td style="padding:4px 0;color:#555;font-size:13px"><strong>Página:</strong> ${pageUrl}</td></tr>` : "";

    const html = `
<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:18px;font-weight:700;margin-bottom:4px">Reporte de error</p>
  <p style="color:#6d6d6d;margin-top:0">Un usuario reportó un problema en hunch.fan</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
  <table style="width:100%;font-size:14px">
    <tr><td style="padding:4px 0;color:#555"><strong>De:</strong> ${fromLabel}</td></tr>
    ${pageLine}
  </table>
  <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;font-size:14px;line-height:1.6">${String(description).trim()}</div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#aaa">Hunch — <a href="https://hunch.fan" style="color:#7c3aed">hunch.fan</a></p>
</body>
</html>`;

    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Hunch <no-reply@hunch.fan>",
        to: [adminEmail],
        subject: `Reporte de error - hunch.fan`,
        html,
      }),
    });

    if (!result.ok) {
      const body = await result.text().catch(() => "");
      logger.error({ status: result.status, body }, "Resend bug report email error");
    }
  } catch (err) {
    logger.error({ err }, "Bug report send failed");
  }

  res.json({ ok: true });
});

export default router;
