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
    feedId: v.id("feeds"),
    position: v.number(),
    sourceType: v.union(
      v.literal("internal"),
      v.literal("generated"),
      v.literal("external"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
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
    .index("by_feedId", ["feedId"])
    .index("by_feed_status", ["feedId", "status"]),
});

export default schema;
