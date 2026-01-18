import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  users: defineTable({
    auth0Id: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  }).index("by_auth0Id", ["auth0Id"]),

  feeds: defineTable({
    userId: v.id("users"),
    prompt: v.string(),
    topic: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("curating"),
      v.literal("ready"),
      v.literal("archived"),
    ),
    lastSeenReelId: v.optional(v.id("reels")),
    lastSeenIndex: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  reels: defineTable({
    sourceType: v.union(
      v.literal("internal"),
      v.literal("generated"),
      v.literal("external"),
    ),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    sourceReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_videoUrl", ["videoUrl"])
    .index("by_sourceReference", ["sourceReference"]),

  reelStatus: defineTable({
    feedId: v.id("feeds"),
    reelId: v.id("reels"),
    position: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feed_position", ["feedId", "position"])
    .index("by_feed_status_position", ["feedId", "status", "position"])
    .index("by_feed_reel", ["feedId", "reelId"])
    .index("by_reelId", ["reelId"]),

  userStats: defineTable({
    userId: v.id("users"),
    currentStreak: v.number(),
    bestStreak: v.number(),
    dailyStreak: v.number(),
    totalCount: v.number(),
    lastFeedId: v.optional(v.id("feeds")),
    lastDayKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_dailyStreak", ["dailyStreak"])
    .index("by_totalCount", ["totalCount"]),

  reelViews: defineTable({
    userId: v.id("users"),
    feedId: v.id("feeds"),
    reelId: v.id("reels"),
    dayKey: v.string(),
    viewedAt: v.number(),
  })
    .index("by_reelId", ["reelId"])
    .index("by_user_reel", ["userId", "reelId"])
    .index("by_user_day", ["userId", "dayKey"]),
});

export default schema;
