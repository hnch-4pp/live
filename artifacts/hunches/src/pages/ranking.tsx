import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { apiUrl } from "@/lib/apiFetch";
import { Loader2, Trophy, Medal } from "lucide-react";

interface LeaderboardUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  wins: number;
}

interface LeaderboardResponse {
  users: LeaderboardUser[];
  total: number;
  page: number;
  hasMore: boolean;
}

// ── Avatar with error fallback ────────────────────────────────────────────────

function RankAvatar({ username, avatarUrl, size = 40 }: { username: string; avatarUrl: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = username.slice(0, 2).toUpperCase();
  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        onError={() => setErr(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

// ── Medal badge for top 3 ──────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0 shadow-sm">
      <Trophy className="w-4 h-4 text-white" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center shrink-0 shadow-sm">
      <Medal className="w-4 h-4 text-white" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center shrink-0 shadow-sm">
      <Medal className="w-4 h-4 text-white" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-muted-foreground tabular-nums">{rank}</span>
    </div>
  );
}

// ── Top-10 card (highlighted) ─────────────────────────────────────────────────

function TopCard({ user, rank }: { user: LeaderboardUser; rank: number }) {
  const ringColor =
    rank === 1 ? "border-amber-400 shadow-amber-100" :
    rank === 2 ? "border-slate-400 shadow-slate-100" :
    rank === 3 ? "border-amber-700 shadow-amber-100" :
    "border-border";

  return (
    <Link href={`/u/${user.username}`}>
      <div className={`bg-card border-2 ${ringColor} rounded-2xl p-4 flex items-center gap-3 hover:bg-muted/20 transition-colors active:scale-[0.99] card-shadow`}>
        <RankBadge rank={rank} />
        <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={42} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">@{user.username}</p>
          <p className="text-xs text-muted-foreground">{user.wins} win{user.wins !== 1 ? "s" : ""}</p>
        </div>
        {rank <= 3 && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums" style={{
              color: rank === 1 ? "#d97706" : rank === 2 ? "#94a3b8" : "#92400e"
            }}>
              {user.wins}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">wins</p>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Regular row ───────────────────────────────────────────────────────────────

function RankRow({ user, rank }: { user: LeaderboardUser; rank: number }) {
  return (
    <Link href={`/u/${user.username}`}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors active:scale-[0.99]">
        <span className="w-8 text-center text-xs font-bold text-muted-foreground tabular-nums shrink-0">{rank}</span>
        <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">@{user.username}</p>
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{user.wins}</span>
        <span className="text-xs text-muted-foreground shrink-0">win{user.wins !== 1 ? "s" : ""}</span>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function RankingPage() {
  const [top10, setTop10] = useState<LeaderboardUser[]>([]);
  const [rest, setRest]   = useState<LeaderboardUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page,  setPage]  = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Intersection observer sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial load: first page of 50 (top 10 + first 40 of rest)
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/leaderboard?page=1&limit=${PAGE_SIZE}`))
      .then((r) => r.json() as Promise<LeaderboardResponse>)
      .then((d) => {
        setTop10(d.users.slice(0, 10));
        setRest(d.users.slice(10));
        setTotal(d.total);
        setHasMore(d.hasMore);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    fetch(apiUrl(`/api/leaderboard?page=${nextPage}&limit=${PAGE_SIZE}`))
      .then((r) => r.json() as Promise<LeaderboardResponse>)
      .then((d) => {
        setRest((prev) => [...prev, ...d.users]);
        setHasMore(d.hasMore);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, page]);

  // Auto-load when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground leading-tight">Ranking</h1>
            {!loading && total > 0 && (
              <p className="text-xs text-muted-foreground">{total} jugadores con victorias</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : top10.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aún no hay victorias registradas.</p>
          </div>
        ) : (
          <>
            {/* ── Top 10 ── */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top 10</p>
              <div className="flex flex-col gap-3">
                {top10.map((u, i) => (
                  <TopCard key={u.id} user={u} rank={i + 1} />
                ))}
              </div>
            </div>

            {/* ── Rest ── */}
            {rest.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden card-shadow">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Todos los jugadores</p>
                  <p className="text-xs text-muted-foreground">{total} total</p>
                </div>
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                  <span className="w-8 text-center text-[10px] font-semibold text-muted-foreground uppercase">#</span>
                  <span className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase ml-10">Usuario</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Victorias</span>
                </div>
                <div className="divide-y divide-border">
                  {rest.map((u, i) => (
                    <RankRow key={u.id} user={u} rank={top10.length + i + 1} />
                  ))}
                </div>

                {/* Sentinel + loading indicator */}
                <div ref={sentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex justify-center py-4 border-t border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!hasMore && rest.length > 0 && (
                  <div className="px-4 py-3 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">Todos los jugadores cargados</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
