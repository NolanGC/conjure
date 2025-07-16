import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.

export default defineSchema({
  ...authTables,
  workflows: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    progress: v.number(), 
    tasks: v.array(v.id("tasks")),
    current_task_id: v.optional(v.id("tasks")),
    user_id: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_task", ["tasks"]), // maybe think about a better alternative?
  
  tasks: defineTable({
    name: v.string(),
    type: v.string(),
    description: v.string(),
    status: v.string(),
    progress: v.number(),
    idempotency_key: v.optional(v.string()),
    task_cost: v.number(),
    user_id: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_user_id", ["user_id"]),
  
  video_generations: defineTable({
    task_id: v.id("tasks"),
    storage_id: v.id("_storage"),
    user_id: v.string(),
    created_at: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_task", ["task_id"])
    .index("by_user", ["user_id"]),
});

