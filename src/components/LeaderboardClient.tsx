"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Mode = "total" | "daily";

export default function LeaderboardClient() {
  const [mode, setMode] = useState<Mode>("total");
  const data = useQuery(api.stats.leaderboard, { mode, limit: 20 });

  const sorted = useMemo(() => data ?? [], [data]);
  const title = mode === "daily" ? "Daily streak" : "Total scrolls";
  const subtitle =
    mode === "daily"
      ? "Top streaks for today"
      : "All-time scroll leaders";

  return (
    <div className="flex min-h-screen flex-col gap-8 px-8 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("total")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
            mode === "total"
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Total
        </button>
        <button
          type="button"
          onClick={() => setMode("daily")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
            mode === "daily"
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Daily
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>Rank</span>
          <span>{title}</span>
        </div>
        <div className="flex flex-col gap-3">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No streaks yet. Start scrolling to climb the board.
            </div>
          ) : (
            sorted.map((entry, index) => {
              const score = mode === "daily" ? entry.dailyStreak : entry.totalCount;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm ${
                    index === 0
                      ? "bg-foreground text-background"
                      : "bg-background text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold">#{index + 1}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{entry.name}</span>
                      <span
                        className={`text-xs ${
                          index === 0 ? "text-background/80" : "text-muted-foreground"
                        }`}
                      >
                        Best streak: {entry.bestStreak}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{score}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
