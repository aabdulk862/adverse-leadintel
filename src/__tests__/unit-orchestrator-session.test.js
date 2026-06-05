// Unit tests for src/lib/agents/session.js
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing session
vi.mock("../orchestrator/db.js", () => ({
  supabaseAdmin: {},
  createArtifact: vi
    .fn()
    .mockResolvedValue({ data: { id: "artifact-1" }, error: null }),
  updateTask: vi
    .fn()
    .mockResolvedValue({ data: { id: "task-1" }, error: null }),
}));

// Mock contracts.js to avoid ajv dependency issues in test environment
vi.mock("../agents/contracts.js", () => ({
  validateAgainstSchema: vi.fn((data, schema) => {
    // Simple mock: valid if data is an object with keys matching schema properties
    if (!schema || !schema.properties) return { valid: true };
    const missingRequired = (schema.required || []).filter(
      (key) => !(key in data),
    );
    if (missingRequired.length > 0) {
      return {
        valid: false,
        errors: missingRequired.map(
          (key) => `/ must have required property '${key}'`,
        ),
      };
    }
    return { valid: true };
  }),
}));

import {
  createSession,
  executeSession,
  validateOutput,
  retrySession,
  summarizeContext,
  createContinuationSession,
} from "../agents/session.js";

import { updateTask } from "../orchestrator/db.js";
import { validateAgainstSchema } from "../agents/contracts.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal agent role for testing
// ---------------------------------------------------------------------------

function makeRole(overrides = {}) {
  return {
    id: "role-uuid-1",
    name: "TestAgent",
    description: "A test agent role",
    role_type: "planner",
    system_prompt: "You are a test agent.",
    input_schema: {
      type: "object",
      properties: { goal: { type: "string" } },
      required: ["goal"],
    },
    output_schema: {
      type: "object",
      properties: {
        plan: { type: "array" },
        summary: { type: "string" },
      },
      required: ["plan", "summary"],
    },
    status: "active",
    ...overrides,
  };
}

