import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the registry module so we don't hit Supabase
// ---------------------------------------------------------------------------

const mockRoles = {
  planner: {
    id: "role-planner-uuid",
    name: "Planner",
    role_type: "planner",
    status: "active",
  },
  research: {
    id: "role-research-uuid",
    name: "Research",
    role_type: "research",
    status: "active",
  },
  builder: {
    id: "role-builder-uuid",
    name: "Builder",
    role_type: "builder",
    status: "active",
  },
  audit: {
    id: "role-audit-uuid",
    name: "Audit",
    role_type: "audit",
    status: "active",
  },
  automation: {
    id: "role-automation-uuid",
    name: "Automation",
    role_type: "automation",
    status: "active",
  },
};

vi.mock("../agents/registry.js", () => ({
  getRoleByType: vi.fn(async (roleType) => {
    const role = mockRoles[roleType];
    if (!role) throw new Error(`No active role for type "${roleType}"`);
    return role;
  }),
  getActiveRoles: vi.fn(async () => Object.values(mockRoles)),
}));

vi.mock("../orchestrator/db.js", () => ({
  getPipelineRun: vi.fn(),
  getTasksByPipeline: vi.fn(),
  getArtifacts: vi.fn(),
}));

import {
  classifyIntent,
  decomposeRequest,
  synthesizeResults,
  INTENT_KEYWORDS,
  VALID_INTENTS,
} from "../orchestrator/index.js";

import { getPipelineRun, getTasksByPipeline } from "../orchestrator/db.js";

// ---------------------------------------------------------------------------
// classifyIntent
// ---------------------------------------------------------------------------

