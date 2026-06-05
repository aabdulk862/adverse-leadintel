// Unit tests for src/lib/orchestrator/pipeline.js
// Validates: Requirements 1.3, 1.4, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../orchestrator/db.js", () => ({
  supabaseAdmin: {},
  createPipelineRun: vi.fn(),
  updatePipelineRun: vi.fn(),
  getPipelineRun: vi.fn(),
  createTasks: vi.fn(),
  updateTask: vi.fn(),
  getTasksByPipeline: vi.fn(),
}));

vi.mock("../agents/registry.js", () => ({
  getRoleById: vi.fn(),
}));

vi.mock("../agents/session.js", () => ({
  createSession: vi.fn(),
  executeSession: vi.fn(),
}));

vi.mock("../agents/contracts.js", () => ({
  validateTransfer: vi.fn(() => ({ valid: true })),
}));

import {
  createPipeline,
  executePipeline,
  resumePipeline,
  getNextExecutableTasks,
  validateDependencyGraph,
} from "../orchestrator/pipeline.js";

import {
  createPipelineRun,
  updatePipelineRun,
  getPipelineRun,
  createTasks,
  updateTask,
  getTasksByPipeline,
} from "../orchestrator/db.js";

import { getRoleById } from "../agents/registry.js";
import { createSession, executeSession } from "../agents/session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTasks(overrides = []) {
  return [
    {
      _temp_id: "__task_0",
      name: "Plan scope",
      agent_role_id: "role-planner",
      depends_on: [],
      input_data: { goal: "test" },
    },
    {
      _temp_id: "__task_1",
      name: "Research data",
      agent_role_id: "role-research",
      depends_on: ["__task_0"],
      input_data: { query: "test" },
    },
    ...overrides,
  ];
}

function makeDbTasks(pipelineId, statuses = ["pending", "pending"]) {
  return [
    {
      id: "task-uuid-1",
      pipeline_id: pipelineId,
      agent_role_id: "role-planner",
      name: "Plan scope",
      status: statuses[0],
      input_data: { goal: "test" },
      output_data: statuses[0] === "completed" ? { plan: [] } : null,
      depends_on: [],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "task-uuid-2",
      pipeline_id: pipelineId,
      agent_role_id: "role-research",
      name: "Research data",
      status: statuses[1],
      input_data: { query: "test" },
      output_data: statuses[1] === "completed" ? { findings: [] } : null,
      depends_on: ["task-uuid-1"],
      created_at: "2024-01-01T00:00:01Z",
      updated_at: "2024-01-01T00:00:01Z",
    },
  ];
}

const mockRole = {
  id: "role-planner",
  name: "Planner",
  role_type: "planner",
  system_prompt: "You are a planner.",
  input_schema: { type: "object", properties: { goal: { type: "string" } } },
  output_schema: {
    type: "object",
    properties: { plan: { type: "array" }, summary: { type: "string" } },
    required: ["plan", "summary"],
  },
};

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// validateDependencyGraph
// ---------------------------------------------------------------------------