function makeTaskInput(overrides = {}) {
  return {
    task_id: "task-uuid-1",
    goal: "Build a landing page",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  it("produces a session with the role system_prompt", () => {
    const role = makeRole();
    const session = createSession(role, makeTaskInput());

    expect(session.system_prompt).toBe(role.system_prompt);
  });

  it("produces a session with empty conversation_history", () => {
    const session = createSession(makeRole(), makeTaskInput());

    expect(session.conversation_history).toEqual([]);
  });

  it("produces a session with retry_count of 0", () => {
    const session = createSession(makeRole(), makeTaskInput());

    expect(session.retry_count).toBe(0);
  });

  it("produces a session with max_retries of 3", () => {
    const session = createSession(makeRole(), makeTaskInput());

    expect(session.max_retries).toBe(3);
  });

  it("stores the task input data", () => {
    const input = makeTaskInput({ goal: "Custom goal" });
    const session = createSession(makeRole(), input);

    expect(session.input_data.goal).toBe("Custom goal");
    expect(session.task_id).toBe("task-uuid-1");
  });

  it("produces a session with a valid UUID id", () => {
    const session = createSession(makeRole(), makeTaskInput());

    // UUID v4 pattern
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("deep-clones the agent role so mutations do not leak", () => {
    const role = makeRole();
    const session = createSession(role, makeTaskInput());

    // Mutate the original role
    role.system_prompt = "MUTATED";

    expect(session.agent_role.system_prompt).toBe("You are a test agent.");
  });

  it("deep-clones the task input so mutations do not leak", () => {
    const input = makeTaskInput();
    const session = createSession(makeRole(), input);

    // Mutate the original input
    input.goal = "MUTATED";

    expect(session.input_data.goal).toBe("Build a landing page");
  });

  it("throws when agentRole is null", () => {
    expect(() => createSession(null, makeTaskInput())).toThrow();
  });

  it("throws when taskInput is null", () => {
    expect(() => createSession(makeRole(), null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Session isolation (Requirement 3.2)
// ---------------------------------------------------------------------------

describe("session isolation", () => {
  it("modifying one session conversation_history does not affect another", () => {
    const role = makeRole();
    const session1 = createSession(role, makeTaskInput({ task_id: "task-1" }));
    const session2 = createSession(role, makeTaskInput({ task_id: "task-2" }));

    session1.conversation_history.push({ role: "user", content: "hello" });

    expect(session2.conversation_history).toEqual([]);
  });

  it("modifying one session agent_role does not affect another", () => {
    const role = makeRole();
    const session1 = createSession(role, makeTaskInput({ task_id: "task-1" }));
    const session2 = createSession(role, makeTaskInput({ task_id: "task-2" }));

    session1.agent_role.name = "MUTATED";

    expect(session2.agent_role.name).toBe("TestAgent");
  });
});

// ---------------------------------------------------------------------------
// validateOutput
// ---------------------------------------------------------------------------

describe("validateOutput", () => {
  it("returns valid when output matches schema", () => {
    const output = { plan: [], summary: "done" };
    const schema = {
      type: "object",
      properties: { plan: { type: "array" }, summary: { type: "string" } },
      required: ["plan", "summary"],
    };

    const result = validateOutput(output, schema);
    expect(result.valid).toBe(true);
  });

  it("returns invalid when output is missing required fields", () => {
    const output = { plan: [] };
    const schema = {
      type: "object",
      properties: { plan: { type: "array" }, summary: { type: "string" } },
      required: ["plan", "summary"],
    };

    const result = validateOutput(output, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns valid when no schema is provided", () => {
    const result = validateOutput({ anything: true }, null);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeSession
// ---------------------------------------------------------------------------

describe("executeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: validation passes
    validateAgainstSchema.mockReturnValue({ valid: true });
  });

  it("returns success with output when validation passes", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    const result = await executeSession(session);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it("adds messages to conversation_history during execution", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    await executeSession(session);

    expect(session.conversation_history.length).toBeGreaterThanOrEqual(2);
    expect(session.conversation_history[0].role).toBe("user");
    expect(session.conversation_history[1].role).toBe("assistant");
  });

  it("returns failure when output validation fails", async () => {
    validateAgainstSchema.mockReturnValue({
      valid: false,
      errors: ["/ must have required property 'summary'"],
    });

    const session = createSession(makeRole(), makeTaskInput());
    const result = await executeSession(session);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Output validation failed");
  });

  it("throws when session is null", async () => {
    await expect(executeSession(null)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// retrySession
// ---------------------------------------------------------------------------

describe("retrySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateAgainstSchema.mockReturnValue({ valid: true });
  });

  it("increments retry_count on each retry", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    expect(session.retry_count).toBe(0);

    await retrySession(session, "Please fix the output format");
    expect(session.retry_count).toBe(1);
  });

  it("adds correction prompt to conversation_history", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    await retrySession(session, "Fix the format");

    const correctionMessage = session.conversation_history.find(
      (m) => m.role === "user" && m.content === "Fix the format",
    );
    expect(correctionMessage).toBeDefined();
  });

  it("returns failure after max retries exhausted", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    session.retry_count = 3; // Already at max

    const result = await retrySession(session, "Try again");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Max retries");
    expect(result.error).toContain("exhausted");
  });

  it("marks task as failed after retry exhaustion", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    session.retry_count = 3;

    await retrySession(session, "Try again");

    expect(updateTask).toHaveBeenCalledWith("task-uuid-1", {
      status: "failed",
    });
  });

  it("throws when correctionPrompt is empty", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    await expect(retrySession(session, "")).rejects.toThrow();
  });

  it("throws when correctionPrompt is not a string", async () => {
    const session = createSession(makeRole(), makeTaskInput());
    await expect(retrySession(session, 123)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// summarizeContext
// ---------------------------------------------------------------------------

describe("summarizeContext", () => {
  it("returns a non-empty summary string", () => {
    const session = createSession(makeRole(), makeTaskInput());
    session.conversation_history.push(
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    );

    const summary = summarizeContext(session);

    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("includes the agent role name in the summary", () => {
    const session = createSession(
      makeRole({ name: "Planner" }),
      makeTaskInput(),
    );
    session.conversation_history.push({
      role: "user",
      content: "Plan something",
    });

    const summary = summarizeContext(session);

    expect(summary).toContain("Planner");
  });

  it("includes conversation content in the summary", () => {
    const session = createSession(makeRole(), makeTaskInput());
    session.conversation_history.push({
      role: "user",
      content: "Build a website",
    });

    const summary = summarizeContext(session);

    expect(summary).toContain("Build a website");
  });

  it("handles empty conversation history", () => {
    const session = createSession(makeRole(), makeTaskInput());

    const summary = summarizeContext(session);

    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain("No conversation history");
  });

  it("truncates long messages in the summary", () => {
    const session = createSession(makeRole(), makeTaskInput());
    const longContent = "x".repeat(500);
    session.conversation_history.push({ role: "user", content: longContent });

    const summary = summarizeContext(session);

    // Summary should not contain the full 500-char string
    expect(summary).toContain("...");
  });

  it("throws when session is null", () => {
    expect(() => summarizeContext(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createContinuationSession
// ---------------------------------------------------------------------------

describe("createContinuationSession", () => {
  it("creates a new session with a different id", () => {
    const original = createSession(makeRole(), makeTaskInput());
    const continuation = createContinuationSession(
      original,
      "Summary of previous work",
    );

    expect(continuation.id).not.toBe(original.id);
  });

  it("preserves the agent role from the original session", () => {
    const original = createSession(
      makeRole({ name: "Research" }),
      makeTaskInput(),
    );
    const continuation = createContinuationSession(original, "Summary");

    expect(continuation.agent_role.name).toBe("Research");
  });

  it("preserves the task_id from the original session", () => {
    const original = createSession(
      makeRole(),
      makeTaskInput({ task_id: "task-42" }),
    );
    const continuation = createContinuationSession(original, "Summary");

    expect(continuation.task_id).toBe("task-42");
  });

  it("sets conversation_history to contain only the summary message", () => {
    const original = createSession(makeRole(), makeTaskInput());
    original.conversation_history.push(
      { role: "user", content: "old message 1" },
      { role: "assistant", content: "old message 2" },
    );

    const continuation = createContinuationSession(original, "Summary of work");

    expect(continuation.conversation_history).toHaveLength(1);
    expect(continuation.conversation_history[0].role).toBe("system");
    expect(continuation.conversation_history[0].content).toContain(
      "Summary of work",
    );
  });

  it("preserves retry_count from the original session", () => {
    const original = createSession(makeRole(), makeTaskInput());
    original.retry_count = 2;

    const continuation = createContinuationSession(original, "Summary");

    expect(continuation.retry_count).toBe(2);
  });

  it("deep-clones the agent role so mutations do not leak", () => {
    const original = createSession(makeRole(), makeTaskInput());
    const continuation = createContinuationSession(original, "Summary");

    continuation.agent_role.name = "MUTATED";

    expect(original.agent_role.name).toBe("TestAgent");
  });

  it("throws when summary is empty", () => {
    const original = createSession(makeRole(), makeTaskInput());
    expect(() => createContinuationSession(original, "")).toThrow();
  });

  it("throws when summary is not a string", () => {
    const original = createSession(makeRole(), makeTaskInput());
    expect(() => createContinuationSession(original, 123)).toThrow();
  });
});
