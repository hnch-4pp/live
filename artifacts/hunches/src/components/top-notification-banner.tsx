import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiFetch";
import { X, Info, AlertTriangle, CheckCircle2, Sparkles, ExternalLink } from "lucide-react";

interface TopNotification {
  id: number;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  type: string;
  isActive: boolean;
  expiresAt: string | null;
}

const TYPE_STYLES: Record<string, { bar: string; icon: string; link: string; dismiss: string }> = {
  info:    { bar: "bg-sky-600 text-white",     icon: "text-white/80",  link: "underline font-semibold hover:text-white/80",    dismiss: "hover:bg-sky-700" },
  warning: { bar: "bg-amber-500 text-white",   icon: "text-white/80",  link: "underline font-semibold hover:text-white/80",    dismiss: "hover:bg-amber-600" },
  success: { bar: "bg-emerald-600 text-white", icon: "text-white/80",  link: "underline font-semibold hover:text-white/80",    dismiss: "hover:bg-emerald-700" },
  promo:   { bar: "bg-primary text-white",     icon: "text-white/80",  link: "underline font-semibold hover:text-white/80",    dismiss: "hover:bg-primary/90" },
};

function TypeIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 shrink-0";
  switch (type) {
    case "warning": return <AlertTriangle className={cls} />;
    case "success": return <CheckCircle2 className={cls} />;
    case "promo":   return <Sparkles className={cls} />;
    default:        return <Info className={cls} />;
  }
}

export function TopNotificationBanner() {
  const [notification, setNotification] = useState<TopNotification | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/notifications/active"));
        if (!res.ok) return;
        const data = await res.json() as { notification: TopNotification | null };
        if (!data.notification) { setNotification(null); return; }
        const key = `notif-dismissed-${data.notification.id}`;
        if (sessionStorage.getItem(key)) { setNotification(null); return; }
        setNotification(data.notification);
      } catch {
        // silent fail — banner is non-critical
      }
    }

    void load();
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!notification) return null;

  const styles = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info;

  const handleDismiss = () => {
    sessionStorage.setItem(`notif-dismissed-${notification.id}`, "1");
    setNotification(null);
  };

  return (
    <div className={`w-full py-2 px-4 ${styles.bar} flex items-center justify-center gap-3 text-sm relative`}>
      <span className={styles.icon}>
        <TypeIcon type={notification.type} />
      </span>

      <p className="text-center leading-snug">
        {notification.message}
        {notification.linkUrl && (
          <>
            {" "}
            <a
              href={notification.linkUrl}
              target={notification.linkUrl.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-0.5 ${styles.link}`}
            >
              {notification.linkLabel ?? "Learn more"}
              {notification.linkUrl.startsWith("http") && <ExternalLink className="w-3 h-3" />}
            </a>
          </>
        )}
      </p>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className={`absolute right-3 p-1 rounded transition-colors ${styles.dismiss}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
