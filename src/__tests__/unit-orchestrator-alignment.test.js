import { describe, it, expect } from "vitest";

import {
  formatAlignmentCheck,
  parseAlignmentResponse,
  APPROVAL_KEYWORDS,
} from "../orchestrator/alignment.js";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const mockRoles = [
  {
    id: "role-planner-uuid",
    name: "Planner",
    role_type: "planner",
    output_schema: {
      type: "object",
      properties: {
        plan: { type: "array" },
        summary: { type: "string" },
      },
    },
  },
  {
    id: "role-research-uuid",
    name: "Research",
    role_type: "research",
    output_schema: {
      type: "object",
      properties: {
        findings: { type: "array" },
        sources: { type: "array" },
      },
    },
  },
  {
    id: "role-builder-uuid",
    name: "Builder",
    role_type: "builder",
    output_schema: {
      type: "object",
      properties: {
        content: { type: "string" },
        format: { type: "string" },
      },
    },
  },
  {
    id: "role-audit-uuid",
    name: "Audit",
    role_type: "audit",
    output_schema: {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        categories: { type: "array" },
      },
    },
  },
  {
    id: "role-automation-uuid",
    name: "Automation",
    role_type: "automation",
    output_schema: {
      type: "object",
      properties: {
        workflow_definition: { type: "object" },
      },
    },
  },
];

function makeTasks(overrides = []) {
  const defaults = [
    {
      id: "task-1",
      _temp_id: "__task_0",
      name: "Define audit scope",
      agent_role_id: "role-planner-uuid",
      depends_on: [],
      input_data: { goal: "Audit the business" },
    },
    {
      id: "task-2",
      _temp_id: "__task_1",
      name: "Gather business data",
      agent_role_id: "role-research-uuid",
      depends_on: ["task-1"],
      input_data: { query: "business data" },
    },
    {
      id: "task-3",
      _temp_id: "__task_2",
      name: "Evaluate operations",
      agent_role_id: "role-audit-uuid",
      depends_on: ["task-2"],
      input_data: { target: "operations" },
    },
  ];
  return overrides.length > 0 ? overrides : defaults;
}

// ---------------------------------------------------------------------------
// formatAlignmentCheck
// ---------------------------------------------------------------------------

