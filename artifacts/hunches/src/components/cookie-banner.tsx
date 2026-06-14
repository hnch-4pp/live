import { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { apiUrl } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/use-auth";

const LS_KEY = "hunch_cookie_consent";

function loadGtm() {
  if (typeof window === "undefined") return;
  if (document.getElementById("gtm-script")) return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "gtm-script";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-5KNZC4SB";
  document.head.appendChild(script);
  const ns = document.createElement("noscript");
  ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5KNZC4SB" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.prepend(ns);
}

export function CookieBanner() {
  const { user, refetch } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "accepted") { loadGtm(); return; }
    if (stored === "rejected") return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (user?.cookieConsent === "accepted") {
      localStorage.setItem(LS_KEY, "accepted");
      loadGtm();
      setVisible(false);
    } else if (user?.cookieConsent === "rejected") {
      localStorage.setItem(LS_KEY, "rejected");
      setVisible(false);
    }
  }, [user?.cookieConsent]);

  async function saveConsent(consent: "accepted" | "rejected") {
    localStorage.setItem(LS_KEY, consent);
    if (consent === "accepted") loadGtm();
    setVisible(false);
    if (user) {
      try {
        await fetch(apiUrl("/api/auth/me/cookie-consent"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent }),
        });
        await refetch();
      } catch {
        // non-critical
      }
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-2rem)] sm:max-w-2xl">
      <div className="bg-card border-t border-border sm:border sm:rounded-2xl shadow-2xl px-5 py-4">
        {/* Top row: icon + text */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
            <Cookie className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              Una mejor experiencia empieza con las cookies
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Usamos cookies de sesión y Google Analytics para mejorar la plataforma.{" "}
              <a href="/privacy" className="underline hover:text-foreground transition-colors">
                Ver política de privacidad
              </a>
            </p>
          </div>
        </div>
        {/* Buttons: stacked full-width on mobile, inline on sm+ */}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:mt-3">
          <button
            onClick={() => saveConsent("rejected")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={() => saveConsent("accepted")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
