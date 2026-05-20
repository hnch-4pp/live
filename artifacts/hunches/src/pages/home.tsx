import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { HunchCard } from "@/components/hunch-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListHunches, useGetFeaturedHunches, useGetHunchStats, useListCategories } from "@workspace/api-client-react";
import { TrendingUp, Users, Gift, Filter, Zap } from "lucide-react";
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
    if (slug) {
      params.set("category", slug);
    } else {
      params.delete("category");
    }
    setLocation(`/?${params.toString()}`);
  };

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    setLocation(`/?${params.toString()}`);
  };

  return (
    <Layout>
      {/* Hero Section */}
      {!categoryParam && !statusParam && (
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium text-sm mb-6">
                <Zap className="w-4 h-4 fill-accent" />
                <span>{t("hero_badge")}</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground tracking-tight mb-6 leading-[1.1]">
                {t("hero_headline_1")} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{t("hero_headline_2")}</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl">
                {t("hero_sub")}
              </p>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 bg-card border border-border rounded-xl" />)
              ) : stats ? (
                <>
                  <StatBox icon={TrendingUp} label={t("stat_active")} value={stats.activeHunches.toLocaleString()} />
                  <StatBox icon={Users} label={t("stat_participants")} value={stats.totalParticipants.toLocaleString()} />
                  <StatBox icon={Gift} label={t("stat_prizes")} value={`$${stats.totalPrizesAwarded.toLocaleString()}`} />
                  <StatBox icon={Zap} label={t("stat_total")} value={stats.totalHunches.toLocaleString()} />
                </>
              ) : null}
            </div>

            {/* Featured */}
            {featuredLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] bg-card border border-border rounded-xl" />
                <Skeleton className="h-[400px] bg-card border border-border rounded-xl" />
              </div>
            ) : featuredHunches && featuredHunches.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                    <TrendingUp className="text-primary w-6 h-6" /> {t("trending_now")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredHunches.map(hunch => (
                    <HunchCard key={hunch.id} hunch={hunch} featured />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main List Section */}
      <section className="py-12 bg-background border-t border-border/40 flex-1">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-display font-bold">{t("all_hunches")}</h2>
              <p className="text-muted-foreground mt-1">{t("all_hunches_sub")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusFilter(null)}
                  className={!statusParam ? "bg-muted text-foreground" : "text-muted-foreground"}
                >
                  {t("filter_all")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusFilter("open")}
                  className={statusParam === "open" ? "bg-muted text-foreground" : "text-muted-foreground"}
                >
                  {t("filter_open")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusFilter("resolved")}
                  className={statusParam === "resolved" ? "bg-muted text-foreground" : "text-muted-foreground"}
                >
                  {t("filter_resolved")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Filters */}
            <aside className="w-full md:w-64 shrink-0 space-y-8">
              <div>
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Filter className="w-4 h-4" /> {t("categories")}
                </h3>
                {categoriesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : categories && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleCategoryFilter(null)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        !categoryParam
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{t("all_categories")}</span>
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryFilter(cat.slug)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                          categoryParam === cat.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          {cat.name}
                        </span>
                        <span className="bg-card border border-border text-xs px-2 py-0.5 rounded-full">
                          {cat.hunchCount}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* List */}
            <div className="flex-1">
              {hunchesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[300px] bg-card border border-border rounded-xl" />
                  ))}
                </div>
              ) : hunchesData?.hunches && hunchesData.hunches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hunchesData.hunches.map(hunch => (
                    <HunchCard key={hunch.id} hunch={hunch} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 bg-card border border-border border-dashed rounded-xl">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Filter className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-display font-semibold text-foreground mb-2">{t("no_hunches")}</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {t("no_hunches_desc")}
                  </p>
                  <Button onClick={() => { handleCategoryFilter(null); handleStatusFilter(null); }} variant="outline">
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

function StatBox({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) {
  return (
    <div className="bg-card border border-border p-5 rounded-xl flex flex-col items-start hover:border-primary/50 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <span className="text-2xl font-display font-bold text-foreground mb-1">{value}</span>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
