import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Globe, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(LANGUAGES[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (lang: typeof LANGUAGES[0]) => {
    setSelected(lang);
    i18n.changeLanguage(lang.code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-white/5"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{selected.label}</span>
        <ChevronUp
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 rounded-xl border border-border/60 bg-[hsl(240_10%_8%)] shadow-2xl shadow-black/60 overflow-hidden z-50">
          <div className="max-h-80 overflow-y-auto py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors group"
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span
                  className={
                    lang.code === selected.code
                      ? "font-medium text-foreground flex-1"
                      : "text-muted-foreground group-hover:text-foreground transition-colors flex-1"
                  }
                >
                  {lang.label}
                </span>
                {lang.code === selected.code && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <div className="w-3 h-3 bg-background rounded-full" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">Hunches</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/?category=sports" className="hover:text-primary transition-colors">{t("nav_sports")}</Link>
            <Link href="/?category=crypto" className="hover:text-primary transition-colors">{t("nav_crypto")}</Link>
            <Link href="/?category=politics" className="hover:text-primary transition-colors">{t("nav_politics")}</Link>
            <Link href="/?category=entertainment" className="hover:text-primary transition-colors">{t("nav_entertainment")}</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            {t("nav_login")}
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-5">
              {t("nav_signup")}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
