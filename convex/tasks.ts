import { v } from "convex/values";
import { mutation, action, internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import Replicate, { type Prediction } from 'replicate';
import { type TaskType, type ReplicateModel } from "../types";

const TASK_TYPE_TO_ACTION : Record<TaskType, any> = {
  "timer": internal.tasks.runTimerAction,
  "replicate": internal.tasks.runReplicateAction,
};

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

// Query to get generations for a user
export const getGenerations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    return await ctx.db
      .query("video_generations")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .order("desc")
      .collect();
  },
});

// Query to get generation by task ID
export const getGenerationByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const generation = await ctx.db
      .query("video_generations")
      .withIndex("by_task", (q) => q.eq("task_id", args.taskId))
      .first();
    
    if (!generation || generation.user_id !== userId) {
      return null;
    }
    
    return generation;
  },
});

// Mutation to create a new task (authenticated)
export const createTask = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    idempotency_key: v.optional(v.string()),
    type: v.string(),
    task_args: v.optional(v.any()), // TODO? smart way to type this?
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
      type: args.type,
      description: args.description,
      status: "INITIATED",
      progress: 0,
      idempotency_key: args.idempotency_key,
      task_cost: 0, // TODO: calculate actual cost
      user_id: userId,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const action = TASK_TYPE_TO_ACTION[args.type as TaskType];
    if (action) {
      await ctx.scheduler.runAfter(0, action, {
        taskId: taskId,
        taskArgs: args.task_args || undefined,
      });
    }

    return taskId;
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
      updated_at: Date.now(),
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
      updated_at: Date.now(),
    });
  },
});

// ================================================
// TASK ACTIONS
// ================================================

export const runTimerAction = internalAction({
  args: {
    taskId: v.id("tasks"),
    taskArgs: v.optional(v.any()),
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

// TODO, types are weird here. We take an any type and pass it to this action which imposes opinions.
// maybe ok?
export const runReplicateAction = internalAction({
  args: {
    taskId: v.id("tasks"),
    taskArgs: v.object({
      model: v.string(),
      input: v.object({
        prompt: v.string(),
      }),
    }),
  },
  handler: async (ctx, args) => {
    console.log(`Starting replicate action for task: ${args.taskId}`);
    
    await ctx.runMutation(internal.tasks.updateTaskStatus, {
      taskId: args.taskId,
      status: "RUNNING",
      progress: 0,
    });

    try {
      const replicate = new Replicate();
      const onProgress = (prediction: Prediction) => {
        console.log({ prediction });
      };
      
      const output = await replicate.run(args.taskArgs.model as ReplicateModel, { input: args.taskArgs.input }, onProgress);
      console.log("OUTPUT", { output });
      
      if (output) {
        const videoUrl = output.toString();
        console.log("Video URL:", videoUrl);
        
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        const videoBlob = await response.blob();
        const storageId = await ctx.storage.store(videoBlob);

        await ctx.runMutation(internal.tasks.createGeneration, {
          taskId: args.taskId,
          storageId: storageId,
          metadata: {
            model: args.taskArgs.model,
            input: args.taskArgs.input,
            originalUrl: videoUrl,
          },
        });
        
        await ctx.runMutation(internal.tasks.updateTaskStatus, {
          taskId: args.taskId,
          status: "COMPLETED",
          progress: 100,
        });
        console.log(`Video stored with ID: ${storageId}`);
      } else {
        throw new Error("No video output received from Replicate");
      }
    } catch (error) {
      console.error("Replicate action failed:", error);
      await ctx.runMutation(internal.tasks.updateTaskStatus, {
        taskId: args.taskId,
        status: "FAILED",
        progress: -1,
      });
    }
  },
});

export const createGeneration = internalMutation({
  args: {
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    
    await ctx.db.insert("video_generations", {
      task_id: args.taskId,
      storage_id: args.storageId,
      metadata: args.metadata,
      user_id: userId,
      created_at: Date.now(),
    });
  },
});

export const getVideoUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const videoUrl = await ctx.storage.getUrl(args.storageId);
    return videoUrl;
  },
});
