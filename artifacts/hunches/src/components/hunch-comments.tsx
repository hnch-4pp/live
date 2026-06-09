import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { MessageSquare, Heart, Bookmark, CornerDownRight, Trash2, Loader2, Send, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiFetch";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommentData {
  id: number;
  hunchId: number;
  parentId: number | null;
  body: string | null;
  isDeleted: boolean;
  isHidden: boolean;
  createdAt: string;
  author: { username: string | null; avatarUrl: string | null } | null;
  isOwn: boolean;
  likeCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
}

interface Props {
  hunchSlug: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(date).toLocaleDateString("es-MX", { month: "short", day: "numeric" });
}

function AuthorAvatar({ username, avatarUrl, size = 32 }: { username: string | null; avatarUrl: string | null; size?: number }) {
  const initials = (username ?? "?").slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return <img src={avatarUrl} alt={username ?? ""} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center bg-violet-100 text-violet-700 font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ── Comment compose box ────────────────────────────────────────────────────────

function ComposeBox({
  placeholder,
  onSubmit,
  onCancel,
  autoFocus = false,
}: {
  placeholder?: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
        placeholder={placeholder ?? "Escribe un comentario…"}
        rows={3}
        maxLength={1000}
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-colors"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{body.length}/1000 · Cmd+Enter para enviar</span>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              Cancelar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!body.trim() || submitting}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single comment ─────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  onLike,
  onBookmark,
  onDelete,
  onReply,
  depth = 0,
}: {
  comment: CommentData & { replies?: CommentData[] };
  onLike: (id: number) => void;
  onBookmark: (id: number) => void;
  onDelete: (id: number) => void;
  onReply: (parentId: number, body: string) => Promise<void>;
  depth?: number;
}) {
  const [replyOpen, setReplyOpen] = useState(false);

  if (comment.isDeleted) {
    return (
      <div className="text-xs text-muted-foreground/50 italic py-1 pl-1">
        [eliminado]
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 ml-6 space-y-3">
            {comment.replies.map((r) => (
              <CommentRow key={r.id} comment={r} onLike={onLike} onBookmark={onBookmark} onDelete={onDelete} onReply={onReply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (comment.isHidden) {
    return null;
  }

  return (
    <div className={depth > 0 ? "pl-4 border-l-2 border-border" : ""}>
      <div className="flex gap-3">
        <AuthorAvatar username={comment.author?.username ?? null} avatarUrl={comment.author?.avatarUrl ?? null} size={30} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {comment.author?.username ? (
              <Link href={`/u/${comment.author.username}`} className="text-xs font-bold text-foreground hover:text-primary hover:underline">
                @{comment.author.username}
              </Link>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">anónimo</span>
            )}
            <span className="text-xs text-muted-foreground">{relativeTime(comment.createdAt)}</span>
          </div>

          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{comment.body}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => onLike(comment.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${comment.likedByMe ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
            >
              <Heart className={`w-3.5 h-3.5 ${comment.likedByMe ? "fill-current" : ""}`} />
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>

            <button
              onClick={() => onBookmark(comment.id)}
              className={`transition-colors ${comment.bookmarkedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              title="Guardar"
            >
              <Bookmark className={`w-3.5 h-3.5 ${comment.bookmarkedByMe ? "fill-current" : ""}`} />
            </button>

            {depth === 0 && (
              <button
                onClick={() => setReplyOpen((o) => !o)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <CornerDownRight className="w-3 h-3" />
                Responder
              </button>
            )}

            {comment.isOwn && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reply box */}
          {replyOpen && (
            <div className="mt-3">
              <ComposeBox
                placeholder="Escribe una respuesta…"
                autoFocus
                onCancel={() => setReplyOpen(false)}
                onSubmit={async (body) => {
                  await onReply(comment.id, body);
                  setReplyOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-9 space-y-3">
          {comment.replies.map((r) => (
            <CommentRow key={r.id} comment={r} onLike={onLike} onBookmark={onBookmark} onDelete={onDelete} onReply={onReply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main comments component ────────────────────────────────────────────────────

export function HunchComments({ hunchSlug }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/hunches/${hunchSlug}/comments`), { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[HunchComments] GET failed", res.status, text.slice(0, 200));
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as { comments: CommentData[] };
      setComments(data.comments ?? []);
    } catch (err) {
      console.error("[HunchComments] load error", err);
      setError("No se pudieron cargar los comentarios.");
    } finally {
      setLoading(false);
    }
  }, [hunchSlug]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  async function postComment(body: string, parentId?: number) {
    if (!user) return;
    const res = await fetch(apiUrl(`/api/hunches/${hunchSlug}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body, parentId }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as { error?: string };
      const msg = errData.error ?? `Error ${res.status}`;
      toast({ title: "No se pudo publicar el comentario", description: msg, variant: "destructive" });
      throw new Error(msg);
    }
    const newComment = await res.json() as CommentData;
    setComments((prev) => [...prev, newComment]);
  }

  async function toggleLike(id: number) {
    if (!user) return;
    const res = await fetch(apiUrl(`/api/comments/${id}/like`), { method: "POST", credentials: "include" });
    if (!res.ok) return;
    const { liked } = await res.json() as { liked: boolean };
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, likedByMe: liked, likeCount: liked ? c.likeCount + 1 : c.likeCount - 1 }
          : c
      )
    );
  }

  async function toggleBookmark(id: number) {
    if (!user) return;
    const res = await fetch(apiUrl(`/api/comments/${id}/bookmark`), { method: "POST", credentials: "include" });
    if (!res.ok) return;
    const { bookmarked } = await res.json() as { bookmarked: boolean };
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, bookmarkedByMe: bookmarked } : c))
    );
  }

  async function deleteComment(id: number) {
    if (!user) return;
    if (!confirm("¿Eliminar este comentario?")) return;
    const res = await fetch(apiUrl(`/api/comments/${id}`), { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleted: true, body: null } : c)));
  }

  // Build comment tree
  const roots: Array<CommentData & { replies: CommentData[] }> = [];
  const childMap = new Map<number, CommentData[]>();

  for (const c of comments) {
    if (c.parentId) {
      const arr = childMap.get(c.parentId) ?? [];
      arr.push(c);
      childMap.set(c.parentId, arr);
    }
  }
  for (const c of comments) {
    if (!c.parentId) {
      roots.push({ ...c, replies: childMap.get(c.id) ?? [] });
    }
  }

  const visibleCount = comments.filter((c) => !c.isDeleted && !c.isHidden).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="text-base font-display font-bold text-foreground">
          Comunidad {visibleCount > 0 ? `(${visibleCount})` : ""}
        </h3>
      </div>

      {/* Compose — top level */}
      {user ? (
        <div className="mb-6">
          <ComposeBox onSubmit={(body) => postComment(body)} />
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">Inicia sesión</Link> o{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">regístrate</Link> para unirte a la conversación.
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => { void fetchComments(); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Intentar de nuevo
          </button>
        </div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aun no hay comentarios. Se el primero en compartir tu opinion.</p>
      ) : (
        <div className="space-y-5">
          {roots.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onLike={toggleLike}
              onBookmark={toggleBookmark}
              onDelete={deleteComment}
              onReply={(parentId, body) => postComment(body, parentId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
