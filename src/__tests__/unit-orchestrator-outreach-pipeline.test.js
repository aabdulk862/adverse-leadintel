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

// Mock contracts.js - provide a real-ish validateAgainstSchema using Ajv
vi.mock("../agents/contracts.js", async () => {
  const { default: AjvImport } = await import("ajv");
  const ajv = new AjvImport();
  return {
    validateAgainstSchema: vi.fn((data, schema) => {
      const validate = ajv.compile(schema);
      const valid = validate(data);
      if (valid) return { valid: true };
      return {
        valid: false,
        errors: validate.errors.map(
          (e) => `${e.instancePath || "/"} ${e.message}`,
        ),
      };
    }),
  };
});

import {
  classifyIntent,
  decomposeRequest,
  createOutreachAutomationTask,
  validateOutreachContent,
  INTENT_KEYWORDS,
  VALID_INTENTS,
  OUTREACH_OUTPUT_SCHEMA,
} from "../orchestrator/index.js";

// ---------------------------------------------------------------------------
// Task 13.1: Outreach pipeline creation
// ---------------------------------------------------------------------------

describe("Outreach pipeline creation (Task 13.1)", () => {
  it('includes "outreach" in VALID_INTENTS', () => {
    expect(VALID_INTENTS).toContain("outreach");
  });

  it("has outreach keywords in INTENT_KEYWORDS", () => {
    expect(INTENT_KEYWORDS).toHaveProperty("outreach");
    expect(INTENT_KEYWORDS.outreach).toContain("outreach");
    expect(INTENT_KEYWORDS.outreach).toContain("prospect");
    expect(INTENT_KEYWORDS.outreach).toContain("email");
    expect(INTENT_KEYWORDS.outreach).toContain("linkedin");
    expect(INTENT_KEYWORDS.outreach).toContain("cold email");
    expect(INTENT_KEYWORDS.outreach).toContain("lead generation");
    expect(INTENT_KEYWORDS.outreach).toContain("business development");
    expect(INTENT_KEYWORDS.outreach).toContain("sales");
  });

  it('classifies outreach-related requests as "outreach" intent', async () => {
    const { data } = await classifyIntent("Generate outreach for a prospect");
    expect(data).toBe("outreach");
  });

  it('classifies linkedin-related requests as "outreach"', async () => {
    const { data } = await classifyIntent(
      "Send a linkedin outreach to a prospect",
    );
    expect(data).toBe("outreach");
  });

  it('classifies cold email requests as "outreach"', async () => {
    const { data } = await classifyIntent(
      "Create a cold email for lead generation",
    );
    expect(data).toBe("outreach");
  });

  it("creates exactly 3 tasks for an outreach pipeline", async () => {
    const { data: tasks, error } = await decomposeRequest(
      "Generate outreach for Acme Corp",
      "outreach",
    );
    expect(error).toBeNull();
    expect(tasks).toHaveLength(3);
  });

  it("creates tasks in the correct order: Research → Planner → Builder", async () => {
    const { data: tasks } = await decomposeRequest(
      "Generate outreach for Acme Corp",
      "outreach",
    );

    expect(tasks[0].name).toBe("Gather prospect information");
    expect(tasks[0].agent_role_id).toBe("role-research-uuid");

    expect(tasks[1].name).toBe("Define outreach strategy");
    expect(tasks[1].agent_role_id).toBe("role-planner-uuid");

    expect(tasks[2].name).toBe("Generate outreach content");
    expect(tasks[2].agent_role_id).toBe("role-builder-uuid");
  });

  it("sets correct dependency chain between tasks", async () => {
    const { data: tasks } = await decomposeRequest(
      "Generate outreach for Acme Corp",
      "outreach",
    );

    // Task 0 (Research - gather prospect info) has no dependencies
    expect(tasks[0].depends_on).toEqual([]);

    // Task 1 (Planner - define strategy) depends on task 0
    expect(tasks[1].depends_on).toEqual(["__task_0"]);

    // Task 2 (Builder - generate content) depends on task 1
    expect(tasks[2].depends_on).toEqual(["__task_1"]);
  });

  it("passes request text into task input_data", async () => {
    const requestText = "Generate outreach for Acme Corp";
    const { data: tasks } = await decomposeRequest(requestText, "outreach");

    expect(tasks[0].input_data.query).toBe(requestText);
    expect(tasks[1].input_data.goal).toContain(requestText);
    expect(tasks[2].input_data.specification).toContain(requestText);
    expect(tasks[2].input_data.format).toBe("outreach");
  });
});

// ---------------------------------------------------------------------------
// Task 13.2: Outreach output schema and validation
// ---------------------------------------------------------------------------

