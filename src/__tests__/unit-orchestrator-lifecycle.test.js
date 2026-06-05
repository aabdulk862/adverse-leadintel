import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock roles
// ---------------------------------------------------------------------------

const mockRoles = {
  planner: {
    id: "role-planner-uuid",
    name: "Planner",
    role_type: "planner",
    status: "active",
    output_schema: {
      type: "object",
      properties: { plan: { type: "array" }, summary: { type: "string" } },
      required: ["plan", "summary"],
    },
  },
  research: {
    id: "role-research-uuid",
    name: "Research",
    role_type: "research",
    status: "active",
    output_schema: {
      type: "object",
      properties: { findings: { type: "array" }, summary: { type: "string" } },
      required: ["findings", "summary"],
    },
  },
  builder: {
    id: "role-builder-uuid",
    name: "Builder",
    role_type: "builder",
    status: "active",
    output_schema: {
      type: "object",
      properties: { content: { type: "string" }, format: { type: "string" } },
      required: ["content", "format"],
    },
  },
  audit: {
    id: "role-audit-uuid",
    name: "Audit",
    role_type: "audit",
    status: "active",
    output_schema: {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        categories: { type: "array" },
      },
      required: ["executive_summary", "categories"],
    },
  },
  automation: {
    id: "role-automation-uuid",
    name: "Automation",
    role_type: "automation",
    status: "active",
    output_schema: {
      type: "object",
      properties: {
        workflow_definition: { type: "object" },
        description: { type: "string" },
      },
      required: ["workflow_definition", "description"],
    },
  },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("../orchestrator/pipeline.js", () => ({
  createPipeline: vi.fn(),
  executePipeline: vi.fn(),
}));

vi.mock("../orchestrator/alignment.js", () => ({
  formatAlignmentCheck: vi.fn(() => "Mocked alignment check text"),
}));

vi.mock("../orchestrator/n8n.js", () => ({
  createWorkflow: vi.fn(),
  activateWorkflow: vi.fn(),
}));

vi.mock("../agents/contracts.js", () => ({
  validateAgainstSchema: vi.fn(() => ({ valid: true })),
  validateTransfer: vi.fn(() => ({ valid: true })),
  transformData: vi.fn((data) => data),
  logTransfer: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
}));

import {
  orchestrate,
  executeApprovedPipeline,
  handleAlignmentRejection,
} from "../orchestrator/index.js";

import {
  createPipeline,
  executePipeline,
} from "../orchestrator/pipeline.js";
import { formatAlignmentCheck } from "../orchestrator/alignment.js";
import { getPipelineRun, getTasksByPipeline } from "../orchestrator/db.js";
import { createWorkflow, activateWorkflow } from "../orchestrator/n8n.js";
import { getActiveRoles } from "../agents/registry.js";

// ---------------------------------------------------------------------------
// orchestrate
// ---------------------------------------------------------------------------

describe("orchestrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty string", async () => {
    const result = await orchestrate("");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for null input", async () => {
    const result = await orchestrate(null);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for non-string input", async () => {
    const result = await orchestrate(123);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("classifies intent, decomposes, and returns alignment check", async () => {
    const result = await orchestrate("build a landing page");

    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data.intent).toBe("build");
    expect(result.data.tasks).toBeInstanceOf(Array);
    expect(result.data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(result.data.roles).toBeInstanceOf(Array);
    expect(result.data.roles.length).toBe(5);
    expect(result.data.alignmentCheck).toBe("Mocked alignment check text");
    expect(result.data.requestText).toBe("build a landing page");
  });

  it("calls formatAlignmentCheck with tasks and roles", async () => {
    await orchestrate("research competitor pricing");

    expect(formatAlignmentCheck).toHaveBeenCalledTimes(1);
    const [tasks, roles] = formatAlignmentCheck.mock.calls[0];
    expect(tasks).toBeInstanceOf(Array);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(roles).toBeInstanceOf(Array);
  });

  it("returns correct intent for audit requests", async () => {
    const result = await orchestrate("audit the client business operations");
    expect(result.error).toBeNull();
    expect(result.data.intent).toBe("audit");
    expect(result.data.tasks.length).toBe(4);
  });

  it("returns correct intent for outreach requests", async () => {
    const result = await orchestrate("outreach to prospect companies");
    expect(result.error).toBeNull();
    expect(result.data.intent).toBe("outreach");
    expect(result.data.tasks.length).toBe(3);
  });

  it("handles getActiveRoles failure gracefully", async () => {
    getActiveRoles.mockRejectedValueOnce(new Error("DB connection failed"));

    const result = await orchestrate("build something");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("ORCHESTRATION_ERROR");
    expect(result.error.message).toContain("DB connection failed");
  });
});

