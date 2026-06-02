import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border mt-auto bg-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <div className="w-2.5 h-2.5 bg-white rounded-full" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">Hunches</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
              {t("footer_tagline")}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-sm text-foreground">{t("footer_legal")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary transition-colors">{t("footer_terms")}</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">{t("footer_privacy")}</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-sm text-foreground">{t("footer_platform")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/affiliate" className="hover:text-primary transition-colors">Affiliates</Link></li>
              <li><Link href="/responsible" className="hover:text-primary transition-colors">{t("footer_responsible")}</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">{t("footer_pricing")}</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">{t("footer_how")}</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">{t("footer_support")}</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>{t("footer_rights", { year: new Date().getFullYear() })}</p>
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/60">{t("footer_type")}</span>
        </div>
      </div>
    </footer>
  );
}
