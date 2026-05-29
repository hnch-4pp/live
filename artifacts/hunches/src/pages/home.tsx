import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { HunchCard } from "@/components/hunch-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListHunches, useGetFeaturedHunches, useGetHunchStats, useListCategories } from "@workspace/api-client-react";
import { TrendingUp, Users, Gift, SlidersHorizontal, Zap, ArrowRight } from "lucide-react";
import { TrendingHero } from "@/components/trending-hero";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language !== "en" ? i18n.language : undefined;
  const [_location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const qParam = searchParams.get("q") || undefined;

  const { data: stats, isLoading: statsLoading } = useGetHunchStats();
  const { data: featuredHunches, isLoading: featuredLoading, refetch: refetchFeatured } = useGetFeaturedHunches({ lang });
  useEffect(() => {
    const id = setInterval(() => { void refetchFeatured(); }, 30_000);
    return () => clearInterval(id);
  }, [refetchFeatured]);
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const { data: hunchesData, isLoading: hunchesLoading } = useListHunches({
    category: categoryParam || undefined,
    status: statusParam as any || undefined,
    q: qParam,
    limit: 20,
    lang,
  });

  const handleCategoryFilter = (slug: string | null) => {
    const params = new URLSearchParams(search);
    if (slug) params.set("category", slug);
    else params.delete("category");
    setLocation(`/?${params.toString()}`);
  };

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(search);
    if (status) params.set("status", status);
    else params.delete("status");
    setLocation(`/?${params.toString()}`);
  };

  const isFiltered = !!(categoryParam || statusParam || qParam);

  return (
    <Layout>
      {/* Trending Hero */}
      {!isFiltered && (
        featuredLoading ? (
          <div className="w-full bg-muted animate-pulse" style={{ height: "clamp(420px, 55vh, 600px)" }} />
        ) : featuredHunches && featuredHunches.length > 0 ? (
          <TrendingHero hunches={featuredHunches} />
        ) : null
      )}

      {/* Main List */}
      <section className="py-12 flex-1">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar */}
            <aside className="hidden md:block md:w-56 shrink-0">
              <div className="bg-card border border-border rounded-2xl p-4 card-shadow sticky top-24">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> {t("filter_all")}
                </h3>
                <div className="space-y-1 mb-5">
                  {[
                    { label: t("filter_all"), value: null },
                    { label: t("filter_open"), value: "open" },
                    { label: t("filter_closed"), value: "closed" },
                    { label: t("filter_resolved"), value: "resolved" },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => handleStatusFilter(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
                        statusParam === value || (!statusParam && value === null)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t("categories")}
                </h3>
                {categoriesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                  </div>
                ) : categories && (
                  <div className="space-y-1">
                    <button
                      onClick={() => handleCategoryFilter(null)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
                        !categoryParam ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{t("all_categories")}</span>
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryFilter(cat.slug)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
                          categoryParam === cat.slug ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {t(`cat_${cat.slug}`, { defaultValue: cat.name })}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">{cat.hunchCount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* Grid */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-foreground">{t("all_hunches")}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t("all_hunches_sub")}</p>
                </div>
              </div>

              {hunchesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[320px] rounded-2xl" />
                  ))}
                </div>
              ) : hunchesData?.hunches && hunchesData.hunches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {hunchesData.hunches.map(hunch => (
                    <HunchCard key={hunch.id} hunch={hunch} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-card border border-border border-dashed rounded-2xl">
                  <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <SlidersHorizontal className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-display font-semibold text-foreground mb-2">{t("no_hunches")}</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{t("no_hunches_desc")}</p>
                  <Button onClick={() => { handleCategoryFilter(null); handleStatusFilter(null); }} variant="outline" className="rounded-lg">
                    {t("clear_filters")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="pl-6 first:pl-0">
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xl font-display font-bold text-foreground">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
  );
}