// ---------------------------------------------------------------------------
// executeApprovedPipeline
// ---------------------------------------------------------------------------

describe("executeApprovedPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty tasks array", async () => {
    const result = await executeApprovedPipeline([], "test");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for non-array tasks", async () => {
    const result = await executeApprovedPipeline("not-an-array", "test");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for empty requestSummary", async () => {
    const result = await executeApprovedPipeline([{ name: "task" }], "");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for null requestSummary", async () => {
    const result = await executeApprovedPipeline([{ name: "task" }], null);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("creates pipeline, executes, and synthesizes results", async () => {
    const mockTasks = [
      {
        name: "Plan",
        agent_role_id: "role-planner-uuid",
        depends_on: [],
        _temp_id: "__task_0",
      },
    ];

    createPipeline.mockResolvedValue({
      data: { id: "pipeline-123", tasks: mockTasks },
      error: null,
    });

    executePipeline.mockResolvedValue({
      data: { id: "pipeline-123", status: "completed" },
      error: null,
    });

    getPipelineRun.mockResolvedValue({
      data: {
        id: "pipeline-123",
        request_summary: "Build something",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T01:00:00Z",
      },
      error: null,
    });

    getTasksByPipeline.mockResolvedValue({
      data: [
        {
          id: "task-1",
          name: "Plan",
          status: "completed",
          agent_role_id: "role-planner-uuid",
          output_data: { plan: [], summary: "Done" },
        },
      ],
      error: null,
    });

    const result = await executeApprovedPipeline(mockTasks, "Build something");

    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data.pipeline_id).toBe("pipeline-123");
    expect(result.data.status).toBe("completed");
    expect(result.data.total_tasks).toBe(1);
    expect(result.data.completed_tasks).toBe(1);
    expect(createPipeline).toHaveBeenCalledWith(mockTasks, "Build something");
    expect(executePipeline).toHaveBeenCalledWith("pipeline-123");
  });

  it("returns error when createPipeline fails", async () => {
    createPipeline.mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "PIPELINE_CREATE_ERROR" },
    });

    const result = await executeApprovedPipeline(
      [{ name: "task" }],
      "test request",
    );

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("PIPELINE_CREATE_ERROR");
  });

  it("returns error when executePipeline fails", async () => {
    createPipeline.mockResolvedValue({
      data: { id: "pipeline-456", tasks: [] },
      error: null,
    });

    executePipeline.mockResolvedValue({
      data: null,
      error: { message: "Execution failed", code: "EXECUTION_ERROR" },
    });

    const result = await executeApprovedPipeline(
      [{ name: "task" }],
      "test request",
    );

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("EXECUTION_ERROR");
  });

  it("attempts n8n workflow creation for automation tasks", async () => {
    createPipeline.mockResolvedValue({
      data: { id: "pipeline-auto", tasks: [] },
      error: null,
    });

    executePipeline.mockResolvedValue({
      data: { id: "pipeline-auto", status: "completed" },
      error: null,
    });

    // synthesizeResults calls
    getPipelineRun.mockResolvedValue({
      data: {
        id: "pipeline-auto",
        request_summary: "Automate emails",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T01:00:00Z",
      },
      error: null,
    });

    // First call for synthesizeResults, second for maybeCreateN8nWorkflow
    getTasksByPipeline
      .mockResolvedValueOnce({
        data: [
          {
            id: "task-auto",
            name: "Define workflow",
            status: "completed",
            agent_role_id: "role-automation-uuid",
            output_data: {
              workflow_definition: {
                name: "Email Workflow",
                nodes: [
                  {
                    name: "Start",
                    type: "n8n-nodes-base.start",
                    position: [0, 0],
                    parameters: {},
                  },
                ],
                connections: {},
              },
              description: "Automated email workflow",
            },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "task-auto",
            name: "Define workflow",
            status: "completed",
            agent_role_id: "role-automation-uuid",
            output_data: {
              workflow_definition: {
                name: "Email Workflow",
                nodes: [
                  {
                    name: "Start",
                    type: "n8n-nodes-base.start",
                    position: [0, 0],
                    parameters: {},
                  },
                ],
                connections: {},
              },
              description: "Automated email workflow",
            },
          },
        ],
        error: null,
      });

    createWorkflow.mockResolvedValue({
      data: { id: "n8n-wf-1", name: "Email Workflow" },
      error: null,
    });

    activateWorkflow.mockResolvedValue({
      data: { id: "n8n-wf-1", active: true },
      error: null,
    });

    const result = await executeApprovedPipeline(
      [{ name: "Define workflow" }],
      "Automate emails",
    );

    expect(result.error).toBeNull();
    expect(result.data.n8n_workflow).toBeTruthy();
    expect(result.data.n8n_workflow.created).toBeTruthy();
    expect(createWorkflow).toHaveBeenCalled();
    expect(activateWorkflow).toHaveBeenCalledWith("n8n-wf-1");
  });

  it("returns null n8n_workflow when no automation task exists", async () => {
    createPipeline.mockResolvedValue({
      data: { id: "pipeline-plan", tasks: [] },
      error: null,
    });

    executePipeline.mockResolvedValue({
      data: { id: "pipeline-plan", status: "completed" },
      error: null,
    });

    getPipelineRun.mockResolvedValue({
      data: {
        id: "pipeline-plan",
        request_summary: "Plan something",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T01:00:00Z",
      },
      error: null,
    });

    getTasksByPipeline
      .mockResolvedValueOnce({
        data: [
          {
            id: "task-plan",
            name: "Create plan",
            status: "completed",
            agent_role_id: "role-planner-uuid",
            output_data: { plan: [], summary: "Done" },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "task-plan",
            name: "Create plan",
            status: "completed",
            agent_role_id: "role-planner-uuid",
            output_data: { plan: [], summary: "Done" },
          },
        ],
        error: null,
      });

    const result = await executeApprovedPipeline(
      [{ name: "Create plan" }],
      "Plan something",
    );

    expect(result.error).toBeNull();
    expect(result.data.n8n_workflow).toBeNull();
    expect(createWorkflow).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleAlignmentRejection
// ---------------------------------------------------------------------------

describe("handleAlignmentRejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty feedback", async () => {
    const result = await handleAlignmentRejection([], "", "build something");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.message).toContain("feedback");
  });

  it("returns error for null feedback", async () => {
    const result = await handleAlignmentRejection([], null, "build something");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns error for empty requestText", async () => {
    const result = await handleAlignmentRejection([], "add more tasks", "");
    expect(result.data).toBeNull();
    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.message).toContain("requestText");
  });

  it("re-decomposes with feedback and returns new alignment check", async () => {
    const originalTasks = [
      { name: "Plan", agent_role_id: "role-planner-uuid", depends_on: [] },
    ];

    const result = await handleAlignmentRejection(
      originalTasks,
      "Add a research step first",
      "build a landing page",
    );

    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data.intent).toBe("build");
    expect(result.data.tasks).toBeInstanceOf(Array);
    expect(result.data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(result.data.alignmentCheck).toBe("Mocked alignment check text");
    expect(result.data.requestText).toBe("build a landing page");
    expect(result.data.feedback).toBe("Add a research step first");
  });

  it("calls formatAlignmentCheck with revised tasks and roles", async () => {
    await handleAlignmentRejection(
      [],
      "Focus on automation",
      "automate the email workflow",
    );

    expect(formatAlignmentCheck).toHaveBeenCalledTimes(1);
    const [tasks, roles] = formatAlignmentCheck.mock.calls[0];
    expect(tasks).toBeInstanceOf(Array);
    expect(roles).toBeInstanceOf(Array);
  });

  it("preserves original intent classification from requestText", async () => {
    const result = await handleAlignmentRejection(
      [],
      "Include more audit categories",
      "audit the client business",
    );

    expect(result.error).toBeNull();
    expect(result.data.intent).toBe("audit");
  });

  it("handles getActiveRoles failure gracefully", async () => {
    getActiveRoles.mockRejectedValueOnce(new Error("DB down"));

    const result = await handleAlignmentRejection(
      [],
      "revise the plan",
      "build something",
    );

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("ALIGNMENT_REJECTION_ERROR");
    expect(result.error.message).toContain("DB down");
  });
});
