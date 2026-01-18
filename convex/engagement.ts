import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_COMMENT_LIMIT = 6;
const MAX_COMMENT_LENGTH = 240;

export const getReelEngagement = query({
  args: {
    reelId: v.id("reels"),
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const likeEntries = await ctx.db
      .query("reelLikes")
      .withIndex("by_reelId", (q) => q.eq("reelId", args.reelId))
      .collect();

    const commentEntries = await ctx.db
      .query("reelComments")
      .withIndex("by_reelId", (q) => q.eq("reelId", args.reelId))
      .collect();

    const commentLimit = Math.max(args.limit ?? DEFAULT_COMMENT_LIMIT, 0);
    const latestComments = await ctx.db
      .query("reelComments")
      .withIndex("by_reel_createdAt", (q) => q.eq("reelId", args.reelId))
      .order("desc")
      .take(commentLimit);

    const comments = await Promise.all(
      latestComments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          id: comment._id,
          body: comment.body,
          createdAt: comment.createdAt,
          userId: comment.userId,
          userName: user?.name ?? "Anonymous",
          userAvatarUrl: user?.avatarUrl ?? null,
        };
      }),
    );

    let likedByUser = false;
    if (args.userId) {
      const like = await ctx.db
        .query("reelLikes")
        .withIndex("by_reel_user", (q) =>
          q.eq("reelId", args.reelId).eq("userId", args.userId!),
        )
        .first();
      likedByUser = Boolean(like);
    }

    return {
      likeCount: likeEntries.length,
      commentCount: commentEntries.length,
      likedByUser,
      comments,
    };
  },
});

export const toggleLike = mutation({
  args: {
    reelId: v.id("reels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reelLikes")
      .withIndex("by_reel_user", (q) =>
        q.eq("reelId", args.reelId).eq("userId", args.userId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    }

    await ctx.db.insert("reelLikes", {
      reelId: args.reelId,
      userId: args.userId,
      createdAt: Date.now(),
    });

    return { liked: true };
  },
});

export const addComment = mutation({
  args: {
    reelId: v.id("reels"),
    userId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const body = args.body.trim();
    if (!body) {
      throw new Error("Comment cannot be empty");
    }
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new Error("Comment too long");
    }

    const commentId = await ctx.db.insert("reelComments", {
      reelId: args.reelId,
      userId: args.userId,
      body,
      createdAt: Date.now(),
    });

    return commentId;
  },
});
