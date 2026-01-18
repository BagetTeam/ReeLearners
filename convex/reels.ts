import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const reelStatus = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("failed"),
);

const sourceType = v.union(
  v.literal("internal"),
  v.literal("generated"),
  v.literal("external"),
);

export const addToFeed = mutation({
  args: {
    feedId: v.id("feeds"),
    sourceType,
    position: v.optional(v.number()),
    status: v.optional(reelStatus),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    sourceReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId);
    if (!feed) {
      throw new Error("Feed not found");
    }

    const now = Date.now();
    const status = args.status ?? (args.videoUrl ? "ready" : "pending");

    return ctx.db.insert("reels", {
      feedId: args.feedId,
      position: args.position ?? now,
      sourceType: args.sourceType,
      status,
      videoUrl: args.videoUrl ?? undefined,
      thumbnailUrl: args.thumbnailUrl ?? undefined,
      title: args.title ?? undefined,
      description: args.description ?? undefined,
      durationSeconds: args.durationSeconds ?? undefined,
      sourceReference: args.sourceReference ?? undefined,
      metadata: args.metadata ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    reelId: v.id("reels"),
    status: v.optional(reelStatus),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const reel = await ctx.db.get(args.reelId);
    if (!reel) {
      throw new Error("Reel not found");
    }

    await ctx.db.patch(args.reelId, {
      status: args.status ?? reel.status,
      videoUrl: args.videoUrl ?? reel.videoUrl ?? undefined,
      thumbnailUrl: args.thumbnailUrl ?? reel.thumbnailUrl ?? undefined,
      title: args.title ?? reel.title ?? undefined,
      description: args.description ?? reel.description ?? undefined,
      durationSeconds:
        args.durationSeconds ?? reel.durationSeconds ?? undefined,
      metadata: args.metadata ?? reel.metadata ?? undefined,
      updatedAt: Date.now(),
    });
  },
});

export const listForFeed = query({
  args: {
    feedId: v.id("feeds"),
    status: v.optional(reelStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let reelsQuery;
    if (args.status) {
      reelsQuery = ctx.db
        .query("reels")
        .withIndex("by_feed_status", (q) =>
          q.eq("feedId", args.feedId).eq("status", args.status!),
        );
    } else {
      reelsQuery = ctx.db
        .query("reels")
        .withIndex("by_feedId", (q) => q.eq("feedId", args.feedId));
    }

    const ordered = reelsQuery.order("asc");
    const all = await ordered.collect();
    return args.limit ? all.slice(0, args.limit) : all;
  },
});

export const getById = query({
  args: { reelId: v.id("reels") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.reelId);
  },
});

export const fetchForPrompt = action({
  args: {
    feedId: v.id("feeds"),
    prompt: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.reels.listForFeed, {
      feedId: args.feedId,
      limit: 1,
    });
    if (existing.length > 0) {
      return { inserted: 0, skipped: true };
    }

    await ctx.runMutation(api.feeds.updateStatus, {
      feedId: args.feedId,
      status: "curating",
    });

    const baseUrl =
      process.env.VIDEO_API_URL ?? process.env.NEXT_PUBLIC_VIDEO_API_URL;

    if (!baseUrl) {
      throw new Error("VIDEO_API_URL not set");
    }

    const url = new URL("/search", baseUrl);
    url.searchParams.set("query", args.prompt);
    url.searchParams.set("max_results", String(args.limit ?? 8));

    const response = await fetch(url.toString());
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Video search failed: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as {
      videos?: Array<{
        video_id?: string;
        title?: string;
        watch_url?: string;
        embed_url?: string;
      }>;
    };

    const videos = payload.videos ?? [];
    let inserted = 0;

    const basePosition = Date.now();
    for (const [index, video] of videos.entries()) {
      const videoUrl = video.embed_url ?? video.watch_url;
      if (!videoUrl) {
        continue;
      }

      await ctx.runMutation(api.reels.addToFeed, {
        feedId: args.feedId,
        sourceType: "external",
        position: basePosition + index,
        status: "ready",
        videoUrl,
        title: video.title ?? "Untitled clip",
        description: args.prompt,
        sourceReference: video.video_id ?? undefined,
        metadata: {
          watchUrl: video.watch_url ?? undefined,
        },
      });
      inserted += 1;
    }

    await ctx.runMutation(api.feeds.updateStatus, {
      feedId: args.feedId,
      status: inserted > 0 ? "ready" : "pending",
    });

    return { inserted, skipped: false };
  },
});
