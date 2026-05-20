import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const CATEGORIES = [
  { label: "Sports",                emoji: "🏆", slug: "sports" },
  { label: "Music & Entertainment", emoji: "🎵", slug: "music" },
  { label: "Internet & Creators",   emoji: "📱", slug: "creators" },
  { label: "Tech & Science",        emoji: "🤖", slug: "tech" },
  { label: "Finance & Crypto",      emoji: "💰", slug: "finance" },
  { label: "Gaming & Esports",      emoji: "🎮", slug: "gaming" },
  { label: "World Events",          emoji: "🌎", slug: "world" },
  { label: "Pop Culture",           emoji: "🍿", slug: "pop-culture" },
] as const;

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
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{selected.label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden z-50">
          <div className="max-h-80 overflow-y-auto py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors group"
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span
                  className={
                    lang.code === selected.code
                      ? "font-semibold text-foreground flex-1"
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
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const activeCategory = searchParams.get("category");

  const handleCategory = (slug: string) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("category") === slug) {
      params.delete("category");
    } else {
      params.set("category", slug);
    }
    setLocation(`/?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-border">
      {/* Top row */}
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">Hunch</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium hidden sm:flex">
              {t("nav_login")}
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary text-white hover:bg-primary/90 font-semibold rounded-lg px-5 shadow-sm">
              {t("nav_signup")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Category bar */}
      <div className="border-t border-border bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2.5">
            {CATEGORIES.map(({ label, emoji, slug }) => {
              const isActive = activeCategory === slug;
              return (
                <button
                  key={slug}
                  onClick={() => handleCategory(slug)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 shrink-0 ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-[15px] leading-none">{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