describe("formatAlignmentCheck", () => {
  it("returns a warning when tasks array is empty", () => {
    const result = formatAlignmentCheck([], mockRoles);
    expect(result).toContain("No tasks");
  });

  it("returns a warning when tasks is not an array", () => {
    const result = formatAlignmentCheck(null, mockRoles);
    expect(result).toContain("No tasks");
  });

  it("returns a warning when agentRoles array is empty", () => {
    const result = formatAlignmentCheck(makeTasks(), []);
    expect(result).toContain("No agent roles");
  });

  it("returns a warning when agentRoles is not an array", () => {
    const result = formatAlignmentCheck(makeTasks(), null);
    expect(result).toContain("No agent roles");
  });

  it("contains every task name in the output", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    for (const task of tasks) {
      expect(result).toContain(task.name);
    }
  });

  it("contains every assigned agent role name in the output", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    // Collect the role names that are actually assigned
    const assignedRoleIds = new Set(tasks.map((t) => t.agent_role_id));
    const assignedRoleNames = mockRoles
      .filter((r) => assignedRoleIds.has(r.id))
      .map((r) => r.name);

    for (const name of assignedRoleNames) {
      expect(result).toContain(name);
    }
  });

  it("shows execution order for each task", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    for (let i = 0; i < tasks.length; i++) {
      expect(result).toContain(`Step ${i + 1}`);
      expect(result).toContain(`Execution Order: ${i + 1} of ${tasks.length}`);
    }
  });

  it("shows expected outputs derived from role output_schema", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    // Planner role has properties: plan, summary
    expect(result).toContain("plan, summary");
    // Research role has properties: findings, sources
    expect(result).toContain("findings, sources");
    // Audit role has properties: executive_summary, categories
    expect(result).toContain("executive_summary, categories");
  });

  it("shows dependency information when tasks have depends_on", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    // Task 2 depends on task 1 — should show the dependency name
    expect(result).toContain("Depends On");
    expect(result).toContain("Define audit scope");
  });

  it("handles a single task with no dependencies", () => {
    const tasks = [
      {
        id: "task-solo",
        name: "Create strategic plan",
        agent_role_id: "role-planner-uuid",
        depends_on: [],
        input_data: { goal: "Plan something" },
      },
    ];
    const result = formatAlignmentCheck(tasks, mockRoles);

    expect(result).toContain("Create strategic plan");
    expect(result).toContain("Planner");
    expect(result).toContain("Step 1");
    expect(result).toContain("1 of 1");
    // No "Depends On" line for a task with no dependencies
    expect(result).not.toContain("Depends On");
  });

  it('shows "Unknown Role" when a task references a role not in the array', () => {
    const tasks = [
      {
        id: "task-x",
        name: "Mystery task",
        agent_role_id: "role-nonexistent",
        depends_on: [],
        input_data: {},
      },
    ];
    const result = formatAlignmentCheck(tasks, mockRoles);

    expect(result).toContain("Mystery task");
    expect(result).toContain("Unknown Role");
  });

  it("handles roles with no output_schema gracefully", () => {
    const tasks = [
      {
        id: "task-1",
        name: "Do something",
        agent_role_id: "role-bare",
        depends_on: [],
        input_data: {},
      },
    ];
    const roles = [{ id: "role-bare", name: "Bare Role" }];
    const result = formatAlignmentCheck(tasks, roles);

    expect(result).toContain("Do something");
    expect(result).toContain("Bare Role");
    expect(result).toContain("Structured output");
  });

  it("includes total task count", () => {
    const tasks = makeTasks();
    const result = formatAlignmentCheck(tasks, mockRoles);

    expect(result).toContain(`Total Tasks: ${tasks.length}`);
  });
});

// ---------------------------------------------------------------------------
// parseAlignmentResponse
// ---------------------------------------------------------------------------

describe("parseAlignmentResponse", () => {
  it("returns approved: false for empty string", () => {
    const result = parseAlignmentResponse("");
    expect(result.approved).toBe(false);
  });

  it("returns approved: false for null", () => {
    const result = parseAlignmentResponse(null);
    expect(result.approved).toBe(false);
  });

  it("returns approved: false for undefined", () => {
    const result = parseAlignmentResponse(undefined);
    expect(result.approved).toBe(false);
  });

  it("returns approved: false for non-string input", () => {
    const result = parseAlignmentResponse(42);
    expect(result.approved).toBe(false);
  });

  // Test each approval keyword
  for (const keyword of APPROVAL_KEYWORDS) {
    it(`approves for exact keyword: "${keyword}"`, () => {
      const result = parseAlignmentResponse(keyword);
      expect(result.approved).toBe(true);
      expect(result.feedback).toBeUndefined();
    });

    it(`approves for uppercase keyword: "${keyword.toUpperCase()}"`, () => {
      const result = parseAlignmentResponse(keyword.toUpperCase());
      expect(result.approved).toBe(true);
      expect(result.feedback).toBeUndefined();
    });
  }

  it("approves when keyword is part of a longer response", () => {
    const result = parseAlignmentResponse("Yes, this looks good to me");
    expect(result.approved).toBe(true);
  });

  it('approves for "LGTM" (case-insensitive)', () => {
    const result = parseAlignmentResponse("LGTM");
    expect(result.approved).toBe(true);
  });

  it("rejects non-approval text and returns feedback", () => {
    const result = parseAlignmentResponse("Please add a research step first");
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe("Please add a research step first");
  });

  it("rejects and trims whitespace from feedback", () => {
    const result = parseAlignmentResponse("  Change the order of tasks  ");
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe("Change the order of tasks");
  });

  it("rejects text that does not contain any approval keyword", () => {
    const result = parseAlignmentResponse("I disagree with this plan");
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe("I disagree with this plan");
  });
});
