import { v } from "convex/values";
import { mutation, action, internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    return await ctx.db
      .query("tasks")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .order("desc")
      .collect();
  },
});

// Query to get a specific task (only if user owns it)
export const getTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const task = await ctx.db.get(args.taskId);
    if (!task || task.user_id !== userId) {
      return null;
    }
    
    return task;
  },
});

// Mutation to create a new task (authenticated)
export const createTask = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    idempotency_key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }
    if (args.idempotency_key) {
      const existingTask = await ctx.db
        .query("tasks")
        .withIndex("by_idempotency_key", (q) => 
          q.eq("idempotency_key", args.idempotency_key)
        )
        .filter((q) => q.eq(q.field("user_id"), userId))
        .first();
      
      if (existingTask) {
        console.log(`Duplicate request for idempotency_key: ${args.idempotency_key}. Returning existing task.`);
        return existingTask._id;
      }
    }

    const taskId = await ctx.db.insert("tasks", {
      name: args.name,
      type: "timer",
      description: args.description,
      status: "INITIATED",
      progress: 0,
      idempotency_key: args.idempotency_key,
      user_id: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.tasks.runTimerAction, {
      taskId: taskId,
    });

    return taskId;
  },
});

export const runTimerAction = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    console.log(`Starting timer action for task: ${args.taskId}`);
    
    await ctx.runMutation(internal.tasks.updateTaskStatus, {
      taskId: args.taskId,
      status: "RUNNING",
      progress: 0,
    });

    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const progress = (i / 10) * 100;
      console.log(`Task ${args.taskId} progress: ${progress}%`);
      
      await ctx.runMutation(internal.tasks.updateTaskProgress, {
        taskId: args.taskId,
        progress: progress,
      });
    }

    await ctx.runMutation(internal.tasks.updateTaskStatus, {
      taskId: args.taskId,
      status: "COMPLETED",
      progress: 100,
    });

    console.log(`Timer action completed for task: ${args.taskId}`);
  },
});

export const updateTaskStatus = internalMutation({
  args: {
    taskId: v.id("tasks"),
    status: v.string(),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status,
      progress: args.progress ?? 0,
      updatedAt: Date.now(),
    });
  },
});

export const updateTaskProgress = internalMutation({
  args: {
    taskId: v.id("tasks"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
  },
});