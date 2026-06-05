// ---------------------------------------------------------------------------
// Pipeline Execution Engine
// ---------------------------------------------------------------------------
// Manages pipeline creation, execution in dependency order, resumption from
// last completed task, and failure propagation.
// ---------------------------------------------------------------------------
// Requirements: 1.3, 1.4, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5

import crypto from "crypto";
import {
  createPipelineRun,
  updatePipelineRun,
  getPipelineRun,
  createTasks,
  updateTask,
  getTasksByPipeline,
} from "./db.js";
import { getRoleById } from "../agents/registry.js";
import { createSession, executeSession } from "../agents/session.js";

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Validates that the dependency graph formed by tasks is acyclic.
 * Uses Kahn's algorithm (topological sort via in-degree counting).
 *
 * @param {object[]} tasks - Array of task objects with `id` and `depends_on`
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDependencyGraph(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { valid: true };
  }

  const taskIds = new Set(tasks.map((t) => t.id || t._temp_id));

  // Verify all dependency references point to tasks within the pipeline
  for (const task of tasks) {
    const deps = task.depends_on || [];
    for (const dep of deps) {
      if (!taskIds.has(dep)) {
        return {
          valid: false,
          error: `Task "${task.name || task.id}" depends on unknown task ID "${dep}"`,
        };
      }
    }
  }

  // Build adjacency list and in-degree map
  const inDegree = new Map();
  const adjacency = new Map();

  for (const task of tasks) {
    const id = task.id || task._temp_id;
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const task of tasks) {
    const id = task.id || task._temp_id;
    const deps = task.depends_on || [];
    for (const dep of deps) {
      adjacency.get(dep).push(id);
      inDegree.set(id, inDegree.get(id) + 1);
    }
  }

  // Kahn's algorithm
  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    processed += 1;

    for (const neighbor of adjacency.get(current)) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (processed !== tasks.length) {
    return {
      valid: false,
      error: "Dependency graph contains a cycle",
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// createPipeline
// ---------------------------------------------------------------------------

/**
 * Creates a new pipeline run and persists its tasks to Supabase.
 *
 * Steps:
 * 1. Create a pipeline_run record
 * 2. Replace temp task IDs with real UUIDs
 * 3. Create all tasks via createTasks
 * 4. Return the pipeline run with its tasks
 *
 * @param {object[]} tasks - Array of task objects (may have _temp_id references)
 * @param {string} requestSummary - Human-readable summary of the request
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createPipeline(tasks, requestSummary) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      data: null,
      error: {
        message: "createPipeline requires a non-empty array of tasks",
        code: "INVALID_INPUT",
      },
    };
  }

  if (
    !requestSummary ||
    typeof requestSummary !== "string" ||
    requestSummary.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message: "createPipeline requires a non-empty requestSummary string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // 1. Create the pipeline_run record
    const { data: pipelineRun, error: pipelineError } = await createPipelineRun(
      {
        request_summary: requestSummary,
        status: "pending",
      },
    );

    if (pipelineError) {
      return {
        data: null,
        error: {
          message: `Failed to create pipeline run: ${pipelineError.message}`,
          code: "PIPELINE_CREATE_ERROR",
        },
      };
    }

    // 2. Build a mapping from temp IDs to real UUIDs
    const tempToReal = new Map();
    for (const task of tasks) {
      const tempId = task._temp_id || task.id;
      if (tempId) {
        tempToReal.set(tempId, crypto.randomUUID());
      }
    }

    // 3. Build task records with real UUIDs and resolved dependencies
    const taskRecords = tasks.map((task) => {
      const tempId = task._temp_id || task.id;
      const realId = tempToReal.get(tempId) || crypto.randomUUID();

      const resolvedDeps = (task.depends_on || []).map((dep) => {
        return tempToReal.get(dep) || dep;
      });

      return {
        id: realId,
        pipeline_id: pipelineRun.id,
        agent_role_id: task.agent_role_id,
        name: task.name,
        status: "pending",
        input_data: task.input_data || null,
        output_data: null,
        depends_on: resolvedDeps,
      };
    });

    // 4. Persist all tasks
    const { data: createdTasks, error: tasksError } =
      await createTasks(taskRecords);

    if (tasksError) {
      return {
        data: null,
        error: {
          message: `Failed to create tasks: ${tasksError.message}`,
          code: "TASKS_CREATE_ERROR",
        },
      };
    }

    return {
      data: {
        ...pipelineRun,
        tasks: createdTasks,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `createPipeline failed: ${err.message}`,
        code: "UNEXPECTED_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// getNextExecutableTasks
// ---------------------------------------------------------------------------

/**
 * Returns tasks whose dependencies are all completed.
 * Fetches all tasks for the pipeline and filters to those with status
 * 'pending' whose depends_on tasks all have status 'completed'.
 *
 * @param {string} pipelineId - Pipeline run UUID
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function getNextExecutableTasks(pipelineId) {
  if (!pipelineId || typeof pipelineId !== "string") {
    return {
      data: null,
      error: {
        message: "getNextExecutableTasks requires a valid pipelineId string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    const { data: tasks, error } = await getTasksByPipeline(pipelineId);

    if (error) {
      return {
        data: null,
        error: {
          message: `Failed to fetch tasks: ${error.message}`,
          code: "TASKS_FETCH_ERROR",
        },
      };
    }

    // Build a status lookup by task ID
    const statusMap = new Map();
    for (const task of tasks) {
      statusMap.set(task.id, task.status);
    }

    // Filter to pending tasks whose dependencies are all completed
    const executable = tasks.filter((task) => {
      if (task.status !== "pending") return false;

      const deps = task.depends_on || [];
      return deps.every((depId) => statusMap.get(depId) === "completed");
    });

    return { data: executable, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `getNextExecutableTasks failed: ${err.message}`,
        code: "UNEXPECTED_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// executePipeline
// ---------------------------------------------------------------------------

/**
 * Executes a pipeline's tasks in dependency order.
 *
 * Steps:
 * 1. Update pipeline status to 'in_progress'
 * 2. Validate dependency graph is acyclic
 * 3. Loop: get next executable tasks, execute each, validate output, store
 * 4. On task failure: mark task + dependents as 'failed', update pipeline
 * 5. When all tasks complete: update pipeline to 'completed'
 *
 * @param {string} pipelineId - Pipeline run UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function executePipeline(pipelineId) {
  if (!pipelineId || typeof pipelineId !== "string") {
    return {
      data: null,
      error: {
        message: "executePipeline requires a valid pipelineId string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // 1. Update pipeline status to 'in_progress'
    const { error: statusError } = await updatePipelineRun(pipelineId, {
      status: "in_progress",
    });

    if (statusError) {
      return {
        data: null,
        error: {
          message: `Failed to update pipeline status: ${statusError.message}`,
          code: "STATUS_UPDATE_ERROR",
        },
      };
    }

    // Fetch all tasks for cycle validation
    const { data: allTasks, error: fetchError } =
      await getTasksByPipeline(pipelineId);
    if (fetchError) {
      return {
        data: null,
        error: {
          message: `Failed to fetch tasks: ${fetchError.message}`,
          code: "TASKS_FETCH_ERROR",
        },
      };
    }

    // 2. Validate dependency graph is acyclic
    const graphValidation = validateDependencyGraph(allTasks);
    if (!graphValidation.valid) {
      await updatePipelineRun(pipelineId, { status: "failed" });
      return {
        data: null,
        error: {
          message: `Pipeline dependency graph is invalid: ${graphValidation.error}`,
          code: "INVALID_DEPENDENCY_GRAPH",
        },
      };
    }

    // 3. Execute tasks in dependency order
    return await executeTaskLoop(pipelineId);
  } catch (err) {
    await updatePipelineRun(pipelineId, { status: "failed" }).catch(() => {});
    return {
      data: null,
      error: {
        message: `executePipeline failed: ${err.message}`,
        code: "UNEXPECTED_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// resumePipeline
// ---------------------------------------------------------------------------

/**
 * Resumes a previously started pipeline from the last completed task.
 * Skips tasks that are already completed and begins execution from the
 * first pending task whose dependencies are all met.
 *
 * @param {string} pipelineId - Pipeline run UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function resumePipeline(pipelineId) {
  if (!pipelineId || typeof pipelineId !== "string") {
    return {
      data: null,
      error: {
        message: "resumePipeline requires a valid pipelineId string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // Fetch the pipeline run
    const { data: pipeline, error: pipelineError } =
      await getPipelineRun(pipelineId);
    if (pipelineError) {
      return {
        data: null,
        error: {
          message: `Failed to fetch pipeline: ${pipelineError.message}`,
          code: "PIPELINE_FETCH_ERROR",
        },
      };
    }

    // If pipeline is already completed or cancelled, nothing to do
    if (pipeline.status === "completed" || pipeline.status === "cancelled") {
      return {
        data: pipeline,
        error: null,
      };
    }

    // Update pipeline status to 'in_progress' if not already
    if (pipeline.status !== "in_progress") {
      await updatePipelineRun(pipelineId, { status: "in_progress" });
    }

    // Execute from where we left off
    return await executeTaskLoop(pipelineId);
  } catch (err) {
    return {
      data: null,
      error: {
        message: `resumePipeline failed: ${err.message}`,
        code: "UNEXPECTED_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: executeTaskLoop
// ---------------------------------------------------------------------------

/**
 * Core execution loop shared by executePipeline and resumePipeline.
 * Repeatedly fetches the next executable tasks and processes them until
 * no more tasks are available or a failure occurs.
 *
 * @param {string} pipelineId - Pipeline run UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
async function executeTaskLoop(pipelineId) {
  let hasFailure = false;

  while (true) {
    const { data: executableTasks, error: nextError } =
      await getNextExecutableTasks(pipelineId);

    if (nextError) {
      return {
        data: null,
        error: {
          message: `Failed to get next tasks: ${nextError.message}`,
          code: "NEXT_TASKS_ERROR",
        },
      };
    }

    // No more executable tasks — check if we're done or stuck
    if (!executableTasks || executableTasks.length === 0) {
      break;
    }

    // Execute each available task
    for (const task of executableTasks) {
      const result = await executeTask(task, pipelineId);

      if (!result.success) {
        hasFailure = true;
        // Propagate failure to dependent tasks
        await propagateFailure(task.id, pipelineId);
        break;
      }
    }

    if (hasFailure) {
      break;
    }
  }

  // Determine final pipeline status
  const { data: finalTasks } = await getTasksByPipeline(pipelineId);
  const allCompleted =
    finalTasks && finalTasks.every((t) => t.status === "completed");
  const anyFailed = finalTasks && finalTasks.some((t) => t.status === "failed");

  if (anyFailed) {
    await updatePipelineRun(pipelineId, { status: "failed" });
  } else if (allCompleted) {
    await updatePipelineRun(pipelineId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  }

  const { data: finalPipeline } = await getPipelineRun(pipelineId);
  return { data: finalPipeline, error: null };
}

// ---------------------------------------------------------------------------
// Internal: executeTask
// ---------------------------------------------------------------------------

/**
 * Executes a single task: creates an agent session, runs it, validates
 * output, and updates the task record.
 *
 * @param {object} task - The task object to execute
 * @param {string} pipelineId - Pipeline run UUID (for context)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function executeTask(task, pipelineId) {
  try {
    // Update task status to 'in_progress'
    await updateTask(task.id, { status: "in_progress" });

    // Fetch the agent role for this task
    const agentRole = await getRoleById(task.agent_role_id);

    // Build task input including any upstream output data
    const taskInput = {
      task_id: task.id,
      ...(task.input_data || {}),
    };

    // Create and execute an agent session
    const session = createSession(agentRole, taskInput);
    const result = await executeSession(session);

    if (!result.success) {
      // Mark task as failed
      await updateTask(task.id, {
        status: "failed",
        output_data: { error: result.error },
      });
      return { success: false, error: result.error };
    }

    // Update task with output data and mark as completed
    await updateTask(task.id, {
      status: "completed",
      output_data: result.output || null,
    });

    return { success: true };
  } catch (err) {
    // Mark task as failed on unexpected error
    await updateTask(task.id, {
      status: "failed",
      output_data: { error: err.message },
    }).catch(() => {});

    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Internal: propagateFailure
// ---------------------------------------------------------------------------

/**
 * When a task fails, marks all tasks that directly or transitively depend
 * on it as 'failed' and updates the pipeline status.
 *
 * @param {string} failedTaskId - The ID of the task that failed
 * @param {string} pipelineId - Pipeline run UUID
 */
async function propagateFailure(failedTaskId, pipelineId) {
  try {
    const { data: allTasks } = await getTasksByPipeline(pipelineId);
    if (!allTasks) return;

    // Build a set of all tasks that depend (directly or transitively) on the failed task
    const failedSet = new Set([failedTaskId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const task of allTasks) {
        if (failedSet.has(task.id)) continue;
        const deps = task.depends_on || [];
        if (deps.some((dep) => failedSet.has(dep))) {
          failedSet.add(task.id);
          changed = true;
        }
      }
    }

    // Remove the original failed task (already marked) and mark dependents
    failedSet.delete(failedTaskId);

    for (const taskId of failedSet) {
      const task = allTasks.find((t) => t.id === taskId);
      if (task && task.status !== "completed" && task.status !== "failed") {
        await updateTask(taskId, { status: "failed" });
      }
    }
  } catch (err) {
    // Best-effort failure propagation — log but don't throw
    console.error("Failed to propagate task failure:", err.message);
  }
}
