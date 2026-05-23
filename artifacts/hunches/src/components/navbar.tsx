import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, Heart, Search, X, Trophy, Music, Film, Clapperboard, TrendingUp, Star, Zap as ZapIcon, Globe2, Heart as HeartIcon, LogOut, Settings, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const ICON_MAP: Record<string, React.ElementType> = {
  "Trophy":       Trophy,
  "Music":        Music,
  "Film":         Film,
  "Clapperboard": Clapperboard,
  "TrendingUp":   TrendingUp,
  "Star":         Star,
  "Zap":          ZapIcon,
  "Globe":        Globe2,
  "Heart":        HeartIcon,
  "trophy":       Trophy,
  "music":        Music,
  "film":         Film,
  "trending-up":  TrendingUp,
  "star":         Star,
  "zap":          ZapIcon,
  "globe":        Globe2,
  "heart":        HeartIcon,
};

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

function AuthButtons() {
  const { t } = useTranslation();
  const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) return <div className="w-20 h-8 bg-muted rounded-lg animate-pulse" />;

  if (user) {
    const navInitials = (user.username ?? user.email).slice(0, 2).toUpperCase();
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm font-medium text-foreground"
        >
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
            {user.avatarUrl ? (
              <img src={`/api/storage${user.avatarUrl}`} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">{navInitials}</span>
            )}
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user.email.split("@")[0]}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
        </button>
        {menuOpen && (
          <div className="absolute top-full mt-2 right-0 w-52 rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-semibold text-foreground truncate">{user.username ? `@${user.username}` : user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Ticket className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{user.tickets} ticket{user.tickets !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); setLocation("/tickets"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Ticket className="w-4 h-4" />
              My tickets
            </button>
            <button
              onClick={() => { setMenuOpen(false); setLocation("/account"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4" />
              Account settings
            </button>
            <button
              onClick={async () => { setMenuOpen(false); await logout(); setLocation("/"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: categories = [] } = useListCategories();

  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const activeCategory = searchParams.get("category");
  const activeQ = searchParams.get("q") ?? "";

  const [searchValue, setSearchValue] = useState(activeQ);
  const [searchOpen, setSearchOpen] = useState(!!activeQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleCategory = (slug: string) => {
    const params = new URLSearchParams(search);
    if (params.get("category") === slug) {
      params.delete("category");
    } else {
      params.set("category", slug);
    }
    setLocation(`/?${params.toString()}`);
  };

  const commitSearch = (value: string) => {
    const params = new URLSearchParams(search);
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    setLocation(`/?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearchValue("");
    const params = new URLSearchParams(search);
    params.delete("q");
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
          <AuthButtons />
        </div>
      </div>

      {/* Category bar */}
      <div className="border-t border-border bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2.5">
            {/* Scrollable pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.slug;
                const Icon = ICON_MAP[cat.icon];
                return (
                  <button
                    key={cat.slug}
                    onClick={() => handleCategory(cat.slug)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 shrink-0 ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Search — always visible */}
            <div className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1 py-1 border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all shrink-0">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSearch(searchValue);
                  if (e.key === "Escape") clearSearch();
                }}
                placeholder="Search hunches..."
                className="bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none w-44"
              />
              {searchValue && (
                <button
                  onClick={clearSearch}
                  className="p-1 rounded-full hover:bg-border transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
