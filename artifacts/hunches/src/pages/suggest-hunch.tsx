import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/apiFetch";
import { Lightbulb, ChevronLeft, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  "Sports",
  "Music & Entertainment",
  "Internet & Creators",
  "Finance & Crypto",
  "Tech & Science",
  "Gaming & Esports",
  "World Events",
  "Pop Culture",
  "Otro",
];

export default function SuggestHunch() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [why, setWhy] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [senderName, setSenderName] = useState(user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "");
  const [senderEmail, setSenderEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("El título es obligatorio."); return; }
    if (!description.trim() || description.trim().length < 10) { setError("La descripción debe tener al menos 10 caracteres."); return; }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/suggest-hunch"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description, why, sourceUrl, senderName, senderEmail }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Algo salió mal. Intenta de nuevo."); return; }
      setSent(true);
    } catch {
      setError("No se pudo enviar. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 max-w-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-3">Sugerencia enviada</h1>
          <p className="text-muted-foreground mb-8">
            Gracias por tu sugerencia. Nuestro equipo la revisara y si encaja con la plataforma, la publicaremos pronto.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground leading-tight">Sugiere un Hunch</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Cuéntanos qué predicción te gustaría ver en la plataforma</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Titulo del Hunch <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: ¿Quién ganará el próximo Grammy al mejor álbum?"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              maxLength={200}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            >
              <option value="">Selecciona una categoría</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Descripción del evento <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el evento o situación sobre la que se haría la predicción. Incluye fechas, participantes o contexto relevante."
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/1000</p>
          </div>

          {/* Why */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              ¿Por qué seria un buen Hunch?
            </label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Explica por qué crees que este evento generaría una buena predicción para la comunidad."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
              maxLength={500}
            />
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Enlace de referencia
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
            <p className="text-xs text-muted-foreground mt-1">Noticia, artículo o fuente que respalde el evento (opcional)</p>
          </div>

          {/* Sender info (only if not logged in) */}
          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Tu nombre</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Nombre"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Tu correo</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? "Enviando..." : "Enviar sugerencia"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
