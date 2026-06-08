import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { apiUrl } from "@/lib/apiFetch";
import { Loader2, Trophy, Target, Calendar, TrendingUp, CheckCircle2, Clock, XCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  profile: {
    username: string;
    avatarUrl: string | null;
    memberSince: string;
  };
  stats: {
    totalPredictions: number;
    totalWins: number;
  };
  recentPredictions: Array<{
    hunchId: number;
    hunchSlug: string | null;
    hunchTitle: string;
    hunchStatus: string;
    hunchEndsAt: string;
    optionLabel: string;
    predCreatedAt: string;
    categoryIcon: string | null;
    categoryColor: string | null;
    won: boolean;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Avatar({ username, avatarUrl, size = 80 }: { username: string; avatarUrl: string | null; size?: number }) {
  const initials = username.slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className="rounded-full object-cover border-4 border-background shadow-md"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center border-4 border-background shadow-md bg-violet-100 text-violet-700 font-black"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

function PredStatusIcon({ status, won }: { status: string; won: boolean }) {
  if (status === "resolved") {
    return won
      ? <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
      : <XCircle className="w-4 h-4 text-muted-foreground/50 shrink-0" />;
  }
  if (status === "open") return <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-muted-foreground/50 shrink-0" />;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    fetch(apiUrl(`/api/users/${encodeURIComponent(username)}`))
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const json = await r.json() as UserProfile;
        setData(json);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (notFound || !data) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Target className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">User not found</h1>
          <p className="text-muted-foreground text-sm">@{username} doesn't exist or hasn't set a username yet.</p>
          <Link href="/" className="mt-2 text-sm font-semibold text-primary hover:underline">Back to Hunches</Link>
        </div>
      </Layout>
    );
  }

  const { profile, stats, recentPredictions } = data;
  const joinedDate = new Date(profile.memberSince).toLocaleDateString("en-US", { year: "numeric", month: "long" });
  const winRate = stats.totalPredictions > 0
    ? Math.round((stats.totalWins / Math.min(stats.totalPredictions, 200)) * 100)
    : 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Profile header */}
        <div className="flex items-center gap-5 mb-8">
          <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size={80} />
          <div>
            <h1 className="text-2xl font-black text-foreground">@{profile.username}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Member since {joinedDate}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-foreground">{stats.totalPredictions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Predictions</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-amber-500">{stats.totalWins}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wins</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-foreground">{winRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Win rate</p>
          </div>
        </div>

        {/* Recent predictions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent predictions</h2>

          {recentPredictions.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
              No predictions yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentPredictions.map((p) => (
                <Link
                  key={`${p.hunchId}-${p.predCreatedAt}`}
                  href={p.hunchSlug ? `/hunch/${p.hunchSlug}` : `/hunch/${p.hunchId}`}
                  className="block bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/30 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <PredStatusIcon status={p.hunchStatus} won={p.won} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug">{p.hunchTitle}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          Pick: <span className="font-medium text-foreground">{p.optionLabel}</span>
                        </span>
                        {p.hunchStatus === "resolved" && (
                          <span className={`text-xs font-semibold ${p.won ? "text-amber-500" : "text-muted-foreground/60"}`}>
                            {p.won ? "Won" : "Lost"}
                          </span>
                        )}
                        {p.hunchStatus === "open" && (
                          <span className="text-xs font-semibold text-green-600">Active</span>
                        )}
                        {p.hunchStatus === "closed" && (
                          <span className="text-xs font-semibold text-muted-foreground">Closed</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {new Date(p.predCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
