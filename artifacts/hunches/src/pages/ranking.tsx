import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { apiUrl } from "@/lib/apiFetch";
import { Loader2, Trophy } from "lucide-react";

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

// ── Avatar with fallback ──────────────────────────────────────────────────────

function RankAvatar({ username, avatarUrl, size = 48 }: { username: string; avatarUrl: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = username.slice(0, 2).toUpperCase();
  const src = avatarUrl
    ? avatarUrl.startsWith("http") ? avatarUrl : `/api/storage${avatarUrl}`
    : null;
  if (src && !err) {
    return (
      <img
        src={src}
        alt={username}
        onError={() => setErr(true)}
        className="rounded-full object-cover shrink-0 ring-2 ring-white/60"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/15 flex items-center justify-center shrink-0 font-black text-primary ring-2 ring-white/60"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}

// ── Podium for top 3 ─────────────────────────────────────────────────────────

const PODIUM_CONFIG = {
  1: { order: 2, barH: "h-36", barBg: "bg-amber-400", numColor: "text-amber-200", avatarSize: 72, crown: true },
  2: { order: 1, barH: "h-24", barBg: "bg-slate-300", numColor: "text-slate-200", avatarSize: 60, crown: false },
  3: { order: 3, barH: "h-16", barBg: "bg-amber-600", numColor: "text-amber-400", avatarSize: 56, crown: false },
} as const;

function PodiumColumn({ user, rank }: { user: LeaderboardUser; rank: 1 | 2 | 3 }) {
  const cfg = PODIUM_CONFIG[rank];
  return (
    <Link href={`/u/${user.username}`}>
      <div className="flex flex-col items-center gap-1.5 cursor-pointer group" style={{ order: cfg.order }}>
        {cfg.crown && <span className="text-3xl mb-0.5 drop-shadow">👑</span>}
        <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={cfg.avatarSize} />
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[90px] text-center mt-1">
          @{user.username}
        </p>
        <p className="text-xs text-muted-foreground">
          {user.wins} {user.wins === 1 ? "victoria" : "victorias"}
        </p>
        <div className={`w-28 sm:w-36 ${cfg.barH} ${cfg.barBg} rounded-t-2xl flex flex-col items-center justify-center gap-1 shadow-md`}>
          <Trophy className="w-5 h-5 text-white/50" />
          <span className={`text-4xl font-black ${cfg.numColor}`}>{rank}</span>
        </div>
      </div>
    </Link>
  );
}

function Podium({ top3 }: { top3: LeaderboardUser[] }) {
  const [first, second, third] = top3;
  return (
    <div className="flex items-end justify-center gap-4 sm:gap-6">
      {second && <PodiumColumn user={second} rank={2} />}
      {first  && <PodiumColumn user={first}  rank={1} />}
      {third  && <PodiumColumn user={third}  rank={3} />}
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({ user, rank }: { user: LeaderboardUser; rank: number }) {
  return (
    <Link href={`/u/${user.username}`}>
      <tr className="hover:bg-muted/40 transition-colors cursor-pointer group">
        <td className="pl-5 pr-2 py-3.5 w-10">
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{rank}</span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-3">
            <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={36} />
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                @{user.username}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {user.wins} {user.wins === 1 ? "victoria" : "victorias"}
              </span>
            </div>
          </div>
        </td>
        <td className="pl-3 pr-5 py-3.5 text-right">
          <span className="text-sm font-bold tabular-nums text-foreground">{user.wins}</span>
        </td>
      </tr>
    </Link>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function RankingPage() {
  const [users, setUsers]     = useState<LeaderboardUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/leaderboard?page=1&limit=${PAGE_SIZE}`))
      .then((r) => r.json() as Promise<LeaderboardResponse>)
      .then((d) => {
        setUsers(d.users);
        setTotal(d.total);
        setHasMore(d.hasMore);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    fetch(apiUrl(`/api/leaderboard?page=${next}&limit=${PAGE_SIZE}`))
      .then((r) => r.json() as Promise<LeaderboardResponse>)
      .then((d) => {
        setUsers((prev) => [...prev, ...d.users]);
        setHasMore(d.hasMore);
        setPage(next);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadMore(); }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Header centrado ── */}
        <div className="flex flex-col items-center gap-2 mb-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-1">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-3xl font-black text-foreground leading-tight">Ranking</h1>
          {!loading && total > 0 && (
            <p className="text-sm text-muted-foreground">{total} jugadores con victorias</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aún no hay victorias registradas.</p>
          </div>
        ) : (
          <>
            {/* ── Podium ── */}
            {top3.length > 0 && (
              <div className="bg-card border border-border rounded-3xl px-6 pt-8 pb-0 mb-8 shadow-sm overflow-hidden">
                <Podium top3={top3} />
              </div>
            )}

            {/* ── Tabla general ── */}
            {rest.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

                {/* Cabecera de la card */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Tabla general</p>
                  <p className="text-xs text-muted-foreground">{total} jugadores</p>
                </div>

                {/* Tabla */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="pl-5 pr-2 py-2.5 w-10 text-left">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</span>
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Usuario</span>
                      </th>
                      <th className="pl-3 pr-5 py-2.5 text-right">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Victorias</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rest.map((u, i) => (
                      <TableRow key={u.id} user={u} rank={top3.length + i + 1} />
                    ))}
                  </tbody>
                </table>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex justify-center py-4 border-t border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!hasMore && rest.length > 0 && (
                  <div className="px-4 py-4 border-t border-border text-center">
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
