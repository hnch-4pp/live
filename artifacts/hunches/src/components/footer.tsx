import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border mt-auto py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center opacity-80">
                <div className="w-2 h-2 bg-background rounded-full" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">Hunches</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              {t("footer_tagline")}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground">{t("footer_legal")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary transition-colors">{t("footer_terms")}</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">{t("footer_privacy")}</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground">{t("footer_platform")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/responsible" className="hover:text-primary transition-colors">{t("footer_responsible")}</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">{t("footer_how")}</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">{t("footer_support")}</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>{t("footer_rights", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/60">{t("footer_type")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
