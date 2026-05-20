import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { HunchCard } from "@/components/hunch-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListHunches, useGetFeaturedHunches, useGetHunchStats, useListCategories } from "@workspace/api-client-react";
import { TrendingUp, Users, Gift, SlidersHorizontal, Zap, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();
  const [_location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");

  const { data: stats, isLoading: statsLoading } = useGetHunchStats();
  const { data: featuredHunches, isLoading: featuredLoading } = useGetFeaturedHunches();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const { data: hunchesData, isLoading: hunchesLoading } = useListHunches({
    category: categoryParam || undefined,
    status: statusParam as any || undefined,
    limit: 20
  });

  const handleCategoryFilter = (slug: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (slug) params.set("category", slug);
    else params.delete("category");
    setLocation(`/?${params.toString()}`);
  };

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (status) params.set("status", status);
    else params.delete("status");
    setLocation(`/?${params.toString()}`);
  };

  const isFiltered = !!(categoryParam || statusParam);

  return (
    <Layout>
      {/* Hero */}
      {!isFiltered && (
        <section className="bg-white border-b border-border">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-xs mb-6 tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5" />
                <span>{t("hero_badge")}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-display font-bold text-foreground leading-[1.08] tracking-tight mb-5">
                {t("hero_headline_1")}<br />
                <span className="text-primary">{t("hero_headline_2")}</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                {t("hero_sub")}
              </p>
              <div className="flex items-center gap-3">
                <Button size="lg" className="bg-primary text-white font-semibold rounded-xl px-7 shadow-sm hover:bg-primary/90">
                  {t("nav_signup")} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl px-7 font-semibold border-border text-foreground hover:bg-muted">
                  {t("all_hunches")}
                </Button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="border-t border-border bg-muted/30">
            <div className="container mx-auto px-4 py-5">
              {statsLoading ? (
                <div className="flex gap-8">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-32" />)}
                </div>
              ) : stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-border">
                  <StatItem icon={TrendingUp} label={t("stat_active")} value={stats.activeHunches.toLocaleString()} />
                  <StatItem icon={Users} label={t("stat_participants")} value={stats.totalParticipants.toLocaleString()} />
                  <StatItem icon={Gift} label={t("stat_prizes")} value={`$${stats.totalPrizesAwarded.toLocaleString()}`} />
                  <StatItem icon={Zap} label={t("stat_total")} value={stats.totalHunches.toLocaleString()} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured */}
      {!isFiltered && (
        <section className="py-12 bg-white border-b border-border">
          <div className="container mx-auto px-4">
            {featuredLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-[360px] rounded-2xl" />
                <Skeleton className="h-[360px] rounded-2xl" />
              </div>
            ) : featuredHunches && featuredHunches.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-7">
                  <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t("trending_now")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredHunches.map(hunch => (
                    <HunchCard key={hunch.id} hunch={hunch} featured />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Main List */}
      <section className="py-12 flex-1">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar */}
            <aside className="w-full md:w-56 shrink-0">
              <div className="bg-card border border-border rounded-2xl p-4 card-shadow sticky top-24">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> {t("filter_all")}
                </h3>
                <div className="space-y-1 mb-5">
                  {[
                    { label: t("filter_all"), value: null },
                    { label: t("filter_open"), value: "open" },
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
                          <span className="text-base">{cat.icon}</span>
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
