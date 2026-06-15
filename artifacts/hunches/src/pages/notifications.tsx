import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiFetch";
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface UserNotification {
  id: number;
  userId: number;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const { data: notifications = [], isLoading } = useQuery<UserNotification[]>({
    queryKey: ["user-notifications"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/notifications/me"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<UserNotification[]>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const readAll = useMutation({
    mutationFn: async () => {
      await fetch(apiUrl("/api/notifications/me/read-all"), { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const readOne = useMutation({
    mutationFn: async (id: number) => {
      await fetch(apiUrl(`/api/notifications/me/${id}/read`), { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Notificaciones</h1>
              {!isLoading && unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} sin leer</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => readAll.mutate()}
              disabled={readAll.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Sin notificaciones</p>
            <p className="text-xs text-muted-foreground">Aquí aparecerán tus notificaciones.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              const inner = (
                <div
                  onClick={() => { if (isUnread) readOne.mutate(n.id); }}
                  className={`flex gap-4 p-4 rounded-2xl border transition-colors cursor-pointer ${
                    isUnread
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-card border-border hover:bg-muted/30"
                  }`}
                >
                  {/* Unread dot */}
                  <div className="pt-1.5 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${isUnread ? "bg-primary" : "bg-transparent"}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {n.link && (
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              );

              return n.link ? (
                <Link key={n.id} href={n.link}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
