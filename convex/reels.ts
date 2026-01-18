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

export const fetchTikTokForPrompt = action({
  args: {
    feedId: v.id("feeds"),
    prompt: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const baseUrl =
      process.env.VIDEO_API_URL ?? process.env.NEXT_PUBLIC_VIDEO_API_URL;

    if (!baseUrl) {
      throw new Error("VIDEO_API_URL not set");
    }

    const feed = await ctx.runQuery(api.feeds.getById, { feedId: args.feedId });
    if (!feed) {
      throw new Error("Feed not found");
    }

    const url = new URL("/search", baseUrl);
    url.searchParams.set("query", args.prompt);
    url.searchParams.set("max_results", String(args.limit ?? 8));
    url.searchParams.set("sources", "tiktok");

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
        source?: string;
      }>;
    };

    const tiktokVideos = (payload.videos ?? []).map((video) => ({
      ...video,
      source: video.source ?? "tiktok",
    }));

    const existing = await ctx.runQuery(api.reels.listForFeed, {
      feedId: args.feedId,
    });
    const ordered = [...existing].sort((a, b) => a.position - b.position);
    const lastSeenIndex = feed.lastSeenIndex ?? 0;
    const currentPosition = ordered[lastSeenIndex]?.position ?? Date.now();
    const remainingPositions = ordered
      .slice(lastSeenIndex + 1)
      .map((reel) => reel.position);

    let inserted = 0;
    for (const [index, video] of tiktokVideos.entries()) {
      const videoUrl = video.embed_url ?? video.watch_url;
      if (!videoUrl) {
        continue;
      }

      const targetIndex = index * 2;
      const nextPosition = remainingPositions[targetIndex];
      const position =
        nextPosition !== undefined
          ? (currentPosition + nextPosition) / 2 + index / 1000
          : currentPosition + 1 + index;

      await ctx.runMutation(api.reels.addToFeed, {
        feedId: args.feedId,
        sourceType: "external",
        position,
        status: "ready",
        videoUrl,
        title: video.title ?? "TikTok clip",
        description: args.prompt,
        sourceReference: video.video_id ?? undefined,
        metadata: {
          watchUrl: video.watch_url ?? undefined,
          provider: "tiktok",
        },
      });
      inserted += 1;
    }

    return { inserted };
  },
});

export const fetchForPrompt = action({
  args: {
    feedId: v.id("feeds"),
    prompt: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.feeds.updateStatus, {
      feedId: args.feedId,
      status: "curating",
    });

    const baseUrl =
      process.env.VIDEO_API_URL ?? process.env.NEXT_PUBLIC_VIDEO_API_URL;

    if (!baseUrl) {
      throw new Error("VIDEO_API_URL not set");
    }

    const fetchVideos = async (source: string) => {
      const url = new URL("/search", baseUrl);
      url.searchParams.set("query", args.prompt);
      url.searchParams.set("max_results", String(args.limit ?? 8));
      url.searchParams.set("sources", source);

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
          source?: string;
        }>;
      };

      return payload.videos ?? [];
    };

    const youtubeVideos = await fetchVideos("youtube");
    const allVideos = youtubeVideos.map((video) => ({
      ...video,
      source: video.source ?? "youtube",
    }));

    let inserted = 0;
    const basePosition = Date.now();
    for (const [index, video] of allVideos.entries()) {
      const videoUrl = video.embed_url ?? video.watch_url;
      if (!videoUrl) {
        continue;
      }
      const provider = video.source ?? "youtube";

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
          provider,
        },
      });
      inserted += 1;
    }

    // TikTok fetch happens asynchronously in a separate action.

    await ctx.runMutation(api.feeds.updateStatus, {
      feedId: args.feedId,
      status: inserted > 0 ? "ready" : "pending",
    });

    return { inserted };
  },
});