describe("classifyIntent", () => {
  it("returns structured error for empty string", async () => {
    const result = await classifyIntent("");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns structured error for null input", async () => {
    const result = await classifyIntent(null);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns structured error for undefined input", async () => {
    const result = await classifyIntent(undefined);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns structured error for non-string input", async () => {
    const result = await classifyIntent(42);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it('classifies "build" intent from keyword', async () => {
    const result = await classifyIntent("build a landing page");
    expect(result.error).toBeNull();
    expect(result.data).toBe("build");
  });

  it('classifies "research" intent from keyword', async () => {
    const result = await classifyIntent("research competitor pricing");
    expect(result.error).toBeNull();
    expect(result.data).toBe("research");
  });

  it('classifies "audit" intent from keyword', async () => {
    const result = await classifyIntent("audit the client operations");
    expect(result.error).toBeNull();
    expect(result.data).toBe("audit");
  });

  it('classifies "automate" intent from keyword', async () => {
    const result = await classifyIntent("automate the email workflow");
    expect(result.error).toBeNull();
    expect(result.data).toBe("automate");
  });

  it('classifies "plan" intent from keyword', async () => {
    const result = await classifyIntent("plan the project roadmap");
    expect(result.error).toBeNull();
    expect(result.data).toBe("plan");
  });

  it('defaults to "plan" when no keywords match', async () => {
    const result = await classifyIntent("xyzzy foobar baz");
    expect(result.error).toBeNull();
    expect(result.data).toBe("plan");
  });

  it("always returns one of the five valid intents", async () => {
    const inputs = [
      "build something",
      "research this topic",
      "audit the business",
      "automate the process",
      "plan the strategy",
      "random gibberish text",
    ];
    for (const input of inputs) {
      const result = await classifyIntent(input);
      expect(result.error).toBeNull();
      expect(VALID_INTENTS).toContain(result.data);
    }
  });

  it("picks the intent with the most keyword matches", async () => {
    // "build" has: build, create, code → 3 matches
    // "plan" has: plan → 1 match
    const result = await classifyIntent(
      "build and create some code with a plan",
    );
    expect(result.error).toBeNull();
    expect(result.data).toBe("build");
  });
});

// ---------------------------------------------------------------------------
// decomposeRequest
// ---------------------------------------------------------------------------

describe("decomposeRequest", () => {
  it("returns structured error for empty request text", async () => {
    const result = await decomposeRequest("", "build");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns structured error for invalid intent", async () => {
    const result = await decomposeRequest("do something", "invalid_intent");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INTENT");
  });

  it('decomposes a "build" request into tasks with correct roles', async () => {
    const result = await decomposeRequest("build a landing page", "build");
    expect(result.error).toBeNull();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    // Every task should have an agent_role_id from the mock roles
    const validRoleIds = Object.values(mockRoles).map((r) => r.id);
    for (const task of result.data) {
      expect(task).toHaveProperty("name");
      expect(task).toHaveProperty("agent_role_id");
      expect(task).toHaveProperty("depends_on");
      expect(task).toHaveProperty("input_data");
      expect(validRoleIds).toContain(task.agent_role_id);
    }
  });

  it('decomposes a "research" request into tasks', async () => {
    const result = await decomposeRequest(
      "research competitor pricing",
      "research",
    );
    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('decomposes an "audit" request into 4 tasks', async () => {
    const result = await decomposeRequest("audit the client business", "audit");
    expect(result.error).toBeNull();
    expect(result.data.length).toBe(4);

    // Verify the role assignments match the audit pipeline template
    expect(result.data[0].agent_role_id).toBe(mockRoles.planner.id);
    expect(result.data[1].agent_role_id).toBe(mockRoles.research.id);
    expect(result.data[2].agent_role_id).toBe(mockRoles.audit.id);
    expect(result.data[3].agent_role_id).toBe(mockRoles.planner.id);
  });

  it('decomposes an "automate" request into tasks', async () => {
    const result = await decomposeRequest("automate email sending", "automate");
    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('decomposes a "plan" request into tasks', async () => {
    const result = await decomposeRequest("plan the Q4 strategy", "plan");
    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("tasks have dependency ordering (later tasks depend on earlier ones)", async () => {
    const result = await decomposeRequest("build a website", "build");
    expect(result.error).toBeNull();

    // First task should have no dependencies
    expect(result.data[0].depends_on).toEqual([]);

    // Subsequent tasks should reference earlier task temp IDs
    if (result.data.length > 1) {
      expect(result.data[1].depends_on.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// synthesizeResults
// ---------------------------------------------------------------------------

describe("synthesizeResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured error for empty pipelineId", async () => {
    const result = await synthesizeResults("");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns structured error for null pipelineId", async () => {
    const result = await synthesizeResults(null);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error when pipeline fetch fails", async () => {
    getPipelineRun.mockResolvedValue({
      data: null,
      error: { message: "Not found", code: "NOT_FOUND" },
    });

    const result = await synthesizeResults("pipeline-123");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("PIPELINE_FETCH_ERROR");
  });

  it("returns error when tasks fetch fails", async () => {
    getPipelineRun.mockResolvedValue({
      data: {
        id: "pipeline-123",
        request_summary: "test",
        status: "completed",
        created_at: "2024-01-01",
      },
      error: null,
    });
    getTasksByPipeline.mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "DB_ERROR" },
    });

    const result = await synthesizeResults("pipeline-123");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("TASKS_FETCH_ERROR");
  });

  it("synthesizes results from a completed pipeline", async () => {
    const mockPipeline = {
      id: "pipeline-123",
      request_summary: "Build a landing page",
      status: "completed",
      created_at: "2024-01-01T00:00:00Z",
      completed_at: "2024-01-01T01:00:00Z",
    };

    const mockTasks = [
      {
        id: "task-1",
        name: "Plan implementation",
        status: "completed",
        agent_role_id: "role-planner-uuid",
        output_data: {
          plan: [{ step: 1, description: "Design layout" }],
          summary: "Plan ready",
        },
      },
      {
        id: "task-2",
        name: "Build deliverable",
        status: "completed",
        agent_role_id: "role-builder-uuid",
        output_data: { content: "<html>...</html>", format: "html" },
      },
    ];

    getPipelineRun.mockResolvedValue({ data: mockPipeline, error: null });
    getTasksByPipeline.mockResolvedValue({ data: mockTasks, error: null });

    const result = await synthesizeResults("pipeline-123");
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data.pipeline_id).toBe("pipeline-123");
    expect(result.data.request_summary).toBe("Build a landing page");
    expect(result.data.total_tasks).toBe(2);
    expect(result.data.completed_tasks).toBe(2);
    expect(result.data.failed_tasks).toBe(0);
    expect(result.data.artifacts).toHaveLength(2);
    expect(result.data.artifacts[0].task_name).toBe("Plan implementation");
    expect(result.data.artifacts[1].task_name).toBe("Build deliverable");
  });

  it("handles tasks with no output_data", async () => {
    getPipelineRun.mockResolvedValue({
      data: {
        id: "p-1",
        request_summary: "test",
        status: "completed",
        created_at: "2024-01-01",
      },
      error: null,
    });
    getTasksByPipeline.mockResolvedValue({
      data: [
        {
          id: "t-1",
          name: "Task 1",
          status: "completed",
          agent_role_id: "r-1",
          output_data: null,
        },
        {
          id: "t-2",
          name: "Task 2",
          status: "failed",
          agent_role_id: "r-2",
          output_data: null,
        },
      ],
      error: null,
    });

    const result = await synthesizeResults("p-1");
    expect(result.error).toBeNull();
    expect(result.data.artifacts).toHaveLength(0);
    expect(result.data.completed_tasks).toBe(1);
    expect(result.data.failed_tasks).toBe(1);
  });
});
