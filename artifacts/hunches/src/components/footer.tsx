import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Twitter, Youtube, Instagram, Twitch } from "lucide-react";

const SOCIAL_LINKS = [
  {
    label: "X (Twitter)",
    href: "https://x.com/hunch_fan",
    icon: <Twitter className="w-4 h-4" />,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@hunch-fan",
    icon: <Youtube className="w-4 h-4" />,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/hunch.fan",
    icon: <Instagram className="w-4 h-4" />,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@hunch.fan",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.53V6.78a4.85 4.85 0 0 1-1.02-.09z" />
      </svg>
    ),
  },
  {
    label: "Twitch",
    href: "https://www.twitch.tv/hunchfan",
    icon: <Twitch className="w-4 h-4" />,
  },
];

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border mt-auto bg-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center">
              <img src="/hunch-logo.png" alt="Hunch" className="h-[22px] w-auto" />
            </div>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
              {t("footer_tagline")}
            </p>
            {/* Social links */}
            <div className="flex items-center gap-2 pt-1">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
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
