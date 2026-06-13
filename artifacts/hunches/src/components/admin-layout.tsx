import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/apiFetch";
import { LayoutDashboard, ListChecks, Tag, Users, LogOut, ChevronRight, Ticket, Sparkles, Bell, BarChart2, BellRing, Link2, Award, TrendingUp, MessageSquare } from "lucide-react";

const NAV = [
  { href: "/backstage/dashboard",         label: "Dashboard",        icon: LayoutDashboard },
  { href: "/backstage/hunches",           label: "Hunches",          icon: ListChecks },
  { href: "/backstage/hero",              label: "Hero Order",       icon: Sparkles, sub: true },
  { href: "/backstage/categories",        label: "Categories",       icon: Tag },
  { href: "/backstage/trending",          label: "Trending",         icon: TrendingUp },
  { href: "/backstage/users",             label: "Users",            icon: Users },
  { href: "/backstage/ticket-codes",      label: "Ticket Codes",     icon: Ticket },
  { href: "/backstage/notifications",     label: "Notifications",    icon: Bell },
  { href: "/backstage/admin-alerts",      label: "Admin Alerts",     icon: BellRing },
  { href: "/backstage/metrics",           label: "Metrics",          icon: BarChart2 },
  { href: "/backstage/affiliates",        label: "Affiliates",       icon: Link2 },
  { href: "/backstage/affiliate-tiers",   label: "Comm. Tiers",      icon: Award, sub: true },
  { href: "/backstage/comments",          label: "Comments",         icon: MessageSquare },
];

async function logout() {
  await fetch(apiUrl("/api/admin/logout"), {
    method: "POST",
    headers: { "X-Admin-Request": "1" },
    credentials: "include",
  });
  window.location.href = "/backstage/login";
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    fetch(apiUrl("/api/admin/me"), {
      credentials: "include",
      headers: { "X-Admin-Request": "1" },
    }).then((res) => {
      if (res.status === 401) {
        window.location.href = "/backstage/login";
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-gray-200 gap-2">
          <img src="/hunch-logo.png" alt="Hunch" className="h-6 w-auto" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Admin</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, sub }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
                  sub ? "pl-7 pr-3 py-1.5" : "px-3 py-2"
                } ${
                  active
                    ? "bg-violet-50 text-violet-700"
                    : sub
                    ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className={`shrink-0 ${sub ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
                {label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {t("sign_out")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
