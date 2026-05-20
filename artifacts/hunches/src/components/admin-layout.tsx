import { Link, useLocation } from "wouter";
import { LayoutDashboard, ListChecks, Tag, LogOut, ChevronRight } from "lucide-react";

const NAV = [
  { href: "/backstage/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/backstage/hunches",     label: "Hunches",    icon: ListChecks },
  { href: "/backstage/categories",  label: "Categories", icon: Tag },
];

async function logout() {
  await fetch("/api/admin/logout", {
    method: "POST",
    headers: { "X-Admin-Request": "1" },
    credentials: "include",
  });
  window.location.href = "/backstage/login";
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <span className="font-bold text-sm text-gray-900 tracking-tight">Hunch Admin</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
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
            Sign out
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
