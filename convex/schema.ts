import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  users: defineTable({
    auth0Id: v.string(),
  }),

  prompts: defineTable({
    title: v.string(),
    prompt: v.string(),
    userId: v.string(),
    attachmentId: v.string(),
  }).index("by_userId", ["userId"]),
});

export default schema;
