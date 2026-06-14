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
  1: {
    order: 2,
    barH: "h-36",
    barBg: "bg-amber-400",
    numColor: "text-amber-300",
    avatarSize: 72,
    crown: true,
    label: "Oro",
  },
  2: {
    order: 1,
    barH: "h-24",
    barBg: "bg-slate-300",
    numColor: "text-slate-200",
    avatarSize: 60,
    crown: false,
    label: "Plata",
  },
  3: {
    order: 3,
    barH: "h-16",
    barBg: "bg-amber-600",
    numColor: "text-amber-500",
    avatarSize: 56,
    crown: false,
    label: "Bronce",
  },
} as const;

function PodiumColumn({ user, rank }: { user: LeaderboardUser; rank: 1 | 2 | 3 }) {
  const cfg = PODIUM_CONFIG[rank];
  return (
    <Link href={`/u/${user.username}`}>
      <div className="flex flex-col items-center gap-2 cursor-pointer group" style={{ order: cfg.order }}>
        {/* Crown for 1st */}
        {cfg.crown && (
          <span className="text-3xl mb-1 drop-shadow">👑</span>
        )}
        {/* Avatar */}
        <div className="relative">
          <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={cfg.avatarSize} />
        </div>
        {/* Name */}
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[90px] text-center">
          @{user.username}
        </p>
        {/* Wins */}
        <p className="text-xs font-semibold text-muted-foreground">
          {user.wins} {user.wins === 1 ? "victoria" : "victorias"}
        </p>
        {/* Podium bar */}
        <div className={`w-28 sm:w-36 ${cfg.barH} ${cfg.barBg} rounded-t-2xl flex flex-col items-center justify-center gap-1 shadow-md`}>
          <Trophy className="w-6 h-6 text-white/60" />
          <span className={`text-4xl font-black ${cfg.numColor}`}>{rank}</span>
        </div>
      </div>
    </Link>
  );
}

function Podium({ top3 }: { top3: LeaderboardUser[] }) {
  const [first, second, third] = top3;
  return (
    <div className="flex items-end justify-center gap-4 sm:gap-6 pb-0">
      {second && <PodiumColumn user={second} rank={2} />}
      {first  && <PodiumColumn user={first}  rank={1} />}
      {third  && <PodiumColumn user={third}  rank={3} />}
    </div>
  );
}

// ── Table row (rank 4+) ───────────────────────────────────────────────────────

function TableRow({ user, rank }: { user: LeaderboardUser; rank: number }) {
  return (
    <Link href={`/u/${user.username}`}>
      <tr className="hover:bg-muted/30 transition-colors cursor-pointer">
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-semibold text-muted-foreground tabular-nums w-8 inline-block">{rank}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <RankAvatar username={user.username} avatarUrl={user.avatarUrl} size={36} />
            <span className="text-sm font-semibold text-foreground">@{user.username}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-bold text-foreground tabular-nums">{user.wins}</span>
          <span className="text-xs text-muted-foreground ml-1">{user.wins === 1 ? "victoria" : "victorias"}</span>
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

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
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

            {/* ── Rest table ── */}
            {rest.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Tabla general</p>
                  <p className="text-xs text-muted-foreground">{total} jugadores</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-center w-12">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">#</span>
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Usuario</span>
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Victorias</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rest.map((u, i) => (
                      <TableRow key={u.id} user={u} rank={top3.length + i + 1} />
                    ))}
                  </tbody>
                </table>

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
