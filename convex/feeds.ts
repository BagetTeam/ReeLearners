import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const feedStatus = v.union(
  v.literal("pending"),
  v.literal("curating"),
  v.literal("ready"),
  v.literal("archived"),
);

export const create = mutation({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    topic: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    return ctx.db.insert("feeds", {
      userId: args.userId,
      prompt: args.prompt,
      topic: args.topic,
      description: args.description ?? undefined,
      tags: args.tags ?? undefined,
      status: "pending",
      lastSeenReelId: undefined,
      lastSeenIndex: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
    status: v.optional(feedStatus),
  },
  handler: async (ctx, args) => {
    let feedsQuery;
    if (args.status) {
      feedsQuery = ctx.db
        .query("feeds")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", args.userId).eq("status", args.status!),
        );
    } else {
      feedsQuery = ctx.db
        .query("feeds")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId));
    }

    const feeds = await feedsQuery.collect();
    return feeds.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const updateStatus = mutation({
  args: {
    feedId: v.id("feeds"),
    status: feedStatus,
  },
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId);
    if (!feed) {
      throw new Error("Feed not found");
    }

    await ctx.db.patch(args.feedId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateProgress = mutation({
  args: {
    feedId: v.id("feeds"),
    lastSeenReelId: v.optional(v.id("reels")),
    lastSeenIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId);
    if (!feed) {
      throw new Error("Feed not found");
    }

    if (args.lastSeenReelId) {
      const status = await ctx.db
        .query("reelStatus")
        .withIndex("by_feed_reel", (q) =>
          q.eq("feedId", args.feedId).eq("reelId", args.lastSeenReelId!),
        )
        .first();
      if (!status) {
        throw new Error("Reel does not belong to feed");
      }
    }

    await ctx.db.patch(args.feedId, {
      lastSeenReelId: args.lastSeenReelId ?? undefined,
      lastSeenIndex: args.lastSeenIndex ?? undefined,
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { feedId: v.id("feeds") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.feedId);
  },
});

export const deleteFeed = mutation({
  args: { feedId: v.id("feeds") },
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId);
    if (!feed) {
      throw new Error("Feed not found");
    }

    const statuses = await ctx.db
      .query("reelStatus")
      .withIndex("by_feed_position", (q) => q.eq("feedId", args.feedId))
      .collect();

    const affectedReelIds = new Set(statuses.map((status) => status.reelId));

    for (const status of statuses) {
      await ctx.db.delete(status._id);
    }

    for (const reelId of affectedReelIds) {
      const remainingStatus = await ctx.db
        .query("reelStatus")
        .withIndex("by_reelId", (q) => q.eq("reelId", reelId))
        .first();
      if (remainingStatus) {
        continue;
      }

      const views = await ctx.db
        .query("reelViews")
        .withIndex("by_reelId", (q) => q.eq("reelId", reelId))
        .collect();
      for (const view of views) {
        await ctx.db.delete(view._id);
      }

      await ctx.db.delete(reelId);
    }

    await ctx.db.delete(args.feedId);
  },
});
