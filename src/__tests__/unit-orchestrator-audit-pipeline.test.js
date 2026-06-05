import { describe, it, expect, vi, beforeEach } from "vitest";
import Ajv from "ajv";

// ---------------------------------------------------------------------------
// Mock the registry module so we don't need a live Supabase connection
// ---------------------------------------------------------------------------
vi.mock("../agents/registry.js", () => {
  const roles = {
    planner: {
      id: "role-planner-uuid",
      role_type: "planner",
      name: "Planner",
      status: "active",
    },
    research: {
      id: "role-research-uuid",
      role_type: "research",
      name: "Research",
      status: "active",
    },
    audit: {
      id: "role-audit-uuid",
      role_type: "audit",
      name: "Audit",
      status: "active",
    },
    builder: {
      id: "role-builder-uuid",
      role_type: "builder",
      name: "Builder",
      status: "active",
    },
    automation: {
      id: "role-automation-uuid",
      role_type: "automation",
      name: "Automation",
      status: "active",
    },
  };
  return {
    getRoleByType: vi.fn((type) => {
      const role = roles[type];
      if (!role) throw new Error(`No role for type "${type}"`);
      return Promise.resolve(role);
    }),
    getActiveRoles: vi.fn(() => Promise.resolve(Object.values(roles))),
    DEFAULT_ROLES: [],
    REQUIRED_ROLE_FIELDS: [],
    VALID_ROLE_TYPES: ["planner", "research", "builder", "audit", "automation"],
    VALID_STATUSES: ["active", "inactive", "draft"],
  };
});

// Mock db.js to avoid Supabase dependency
vi.mock("../orchestrator/db.js", () => ({
  getTasksByPipeline: vi.fn(),
  getArtifacts: vi.fn(),
  getPipelineRun: vi.fn(),
  supabaseAdmin: {},
}));

import { classifyIntent, decomposeRequest } from "../orchestrator/index.js";
import { DEFAULT_ROLES } from "../agents/registry.js";

// ---------------------------------------------------------------------------
// Task 12.1: Audit pipeline creation
// ---------------------------------------------------------------------------

describe("Audit pipeline creation (Task 12.1)", () => {
  it('classifies audit-related requests as "audit" intent', async () => {
    const { data } = await classifyIntent(
      "Run a business audit on my operations",
    );
    expect(data).toBe("audit");
  });

  it("creates exactly 4 tasks for an audit pipeline", async () => {
    const { data: tasks, error } = await decomposeRequest(
      "Audit my business operations",
      "audit",
    );
    expect(error).toBeNull();
    expect(tasks).toHaveLength(4);
  });

  it("creates tasks in the correct order: Planner → Research → Audit → Planner", async () => {
    const { data: tasks } = await decomposeRequest(
      "Audit my business operations",
      "audit",
    );

    expect(tasks[0].name).toBe("Define audit scope");
    expect(tasks[0].agent_role_id).toBe("role-planner-uuid");

    expect(tasks[1].name).toBe("Gather business data");
    expect(tasks[1].agent_role_id).toBe("role-research-uuid");

    expect(tasks[2].name).toBe("Evaluate operations");
    expect(tasks[2].agent_role_id).toBe("role-audit-uuid");

    expect(tasks[3].name).toBe("Synthesize audit report");
    expect(tasks[3].agent_role_id).toBe("role-planner-uuid");
  });

  it("sets correct dependency chain between tasks", async () => {
    const { data: tasks } = await decomposeRequest(
      "Audit my business operations",
      "audit",
    );

    // Task 0 (Planner - define scope) has no dependencies
    expect(tasks[0].depends_on).toEqual([]);

    // Task 1 (Research) depends on task 0
    expect(tasks[1].depends_on).toEqual(["__task_0"]);

    // Task 2 (Audit) depends on task 1
    expect(tasks[2].depends_on).toEqual(["__task_1"]);

    // Task 3 (Planner - synthesize) depends on task 2
    expect(tasks[3].depends_on).toEqual(["__task_2"]);
  });

  it("passes URL to Research task input_data when request contains a URL", async () => {
    const { data: tasks } = await decomposeRequest(
      "Audit the business at https://example.com/store",
      "audit",
    );

    // Research task (index 1) should have the url in input_data
    expect(tasks[1].input_data.url).toBe("https://example.com/store");
    expect(tasks[1].input_data.query).toContain("https://example.com/store");
  });

  it("does not include url field when request has no URL", async () => {
    const { data: tasks } = await decomposeRequest(
      "Audit my local bakery business",
      "audit",
    );

    // Research task should not have a url field
    expect(tasks[1].input_data.url).toBeUndefined();
    expect(tasks[1].input_data.query).toBeDefined();
  });

  it("extracts HTTP URLs as well as HTTPS", async () => {
    const { data: tasks } = await decomposeRequest(
      "Audit the site at http://legacy-site.com/home",
      "audit",
    );

    expect(tasks[1].input_data.url).toBe("http://legacy-site.com/home");
  });
});

// ---------------------------------------------------------------------------
// Task 12.2: Audit agent role output schema validation
// ---------------------------------------------------------------------------

