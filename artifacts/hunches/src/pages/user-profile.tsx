import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { apiUrl } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Trophy, Target, Calendar, TrendingUp, Clock, XCircle, Bookmark, Heart, MessageSquare } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfileData {
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

interface BookmarkedComment {
  id: number;
  hunchId: number;
  parentId: number | null;
  body: string | null;
  isDeleted: boolean;
  isHidden: boolean;
  createdAt: string;
  author: { username: string | null; avatarUrl: string | null } | null;
  likeCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  hunch: { id: number; slug: string | null; title: string } | null;
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

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Bookmarks — only loaded when viewing own profile
  const [bookmarks, setBookmarks] = useState<BookmarkedComment[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"predictions" | "bookmarks">("predictions");

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    fetch(apiUrl(`/api/users/${encodeURIComponent(username)}`), { credentials: "include" })
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const json = await r.json() as UserProfileData;
        setData(json);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  const fetchBookmarks = useCallback(async () => {
    setBookmarksLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/comment-bookmarks"), { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json() as { bookmarks: BookmarkedComment[] };
      setBookmarks(json.bookmarks);
    } finally {
      setBookmarksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwnProfile && activeTab === "bookmarks") fetchBookmarks();
  }, [isOwnProfile, activeTab, fetchBookmarks]);

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

        {/* Tabs — show bookmarks tab only on own profile */}
        {isOwnProfile && (
          <div className="flex border-b border-border mb-5 gap-1">
            <button
              onClick={() => setActiveTab("predictions")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === "predictions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Predictions
            </button>
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === "bookmarks"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved
            </button>
          </div>
        )}

        {/* Predictions tab */}
        {activeTab === "predictions" && (
          <div>
            {!isOwnProfile && (
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent predictions</h2>
            )}
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
        )}

        {/* Bookmarks tab — own profile only */}
        {activeTab === "bookmarks" && isOwnProfile && (
          <div>
            {bookmarksLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
                No saved comments yet. Tap the bookmark icon on any comment to save it here.
              </div>
            ) : (
              <div className="space-y-3">
                {bookmarks.map((b) => (
                  <div key={b.id} className="bg-card border border-border rounded-2xl px-4 py-3">
                    {b.isDeleted || b.isHidden ? (
                      <p className="text-sm text-muted-foreground italic">[This comment is no longer available]</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1.5">
                          {b.author?.username ? (
                            <Link href={`/u/${b.author.username}`} className="text-xs font-bold text-foreground hover:text-primary hover:underline">
                              @{b.author.username}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">anonymous</span>
                          )}
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed mb-2">{b.body}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Heart className="w-3 h-3" />
                            <span>{b.likeCount}</span>
                          </div>
                          {b.hunch && (
                            <Link
                              href={b.hunch.slug ? `/hunch/${b.hunch.slug}` : `/hunch/${b.hunch.id}`}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 truncate max-w-[60%]"
                            >
                              <MessageSquare className="w-3 h-3 shrink-0" />
                              <span className="truncate">{b.hunch.title}</span>
                            </Link>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
