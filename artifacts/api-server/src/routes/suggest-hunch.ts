import { Router } from "express";
import { logger } from "../lib/logger";

const NOTIFICATION_RECIPIENT = "g@hunch.fan";
const router = Router();

router.post("/suggest-hunch", async (req, res): Promise<void> => {
  const { title, category, description, why, sourceUrl, senderName, senderEmail } = req.body as {
    title?: string;
    category?: string;
    description?: string;
    why?: string;
    sourceUrl?: string;
    senderName?: string;
    senderEmail?: string;
  };

  if (!title || String(title).trim().length < 3) {
    res.status(400).json({ error: "El título debe tener al menos 3 caracteres." });
    return;
  }
  if (!description || String(description).trim().length < 10) {
    res.status(400).json({ error: "La descripción debe tener al menos 10 caracteres." });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not configured — suggest-hunch email not sent");
    res.json({ ok: true });
    return;
  }

  try {
    const fromLabel = senderName
      ? `${senderName}${senderEmail ? ` <${senderEmail}>` : ""}`
      : senderEmail ?? "Visitante anónimo";

    const row = (label: string, value: string) =>
      value ? `<tr><td style="padding:5px 0;color:#555;font-size:13px;vertical-align:top;width:130px"><strong>${label}:</strong></td><td style="padding:5px 0;font-size:13px;color:#111">${value}</td></tr>` : "";

    const html = `
<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:20px;font-weight:700;margin-bottom:4px">Nuevo Hunch sugerido</p>
  <p style="color:#6d6d6d;margin-top:0;font-size:14px">Un usuario envió una sugerencia desde hunch.fan</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    ${row("De", fromLabel)}
    ${row("Categoría", category ?? "")}
    ${row("Fuente / enlace", sourceUrl ?? "")}
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
  <p style="font-size:13px;font-weight:700;margin-bottom:6px;color:#7c3aed">Hunch sugerido</p>
  <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px 16px;margin-bottom:12px;font-size:15px;font-weight:600">${String(title).trim()}</div>
  <p style="font-size:13px;font-weight:700;margin-bottom:6px;color:#7c3aed">Descripción del evento</p>
  <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px 16px;margin-bottom:12px;font-size:14px;line-height:1.6;white-space:pre-wrap">${String(description).trim()}</div>
  ${why ? `<p style="font-size:13px;font-weight:700;margin-bottom:6px;color:#7c3aed">Por qué es un buen Hunch</p>
  <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${String(why).trim()}</div>` : ""}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#aaa">Hunch — <a href="https://hunch.fan" style="color:#7c3aed">hunch.fan</a></p>
</body>
</html>`;

    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Hunch <no-reply@hunch.fan>",
        to: [NOTIFICATION_RECIPIENT],
        reply_to: senderEmail ? [senderEmail] : undefined,
        subject: `Sugerencia de Hunch: ${String(title).trim()}`,
        html,
      }),
    });

    if (!result.ok) {
      const body = await result.text().catch(() => "");
      logger.error({ status: result.status, body }, "Resend suggest-hunch email error");
    }
  } catch (err) {
    logger.error({ err }, "Suggest-hunch notification send failed");
  }

  res.json({ ok: true });
});

export default router;
