import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth, adminFetch } from "./dashboard";
import { Search, X, Trash2, User, Calendar, Phone, MapPin, Mail, ShieldAlert, Ban } from "lucide-react";

type UserStatus = "active" | "suspended" | "banned";

interface AdminUser {
  id: number;
  email: string;
  phone: string | null;
  status: UserStatus;
  createdAt: string;
}

interface AdminUserDetail extends AdminUser {
  address: string | null;
  dateOfBirth: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

type ModAction = "suspend" | "ban" | "reactivate";

const STATUS_BADGE: Record<UserStatus, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  suspended: { label: "Suspended", className: "bg-yellow-100 text-yellow-700" },
  banned:    { label: "Banned",    className: "bg-red-100 text-red-700" },
};

export default function AdminUsers() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modAction, setModAction] = useState<{ id: number; action: ModAction } | null>(null);
  const [modding, setModding] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useAdminAuth();

  const load = (q: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    adminFetch(`/admin/users?${params}`)
      .then((r) => r.json() as Promise<UsersResponse>)
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => {
    load(search, page);
  }, [page]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(val, 1), 300);
  };

  const openDetail = async (id: number) => {
    const r = await adminFetch(`/admin/users/${id}`);
    const user = await r.json() as AdminUserDetail;
    setSelected(user);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await adminFetch(`/admin/users/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);
    setSelected(null);
    load(search, page);
  };

  const handleMod = async () => {
    if (!modAction) return;
    setModding(true);
    const statusMap: Record<ModAction, UserStatus> = {
      suspend: "suspended",
      ban: "banned",
      reactivate: "active",
    };
    const r = await adminFetch(`/admin/users/${modAction.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusMap[modAction.action] }),
    });
    if (r.ok) {
      const updated = await r.json() as AdminUserDetail;
      setSelected(updated);
      load(search, page);
    }
    setModding(false);
    setModAction(null);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const modLabels: Record<ModAction, { title: string; desc: string; confirmLabel: string; confirmClass: string }> = {
    suspend: {
      title: "Suspend this user?",
      desc: "The user will not be able to log in until reactivated. Their account and data are preserved.",
      confirmLabel: "Suspend",
      confirmClass: "bg-yellow-500 hover:bg-yellow-600 text-white",
    },
    ban: {
      title: "Permanently ban this user?",
      desc: "The user will be blocked from logging in indefinitely. Their account and data are preserved.",
      confirmLabel: "Ban",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    },
    reactivate: {
      title: "Reactivate this user?",
      desc: "The user will be able to log in again.",
      confirmLabel: "Reactivate",
      confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    },
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            {data && (
              <p className="text-sm text-gray-500 mt-0.5">
                {data.total.toLocaleString()} registered {data.total === 1 ? "user" : "users"}
              </p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by email or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">ID</th>
                <th className="px-5 py-3 text-left font-semibold">Email</th>
                <th className="px-5 py-3 text-left font-semibold">Phone</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.users.map((u) => {
                const badge = STATUS_BADGE[u.status] ?? STATUS_BADGE.active;
                return (
                  <tr
                    key={u.id}
                    onClick={() => openDetail(u.id)}
                    className="hover:bg-violet-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{u.id}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{u.email}</td>
                    <td className="px-5 py-3 text-gray-600">{u.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {data?.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                    {search ? "No users match your search" : "No users yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                  <User className="w-4.5 h-4.5 text-violet-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{selected.email}</p>
                    {(() => {
                      const badge = STATUS_BADGE[selected.status] ?? STATUS_BADGE.active;
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-400">User #{selected.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Field icon={Mail} label="Email" value={selected.email} />
              <Field icon={Phone} label="Phone" value={selected.phone ?? "Not provided"} muted={!selected.phone} />
              <Field icon={MapPin} label="Address" value={selected.address ?? "Not provided"} muted={!selected.address} />
              <Field
                icon={Calendar}
                label="Date of birth"
                value={selected.dateOfBirth
                  ? new Date(selected.dateOfBirth + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                  : "Not provided"}
                muted={!selected.dateOfBirth}
              />
              <Field
                icon={Calendar}
                label="Joined"
                value={new Date(selected.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 space-y-2">
              {/* Moderation actions */}
              <div className="flex gap-2">
                {selected.status !== "suspended" && selected.status !== "banned" && (
                  <button
                    onClick={() => setModAction({ id: selected.id, action: "suspend" })}
                    className="flex-1 flex items-center justify-center gap-2 border border-yellow-200 text-yellow-700 hover:bg-yellow-50 font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Suspend
                  </button>
                )}
                {selected.status !== "banned" && (
                  <button
                    onClick={() => setModAction({ id: selected.id, action: "ban" })}
                    className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Ban
                  </button>
                )}
                {(selected.status === "suspended" || selected.status === "banned") && (
                  <button
                    onClick={() => setModAction({ id: selected.id, action: "reactivate" })}
                    className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-700 hover:bg-green-50 font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Reactivate
                  </button>
                )}
              </div>
              {/* Delete */}
              <button
                onClick={() => setDeleteId(selected.id)}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation confirm */}
      {modAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modAction.action === "suspend" ? "bg-yellow-100" :
              modAction.action === "ban" ? "bg-red-100" : "bg-green-100"
            }`}>
              {modAction.action === "suspend" && <ShieldAlert className="w-5 h-5 text-yellow-600" />}
              {modAction.action === "ban" && <Ban className="w-5 h-5 text-red-600" />}
              {modAction.action === "reactivate" && <User className="w-5 h-5 text-green-600" />}
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{modLabels[modAction.action].title}</h3>
            <p className="text-sm text-gray-500 mb-5">{modLabels[modAction.action].desc}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setModAction(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMod}
                disabled={modding}
                className={`flex-1 font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60 ${modLabels[modAction.action].confirmClass}`}
              >
                {modding ? "Saving..." : modLabels[modAction.action].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Delete this account?</h3>
            <p className="text-sm text-gray-500 mb-5">
              The user's account will be permanently removed. Their past predictions will remain in the system. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
        <p className={`text-sm ${muted ? "text-gray-400 italic" : "text-gray-900"}`}>{value}</p>
      </div>
    </div>
  );
}
