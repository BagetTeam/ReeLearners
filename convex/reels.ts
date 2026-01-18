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

    let reel =
      args.videoUrl !== undefined
        ? await ctx.db
            .query("reels")
            .withIndex("by_videoUrl", (q) => q.eq("videoUrl", args.videoUrl))
            .first()
        : null;

    if (!reel && args.sourceReference) {
      reel = await ctx.db
        .query("reels")
        .withIndex("by_sourceReference", (q) =>
          q.eq("sourceReference", args.sourceReference),
        )
        .first();
    }

    let reelId = reel?._id;
    if (!reelId) {
      reelId = await ctx.db.insert("reels", {
        sourceType: args.sourceType,
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
      reel = await ctx.db.get(reelId);
    } else if (reel) {
      const patch: Partial<typeof reel> = {};
      if (args.thumbnailUrl && !reel.thumbnailUrl) {
        patch.thumbnailUrl = args.thumbnailUrl;
      }
      if (args.title && !reel.title) {
        patch.title = args.title;
      }
      if (args.description && !reel.description) {
        patch.description = args.description;
      }
      if (
        args.durationSeconds !== undefined &&
        reel.durationSeconds === undefined
      ) {
        patch.durationSeconds = args.durationSeconds;
      }
      if (args.metadata && !reel.metadata) {
        patch.metadata = args.metadata;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await ctx.db.patch(reelId, patch);
      }
    }

    const existingStatus = await ctx.db
      .query("reelStatus")
      .withIndex("by_feed_reel", (q) =>
        q.eq("feedId", args.feedId).eq("reelId", reelId!),
      )
      .first();

    if (existingStatus) {
      return { reelId: reelId!, statusId: existingStatus._id, isNew: false };
    }

    const statusId = await ctx.db.insert("reelStatus", {
      feedId: args.feedId,
      reelId: reelId!,
      position: args.position ?? now,
      status,
      createdAt: now,
      updatedAt: now,
    });

    return { reelId: reelId!, statusId, isNew: true };
  },
});

export const update = mutation({
  args: {
    reelId: v.id("reels"),
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
    let statusQuery;
    if (args.status) {
      statusQuery = ctx.db
        .query("reelStatus")
        .withIndex("by_feed_status_position", (q) =>
          q.eq("feedId", args.feedId).eq("status", args.status!),
        );
    } else {
      statusQuery = ctx.db
        .query("reelStatus")
        .withIndex("by_feed_position", (q) => q.eq("feedId", args.feedId));
    }

    const ordered = statusQuery.order("asc");
    const statuses = args.limit
      ? await ordered.take(args.limit)
      : await ordered.collect();

    const reels = [];
    for (const entry of statuses) {
      const reel = await ctx.db.get(entry.reelId);
      if (!reel) continue;
      reels.push({
        ...reel,
        feedId: entry.feedId,
        status: entry.status,
        position: entry.position,
      });
    }
    return reels;
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
        video_url?: string;
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
      const videoUrl = video.video_url ?? video.embed_url ?? video.watch_url;
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
          video_url?: string;
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
      const videoUrl = video.video_url ?? video.embed_url ?? video.watch_url;
      if (!videoUrl) {
        continue;
      }
      const provider = video.source ?? "youtube";

      const result = await ctx.runMutation(api.reels.addToFeed, {
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
      if (result.isNew) {
        inserted += 1;
      }
    }

    // TikTok fetch happens asynchronously in a separate action.

    await ctx.runMutation(api.feeds.updateStatus, {
      feedId: args.feedId,
      status: inserted > 0 ? "ready" : "pending",
    });

    return { inserted };
  },
});