describe("validateDependencyGraph", () => {
  it("returns valid for an empty task array", () => {
    expect(validateDependencyGraph([])).toEqual({ valid: true });
  });

  it("returns valid for tasks with no dependencies", () => {
    const tasks = [
      { id: "a", depends_on: [] },
      { id: "b", depends_on: [] },
    ];
    expect(validateDependencyGraph(tasks)).toEqual({ valid: true });
  });

  it("returns valid for a linear dependency chain", () => {
    const tasks = [
      { id: "a", depends_on: [] },
      { id: "b", depends_on: ["a"] },
      { id: "c", depends_on: ["b"] },
    ];
    expect(validateDependencyGraph(tasks)).toEqual({ valid: true });
  });

  it("detects a simple cycle (A → B → A)", () => {
    const tasks = [
      { id: "a", depends_on: ["b"] },
      { id: "b", depends_on: ["a"] },
    ];
    const result = validateDependencyGraph(tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cycle");
  });

  it("detects a transitive cycle (A → B → C → A)", () => {
    const tasks = [
      { id: "a", depends_on: ["c"] },
      { id: "b", depends_on: ["a"] },
      { id: "c", depends_on: ["b"] },
    ];
    const result = validateDependencyGraph(tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cycle");
  });

  it("detects a reference to an unknown task ID", () => {
    const tasks = [{ id: "a", depends_on: ["nonexistent"] }];
    const result = validateDependencyGraph(tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("unknown task ID");
  });

  it("handles tasks using _temp_id instead of id", () => {
    const tasks = [
      { _temp_id: "t0", name: "A", depends_on: [] },
      { _temp_id: "t1", name: "B", depends_on: ["t0"] },
    ];
    expect(validateDependencyGraph(tasks)).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// createPipeline
// ---------------------------------------------------------------------------

describe("createPipeline", () => {
  it("returns error for empty tasks array", async () => {
    const result = await createPipeline([], "test summary");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for missing requestSummary", async () => {
    const result = await createPipeline([{ name: "task" }], "");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("creates a pipeline run and tasks successfully", async () => {
    const pipelineRun = {
      id: "pipeline-1",
      request_summary: "test",
      status: "pending",
    };
    createPipelineRun.mockResolvedValue({ data: pipelineRun, error: null });
    createTasks.mockResolvedValue({
      data: [
        { id: "real-uuid-1", name: "Plan scope", status: "pending" },
        { id: "real-uuid-2", name: "Research data", status: "pending" },
      ],
      error: null,
    });

    const tasks = makeTasks();
    const result = await createPipeline(tasks, "Run an audit");

    expect(result.error).toBeNull();
    expect(result.data.id).toBe("pipeline-1");
    expect(result.data.tasks).toHaveLength(2);
    expect(createPipelineRun).toHaveBeenCalledWith({
      request_summary: "Run an audit",
      status: "pending",
    });
    expect(createTasks).toHaveBeenCalledTimes(1);

    // Verify temp IDs were replaced with real UUIDs in depends_on
    const taskRecords = createTasks.mock.calls[0][0];
    expect(taskRecords[0].depends_on).toEqual([]);
    // Second task should have a UUID (not a temp ID) in depends_on
    expect(taskRecords[1].depends_on[0]).not.toContain("__task");
    expect(taskRecords[1].depends_on[0]).not.toContain("__temp");
  });

  it("returns error when createPipelineRun fails", async () => {
    createPipelineRun.mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "DB_ERROR" },
    });

    const result = await createPipeline(makeTasks(), "test");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("PIPELINE_CREATE_ERROR");
  });

  it("returns error when createTasks fails", async () => {
    createPipelineRun.mockResolvedValue({
      data: { id: "pipeline-1", status: "pending" },
      error: null,
    });
    createTasks.mockResolvedValue({
      data: null,
      error: { message: "Insert failed", code: "INSERT_ERROR" },
    });

    const result = await createPipeline(makeTasks(), "test");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("TASKS_CREATE_ERROR");
  });
});

// ---------------------------------------------------------------------------
// getNextExecutableTasks
// ---------------------------------------------------------------------------

describe("getNextExecutableTasks", () => {
  it("returns error for invalid pipelineId", async () => {
    const result = await getNextExecutableTasks("");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns tasks with no dependencies when all are pending", async () => {
    const tasks = makeDbTasks("pipeline-1", ["pending", "pending"]);
    getTasksByPipeline.mockResolvedValue({ data: tasks, error: null });

    const result = await getNextExecutableTasks("pipeline-1");
    expect(result.error).toBeNull();
    // Only the first task (no dependencies) should be executable
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Plan scope");
  });

  it("returns dependent task when its dependency is completed", async () => {
    const tasks = makeDbTasks("pipeline-1", ["completed", "pending"]);
    getTasksByPipeline.mockResolvedValue({ data: tasks, error: null });

    const result = await getNextExecutableTasks("pipeline-1");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Research data");
  });

  it("returns empty array when all tasks are completed", async () => {
    const tasks = makeDbTasks("pipeline-1", ["completed", "completed"]);
    getTasksByPipeline.mockResolvedValue({ data: tasks, error: null });

    const result = await getNextExecutableTasks("pipeline-1");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("returns empty array when pending tasks have unmet dependencies", async () => {
    // Task 1 is in_progress, task 2 depends on task 1
    const tasks = [
      { ...makeDbTasks("p1")[0], status: "in_progress" },
      { ...makeDbTasks("p1")[1], status: "pending" },
    ];
    getTasksByPipeline.mockResolvedValue({ data: tasks, error: null });

    const result = await getNextExecutableTasks("p1");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// executePipeline
// ---------------------------------------------------------------------------

describe("executePipeline", () => {
  it("returns error for invalid pipelineId", async () => {
    const result = await executePipeline("");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("detects cyclic dependencies and fails the pipeline", async () => {
    updatePipelineRun.mockResolvedValue({ data: {}, error: null });
    getTasksByPipeline.mockResolvedValue({
      data: [
        { id: "a", depends_on: ["b"], status: "pending" },
        { id: "b", depends_on: ["a"], status: "pending" },
      ],
      error: null,
    });

    const result = await executePipeline("pipeline-1");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_DEPENDENCY_GRAPH");
    // Pipeline should be marked as failed
    expect(updatePipelineRun).toHaveBeenCalledWith("pipeline-1", {
      status: "failed",
    });
  });

  it("executes tasks in dependency order and completes pipeline", async () => {
    // Setup: pipeline with 2 tasks, linear dependency
    const pipelineId = "pipeline-exec";
    let taskStatuses = { "task-1": "pending", "task-2": "pending" };

    updatePipelineRun.mockResolvedValue({ data: {}, error: null });

    // First call: return all tasks for cycle validation
    // Subsequent calls: return tasks with updated statuses
    let getTasksCallCount = 0;
    getTasksByPipeline.mockImplementation(async () => {
      getTasksCallCount++;
      return {
        data: [
          {
            id: "task-1",
            pipeline_id: pipelineId,
            agent_role_id: "role-planner",
            name: "Plan",
            status: taskStatuses["task-1"],
            input_data: { goal: "test" },
            output_data:
              taskStatuses["task-1"] === "completed" ? { plan: [] } : null,
            depends_on: [],
          },
          {
            id: "task-2",
            pipeline_id: pipelineId,
            agent_role_id: "role-research",
            name: "Research",
            status: taskStatuses["task-2"],
            input_data: { query: "test" },
            output_data:
              taskStatuses["task-2"] === "completed" ? { findings: [] } : null,
            depends_on: ["task-1"],
          },
        ],
        error: null,
      };
    });

    updateTask.mockImplementation(async (id, updates) => {
      if (updates.status) {
        taskStatuses[id] = updates.status;
      }
      return { data: { id, ...updates }, error: null };
    });

    getRoleById.mockResolvedValue(mockRole);
    createSession.mockReturnValue({ id: "session-1", agent_role: mockRole });
    executeSession.mockResolvedValue({
      success: true,
      output: { plan: [], summary: "done" },
      session: {},
    });

    getPipelineRun.mockResolvedValue({
      data: { id: pipelineId, status: "completed" },
      error: null,
    });

    const result = await executePipeline(pipelineId);

    // Pipeline should transition to in_progress first
    expect(updatePipelineRun).toHaveBeenCalledWith(pipelineId, {
      status: "in_progress",
    });
    // Both tasks should have been executed
    expect(executeSession).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
  });

  it("marks task and dependents as failed on task failure", async () => {
    const pipelineId = "pipeline-fail";
    let taskStatuses = { "task-1": "pending", "task-2": "pending" };

    updatePipelineRun.mockResolvedValue({ data: {}, error: null });

    getTasksByPipeline.mockImplementation(async () => ({
      data: [
        {
          id: "task-1",
          pipeline_id: pipelineId,
          agent_role_id: "role-planner",
          name: "Plan",
          status: taskStatuses["task-1"],
          input_data: { goal: "test" },
          depends_on: [],
        },
        {
          id: "task-2",
          pipeline_id: pipelineId,
          agent_role_id: "role-research",
          name: "Research",
          status: taskStatuses["task-2"],
          input_data: { query: "test" },
          depends_on: ["task-1"],
        },
      ],
      error: null,
    }));

    updateTask.mockImplementation(async (id, updates) => {
      if (updates.status) {
        taskStatuses[id] = updates.status;
      }
      return { data: { id, ...updates }, error: null };
    });

    getRoleById.mockResolvedValue(mockRole);
    createSession.mockReturnValue({ id: "session-1", agent_role: mockRole });
    // First task fails
    executeSession.mockResolvedValue({
      success: false,
      error: "Agent execution failed",
      session: {},
    });

    getPipelineRun.mockResolvedValue({
      data: { id: pipelineId, status: "failed" },
      error: null,
    });

    const result = await executePipeline(pipelineId);

    // Task 1 should be marked as failed
    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "failed" }),
    );
    // Task 2 (dependent) should also be marked as failed via propagation
    expect(updateTask).toHaveBeenCalledWith("task-2", { status: "failed" });
    // Pipeline should be marked as failed
    expect(updatePipelineRun).toHaveBeenCalledWith(pipelineId, {
      status: "failed",
    });
  });
});

// ---------------------------------------------------------------------------
// resumePipeline
// ---------------------------------------------------------------------------

describe("resumePipeline", () => {
  it("returns error for invalid pipelineId", async () => {
    const result = await resumePipeline("");
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns immediately for a completed pipeline", async () => {
    getPipelineRun.mockResolvedValue({
      data: { id: "p1", status: "completed" },
      error: null,
    });

    const result = await resumePipeline("p1");
    expect(result.error).toBeNull();
    expect(result.data.status).toBe("completed");
    // Should not attempt to execute any tasks
    expect(executeSession).not.toHaveBeenCalled();
  });

  it("skips completed tasks and resumes from pending tasks", async () => {
    const pipelineId = "pipeline-resume";
    let taskStatuses = { "task-1": "completed", "task-2": "pending" };

    getPipelineRun.mockResolvedValue({
      data: { id: pipelineId, status: "in_progress" },
      error: null,
    });

    updatePipelineRun.mockResolvedValue({ data: {}, error: null });

    getTasksByPipeline.mockImplementation(async () => ({
      data: [
        {
          id: "task-1",
          pipeline_id: pipelineId,
          agent_role_id: "role-planner",
          name: "Plan",
          status: taskStatuses["task-1"],
          input_data: { goal: "test" },
          output_data: { plan: [] },
          depends_on: [],
        },
        {
          id: "task-2",
          pipeline_id: pipelineId,
          agent_role_id: "role-research",
          name: "Research",
          status: taskStatuses["task-2"],
          input_data: { query: "test" },
          output_data: null,
          depends_on: ["task-1"],
        },
      ],
      error: null,
    }));

    updateTask.mockImplementation(async (id, updates) => {
      if (updates.status) {
        taskStatuses[id] = updates.status;
      }
      return { data: { id, ...updates }, error: null };
    });

    getRoleById.mockResolvedValue(mockRole);
    createSession.mockReturnValue({ id: "session-1", agent_role: mockRole });
    executeSession.mockResolvedValue({
      success: true,
      output: { findings: [], summary: "done" },
      session: {},
    });

    const result = await resumePipeline(pipelineId);

    // Only the second task should have been executed (first was already completed)
    expect(executeSession).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });
});
