import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const leaderboardMode = v.union(v.literal("daily"), v.literal("total"));

const getDayKey = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10);

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return stats ?? null;
  },
});

export const recordView = mutation({
  args: {
    userId: v.id("users"),
    feedId: v.id("feeds"),
    reelId: v.id("reels"),
  },
  handler: async (ctx, args) => {
    const reel = await ctx.db.get(args.reelId);
    if (!reel || reel.feedId !== args.feedId) {
      throw new Error("Reel does not belong to feed");
    }

    const existing = await ctx.db
      .query("reelViews")
      .withIndex("by_user_reel", (q) =>
        q.eq("userId", args.userId).eq("reelId", args.reelId),
      )
      .first();

    if (existing) {
      const stats = await ctx.db
        .query("userStats")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .unique();
      return { counted: false, stats };
    }

    const now = Date.now();
    const dayKey = getDayKey(now);

    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!stats) {
      const statsId = await ctx.db.insert("userStats", {
        userId: args.userId,
        currentStreak: 0,
        bestStreak: 0,
        dailyStreak: 0,
        totalCount: 0,
        lastFeedId: undefined,
        lastDayKey: dayKey,
        createdAt: now,
        updatedAt: now,
      });
      stats = await ctx.db.get(statsId);
    }

    let currentStreak = stats?.currentStreak ?? 0;
    let dailyStreak = stats?.dailyStreak ?? 0;

    if (stats?.lastFeedId && stats.lastFeedId !== args.feedId) {
      currentStreak = 0;
    }

    if (stats?.lastDayKey !== dayKey) {
      dailyStreak = 0;
    }

    currentStreak += 1;
    dailyStreak += 1;
    const totalCount = (stats?.totalCount ?? 0) + 1;
    const bestStreak = Math.max(stats?.bestStreak ?? 0, currentStreak);

    await ctx.db.patch(stats!._id, {
      currentStreak,
      bestStreak,
      dailyStreak,
      totalCount,
      lastFeedId: args.feedId,
      lastDayKey: dayKey,
      updatedAt: now,
    });

    await ctx.db.insert("reelViews", {
      userId: args.userId,
      feedId: args.feedId,
      reelId: args.reelId,
      dayKey,
      viewedAt: now,
    });

    const updated = await ctx.db.get(stats!._id);
    return { counted: true, stats: updated };
  },
});

export const leaderboard = query({
  args: {
    mode: leaderboardMode,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const dayKey = getDayKey(Date.now());

    const statsQuery =
      args.mode === "daily"
        ? ctx.db.query("userStats").withIndex("by_dailyStreak")
        : ctx.db.query("userStats").withIndex("by_totalCount");

    const stats = await statsQuery.order("desc").take(limit);

    const enriched = await Promise.all(
      stats.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          userId: entry.userId,
          name: user?.name ?? "ReeLearner",
          avatarUrl: user?.avatarUrl ?? null,
          dailyStreak: entry.lastDayKey === dayKey ? entry.dailyStreak : 0,
          totalCount: entry.totalCount,
          bestStreak: entry.bestStreak,
        };
      }),
    );

    const ordered = enriched.sort((a, b) => {
      const aValue = args.mode === "daily" ? a.dailyStreak : a.totalCount;
      const bValue = args.mode === "daily" ? b.dailyStreak : b.totalCount;
      return bValue - aValue;
    });

    return ordered.slice(0, limit);
  },
});
