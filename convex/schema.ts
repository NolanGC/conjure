import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.

export default defineSchema({
  ...authTables,
  tasks: defineTable({
    name: v.string(),
    type: v.string(),
    description: v.string(),
    status: v.string(),
    progress: v.number(),
    idempotency_key: v.optional(v.string()),
    user_id: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_user_id", ["user_id"]),
});

