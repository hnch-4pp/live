import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, Search, X, Trophy, Music, Film, Clapperboard, TrendingUp, Star, Zap as ZapIcon, Globe2, Heart as HeartIcon, LogOut, Settings, Ticket, Target } from "lucide-react";
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
  { code: "es", label: "Español", flag: "🇪🇸" },
];

function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    () => LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0],
  );
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

function TicketCounter() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  return (
    <button
      onClick={() => setLocation("/tickets")}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-violet-500 text-white shadow-md shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 font-semibold text-sm select-none"
      title="My tickets"
    >
      <Ticket className="w-3.5 h-3.5 shrink-0" />
      <span className="tabular-nums">{user.tickets}</span>
      {/* Subtle shimmer pulse */}
      <span className="absolute inset-0 rounded-full bg-white/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity" />
    </button>
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
              <p className="text-xs text-muted-foreground">{t("signed_in_as")}</p>
              <p className="text-sm font-semibold text-foreground truncate">{user.username ? `@${user.username}` : user.email}</p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); setLocation("/tickets"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Ticket className="w-4 h-4" />
              {t("my_tickets")}
            </button>
            <button
              onClick={() => { setMenuOpen(false); setLocation("/my-hunches"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Target className="w-4 h-4" />
              {t("my_hunches")}
            </button>
            <button
              onClick={() => { setMenuOpen(false); setLocation("/account"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4" />
              {t("account_settings")}
            </button>
            <button
              onClick={async () => { setMenuOpen(false); await logout(); setLocation("/"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border"
            >
              <LogOut className="w-4 h-4" />
              {t("sign_out")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Link href="/login">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium px-2 sm:px-3">
          {t("nav_login")}
        </Button>
      </Link>
      <Link href="/signup">
        <Button size="sm" className="bg-primary text-white hover:bg-primary/90 font-semibold rounded-lg px-3 sm:px-5 shadow-sm">
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
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileCatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileCatOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileCatRef.current && !mobileCatRef.current.contains(e.target as Node)) {
        setMobileCatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileCatOpen]);

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
        <Link href="/" className="flex items-center shrink-0">
          <img src="/hunch-logo.png" alt="Hunch" className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <TicketCounter />
          <AuthButtons />
        </div>
      </div>

      {/* Category bar */}
      <div className="border-t border-border bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2.5">

            {/* ── Mobile: categories dropdown ── */}
            <div className="relative md:hidden shrink-0" ref={mobileCatRef}>
              <button
                onClick={() => setMobileCatOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                  activeCategory
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>
                  {activeCategory
                    ? (categories.find((c) => c.slug === activeCategory)?.name ?? "Categories")
                    : "Categories"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${mobileCatOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileCatOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(search);
                      params.delete("category");
                      setLocation(`/?${params.toString()}`);
                      setMobileCatOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                      !activeCategory ? "text-primary bg-primary/8" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {t("all_categories")}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => { handleCategory(cat.slug); setMobileCatOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                        activeCategory === cat.slug
                          ? "text-primary bg-primary/8"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Desktop: scrollable pills ── */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.slug;
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
            <div className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1 py-1 border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all flex-1 md:flex-none md:shrink-0">
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
                placeholder={t("search_placeholder")}
                className="bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none w-full md:w-44"
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