describe("Outreach output schema (Task 13.2)", () => {
  it("OUTREACH_OUTPUT_SCHEMA requires email_draft, linkedin_message, proposal_outline, placeholders", () => {
    expect(OUTREACH_OUTPUT_SCHEMA.required).toContain("email_draft");
    expect(OUTREACH_OUTPUT_SCHEMA.required).toContain("linkedin_message");
    expect(OUTREACH_OUTPUT_SCHEMA.required).toContain("proposal_outline");
    expect(OUTREACH_OUTPUT_SCHEMA.required).toContain("placeholders");
  });

  it("validates a well-formed outreach artifact", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const validArtifact = {
      email_draft: "Hi [company_name], I noticed your team is growing...",
      linkedin_message:
        "Hey [first_name], congrats on the recent funding round...",
      proposal_outline:
        "Proposal for [company_name]: We help companies like yours...",
      placeholders: ["[company_name]", "[first_name]", "[pain_point]"],
    };

    expect(validate(validArtifact)).toBe(true);
  });

  it("rejects artifact missing email_draft", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const invalid = {
      linkedin_message: "Hello",
      proposal_outline: "Proposal",
      placeholders: [],
    };

    expect(validate(invalid)).toBe(false);
  });

  it("rejects artifact missing linkedin_message", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const invalid = {
      email_draft: "Hello",
      proposal_outline: "Proposal",
      placeholders: [],
    };

    expect(validate(invalid)).toBe(false);
  });

  it("rejects artifact missing proposal_outline", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const invalid = {
      email_draft: "Hello",
      linkedin_message: "Hi",
      placeholders: [],
    };

    expect(validate(invalid)).toBe(false);
  });

  it("rejects artifact missing placeholders", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const invalid = {
      email_draft: "Hello",
      linkedin_message: "Hi",
      proposal_outline: "Proposal",
    };

    expect(validate(invalid)).toBe(false);
  });

  it("rejects empty string for email_draft", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const invalid = {
      email_draft: "",
      linkedin_message: "Hi",
      proposal_outline: "Proposal",
      placeholders: [],
    };

    expect(validate(invalid)).toBe(false);
  });

  it("enforces bracket notation pattern for placeholders", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    // Valid bracket notation
    const valid = {
      email_draft: "Hello",
      linkedin_message: "Hi",
      proposal_outline: "Proposal",
      placeholders: ["[company_name]", "[pain_point]"],
    };
    expect(validate(valid)).toBe(true);

    // Invalid - missing brackets
    const invalidNoBrackets = {
      email_draft: "Hello",
      linkedin_message: "Hi",
      proposal_outline: "Proposal",
      placeholders: ["company_name"],
    };
    expect(validate(invalidNoBrackets)).toBe(false);

    // Invalid - curly braces instead of brackets
    const invalidCurly = {
      email_draft: "Hello",
      linkedin_message: "Hi",
      proposal_outline: "Proposal",
      placeholders: ["{company_name}"],
    };
    expect(validate(invalidCurly)).toBe(false);
  });

  it("accepts empty placeholders array", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(OUTREACH_OUTPUT_SCHEMA);

    const valid = {
      email_draft: "Hello there",
      linkedin_message: "Hi there",
      proposal_outline: "Proposal for you",
      placeholders: [],
    };

    expect(validate(valid)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 13.2: validateOutreachContent function
// ---------------------------------------------------------------------------

describe("validateOutreachContent", () => {
  it("returns valid for well-formed outreach content", () => {
    const result = validateOutreachContent({
      email_draft: "Hi [company_name], we can help with [pain_point].",
      linkedin_message: "Hey [first_name], great to connect.",
      proposal_outline: "Proposal for [company_name].",
      placeholders: ["[company_name]", "[first_name]", "[pain_point]"],
    });
    expect(result.valid).toBe(true);
  });

  it("returns invalid for missing required fields", () => {
    const result = validateOutreachContent({
      email_draft: "Hello",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 13.2: Outreach approval → Automation task creation
// ---------------------------------------------------------------------------

describe("createOutreachAutomationTask (Task 13.2)", () => {
  it("creates an automation task from approved outreach content", async () => {
    const outreachArtifact = {
      email_draft: "Hi [company_name]...",
      linkedin_message: "Hey [first_name]...",
      proposal_outline: "Proposal for [company_name]...",
      placeholders: ["[company_name]", "[first_name]"],
    };

    const { data: task, error } = await createOutreachAutomationTask(
      outreachArtifact,
      "pipeline-123",
    );

    expect(error).toBeNull();
    expect(task).toBeTruthy();
    expect(task.name).toBe("Generate outreach automation workflow");
    expect(task.agent_role_id).toBe("role-automation-uuid");
    expect(task.depends_on).toEqual([]);
    expect(task.input_data.outreach_content).toEqual(outreachArtifact);
    expect(task.input_data.pipeline_id).toBe("pipeline-123");
    expect(task.input_data.workflow_description).toContain("n8n workflow");
  });

  it("returns error for null artifact", async () => {
    const { data, error } = await createOutreachAutomationTask(
      null,
      "pipeline-123",
    );
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error.code).toBe("INVALID_INPUT");
  });

  it("returns error for non-object artifact", async () => {
    const { data, error } = await createOutreachAutomationTask(
      "not an object",
      "pipeline-123",
    );
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error.code).toBe("INVALID_INPUT");
  });
});
