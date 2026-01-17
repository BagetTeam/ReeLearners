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
      const reel = await ctx.db.get(args.lastSeenReelId);
      if (!reel) {
        throw new Error("Reel not found");
      }
      if (reel.feedId !== args.feedId) {
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

    const reels = await ctx.db
      .query("reels")
      .withIndex("by_feedId", (q) => q.eq("feedId", args.feedId))
      .collect();

    for (const reel of reels) {
      await ctx.db.delete(reel._id);
    }

    await ctx.db.delete(args.feedId);
  },
});