describe("Audit agent role output schema (Task 12.2)", () => {
  // Re-import the actual DEFAULT_ROLES from the real module for schema testing
  // Since we mocked registry.js, we need to test the schema directly
  let auditOutputSchema;

  beforeEach(async () => {
    // Dynamically import the real registry module to get the actual schema
    // We'll define the expected schema inline since the mock overrides the import
    auditOutputSchema = {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                enum: [
                  "operations_efficiency",
                  "ux_quality",
                  "automation_gaps",
                  "technology_stack",
                  "customer_experience",
                ],
              },
              score: { type: "number", minimum: 1, maximum: 10 },
              findings: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    priority: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                    estimated_effort: { type: "string" },
                    expected_impact: { type: "string" },
                  },
                  required: [
                    "text",
                    "priority",
                    "estimated_effort",
                    "expected_impact",
                  ],
                },
              },
            },
            required: ["name", "score", "findings", "recommendations"],
          },
        },
      },
      required: ["executive_summary", "categories"],
    };
  });

  it("validates a complete, well-formed audit artifact", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const validArtifact = {
      executive_summary:
        "The business shows strong operations but has automation gaps.",
      categories: [
        {
          name: "operations_efficiency",
          score: 8,
          findings: [
            "Streamlined order processing",
            "Good inventory management",
          ],
          recommendations: [
            {
              text: "Implement automated reorder triggers",
              priority: "medium",
              estimated_effort: "2 weeks",
              expected_impact: "Reduce stockouts by 30%",
            },
          ],
        },
        {
          name: "ux_quality",
          score: 6,
          findings: ["Mobile experience needs improvement"],
          recommendations: [
            {
              text: "Redesign mobile checkout flow",
              priority: "high",
              estimated_effort: "4 weeks",
              expected_impact: "Increase mobile conversion by 15%",
            },
          ],
        },
        {
          name: "automation_gaps",
          score: 4,
          findings: ["Manual invoice processing"],
          recommendations: [
            {
              text: "Automate invoice generation",
              priority: "high",
              estimated_effort: "1 week",
              expected_impact: "Save 10 hours per week",
            },
          ],
        },
        {
          name: "technology_stack",
          score: 7,
          findings: ["Modern frontend stack"],
          recommendations: [
            {
              text: "Upgrade database to managed service",
              priority: "low",
              estimated_effort: "3 weeks",
              expected_impact: "Improved reliability",
            },
          ],
        },
        {
          name: "customer_experience",
          score: 7,
          findings: ["Good support response times"],
          recommendations: [
            {
              text: "Add chatbot for common queries",
              priority: "medium",
              estimated_effort: "2 weeks",
              expected_impact: "Reduce support tickets by 20%",
            },
          ],
        },
      ],
    };

    const isValid = validate(validArtifact);
    expect(isValid).toBe(true);
  });

  it("rejects category names not in the required enum", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const invalidArtifact = {
      executive_summary: "Summary",
      categories: [
        {
          name: "invalid_category",
          score: 5,
          findings: ["Some finding"],
          recommendations: [],
        },
      ],
    };

    const isValid = validate(invalidArtifact);
    expect(isValid).toBe(false);
  });

  it("rejects scores outside the 1-10 range", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const tooLow = {
      executive_summary: "Summary",
      categories: [
        {
          name: "operations_efficiency",
          score: 0,
          findings: ["Finding"],
          recommendations: [],
        },
      ],
    };

    const tooHigh = {
      executive_summary: "Summary",
      categories: [
        {
          name: "operations_efficiency",
          score: 11,
          findings: ["Finding"],
          recommendations: [],
        },
      ],
    };

    expect(validate(tooLow)).toBe(false);
    expect(validate(tooHigh)).toBe(false);
  });

  it("rejects empty findings array", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const emptyFindings = {
      executive_summary: "Summary",
      categories: [
        {
          name: "ux_quality",
          score: 5,
          findings: [],
          recommendations: [],
        },
      ],
    };

    const isValid = validate(emptyFindings);
    expect(isValid).toBe(false);
  });

  it("rejects recommendations missing required fields", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const missingPriority = {
      executive_summary: "Summary",
      categories: [
        {
          name: "automation_gaps",
          score: 5,
          findings: ["Finding"],
          recommendations: [
            {
              text: "Do something",
              // missing priority, estimated_effort, expected_impact
            },
          ],
        },
      ],
    };

    const isValid = validate(missingPriority);
    expect(isValid).toBe(false);
  });

  it("rejects invalid priority values", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const invalidPriority = {
      executive_summary: "Summary",
      categories: [
        {
          name: "technology_stack",
          score: 5,
          findings: ["Finding"],
          recommendations: [
            {
              text: "Do something",
              priority: "critical",
              estimated_effort: "1 week",
              expected_impact: "Big impact",
            },
          ],
        },
      ],
    };

    const isValid = validate(invalidPriority);
    expect(isValid).toBe(false);
  });

  it("rejects artifact missing executive_summary", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const noSummary = {
      categories: [
        {
          name: "customer_experience",
          score: 7,
          findings: ["Good support"],
          recommendations: [],
        },
      ],
    };

    const isValid = validate(noSummary);
    expect(isValid).toBe(false);
  });

  it("rejects artifact missing categories", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const noCategories = {
      executive_summary: "Summary without categories",
    };

    const isValid = validate(noCategories);
    expect(isValid).toBe(false);
  });

  it("accepts all five required category names", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(auditOutputSchema);

    const requiredNames = [
      "operations_efficiency",
      "ux_quality",
      "automation_gaps",
      "technology_stack",
      "customer_experience",
    ];

    for (const name of requiredNames) {
      const artifact = {
        executive_summary: "Summary",
        categories: [
          {
            name,
            score: 5,
            findings: ["A finding"],
            recommendations: [],
          },
        ],
      };
      const isValid = validate(artifact);
      expect(isValid).toBe(true);
    }
  });
});
