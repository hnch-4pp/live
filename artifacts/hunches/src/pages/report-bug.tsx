import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { CheckCircle } from "lucide-react";

export default function ReportBug() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 10) {
      setError(t("report_bug_min_length"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          email: email.trim() || undefined,
          username: user?.username ?? undefined,
          pageUrl: document.referrer || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? t("report_bug_error"));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t("report_bug_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-xl">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("report_bug_title")}</h1>
        <p className="text-muted-foreground mb-8">{t("report_bug_subtitle")}</p>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-lg font-semibold text-foreground">{t("report_bug_thanks")}</p>
            <p className="text-muted-foreground text-sm">{t("report_bug_thanks_body")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bug-email">{t("report_bug_email_label")}</Label>
              <Input
                id="bug-email"
                type="email"
                placeholder={t("report_bug_email_placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("report_bug_email_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-description">
                {t("report_bug_description_label")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bug-description"
                rows={6}
                placeholder={t("report_bug_description_placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t("report_bug_sending") : t("report_bug_submit")}
            </Button>
          </form>
        )}
      </div>
    </Layout>
  );
}
