import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { ListChecks, Users, BarChart2 } from "lucide-react";

interface AdminHunch {
  id: number;
  title: string;
  status: string;
  featured: boolean;
  participantCount: number;
  endsAt: string;
}

function adminFetch(path: string, opts?: RequestInit) {
  return fetch(`/api${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "X-Admin-Request": "1",
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
}

export function useAdminAuth() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((r) => r.json() as Promise<{ authenticated: boolean }>)
      .then((d) => { if (!d.authenticated) setLocation("/backstage/login"); })
      .catch(() => setLocation("/backstage/login"));
  }, [setLocation]);
}

export { adminFetch };

export default function AdminDashboard() {
  const [hunches, setHunches] = useState<AdminHunch[]>([]);

  useAdminAuth();

  useEffect(() => {
    adminFetch("/admin/hunches")
      .then((r) => r.json() as Promise<AdminHunch[]>)
      .then(setHunches)
      .catch(() => {});
  }, []);

  const open = hunches.filter((h) => h.status === "open").length;
  const resolved = hunches.filter((h) => h.status === "resolved").length;
  const totalParticipants = hunches.reduce((s, h) => s + (h.participantCount ?? 0), 0);

  return (
    <AdminLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={ListChecks} label="Total hunches" value={hunches.length} color="violet" />
          <StatCard icon={BarChart2} label="Open" value={open} color="green" />
          <StatCard icon={Users} label="Total predictions" value={totalParticipants.toLocaleString()} color="blue" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent hunches</h2>
            <a href="/backstage/hunches" className="text-sm text-violet-600 hover:underline font-medium">View all</a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-semibold">Title</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Predictions</th>
                <th className="px-6 py-3 text-left font-semibold">Ends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hunches.slice(0, 8).map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900 max-w-xs truncate">{h.title}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-6 py-3 text-gray-600">{h.participantCount?.toLocaleString()}</td>
                  <td className="px-6 py-3 text-gray-500">{new Date(h.endsAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    open: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-yellow-50 text-yellow-700 border-yellow-200",
    resolved: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[status] ?? cls["closed"]}`}>
      {status}
    </span>
  );
}
