import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We need fine-grained control over the Supabase query chain.
// The chain for getArtifacts is: from('artifacts').select('*').order(...) [.eq(...)]
// The chain for getArtifactById is: from('artifacts').select('*').eq('id', id).single()
// The chain for createArtifact calls getAgentRoleById first, then inserts.

let queryResult = { data: null, error: null };
let fromTable = "";

// Track calls for assertions
const callLog = {
  from: [],
  select: [],
  eq: [],
  order: [],
  single: [],
  insert: [],
};

function resetCallLog() {
  for (const key of Object.keys(callLog)) {
    callLog[key] = [];
  }
}

// Build a thenable chain that resolves to queryResult when awaited
function createChain() {
  const chain = {
    select: vi.fn((...args) => {
      callLog.select.push(args);
      return chain;
    }),
    eq: vi.fn((...args) => {
      callLog.eq.push(args);
      return chain;
    }),
    order: vi.fn((...args) => {
      callLog.order.push(args);
      return chain;
    }),
    single: vi.fn((...args) => {
      callLog.single.push(args);
      // single() returns a promise
      return Promise.resolve(queryResult);
    }),
    insert: vi.fn((...args) => {
      callLog.insert.push(args);
      return chain;
    }),
    // Make the chain thenable so `await query` resolves
    then: vi.fn((resolve, reject) => {
      return Promise.resolve(queryResult).then(resolve, reject);
    }),
  };
  return chain;
}

const mockFrom = vi.fn((...args) => {
  callLog.from.push(args);
  fromTable = args[0];
  return createChain();
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (...args) => mockFrom(...args),
  })),
}));

// Mock import.meta.env
vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// Mock validateAgainstSchema from contracts.js
const mockValidateAgainstSchema = vi.fn();
vi.mock("../agents/contracts.js", () => ({
  validateAgainstSchema: (...args) => mockValidateAgainstSchema(...args),
}));

// Import after mocks are set up
const { createArtifact, getArtifacts, getArtifactById } =
  await import("../orchestrator/db.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  vi.clearAllMocks();
  resetCallLog();
  queryResult = { data: null, error: null };
  mockValidateAgainstSchema.mockReturnValue({ valid: true });
}

// For createArtifact, we need the mock to return different results for
// sequential calls (first getAgentRoleById, then insert).
// We achieve this by making mockFrom return chains with different behaviors.
function setupCreateArtifactMocks(roleResult, insertResult) {
  let callCount = 0;
  mockFrom.mockImplementation((...args) => {
    callLog.from.push(args);
    fromTable = args[0];
    callCount++;

    const chain = createChain();

    if (callCount === 1) {
      // First call: getAgentRoleById (agent_roles table)
      chain.single = vi.fn(() => Promise.resolve(roleResult));
    } else {
      // Second call: insert artifact
      chain.single = vi.fn(() => Promise.resolve(insertResult));
    }

    return chain;
  });
}

// ---------------------------------------------------------------------------
// createArtifact
// ---------------------------------------------------------------------------

describe("createArtifact", () => {
  beforeEach(resetMocks);

  it("validates content against agent role output_schema before storing", async () => {
    const outputSchema = {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    };

    setupCreateArtifactMocks(
      { data: { id: "role-1", output_schema: outputSchema }, error: null },
      {
        data: {
          id: "artifact-1",
          agent_role_id: "role-1",
          content: { summary: "Test" },
        },
        error: null,
      },
    );

    mockValidateAgainstSchema.mockReturnValue({ valid: true });

    const result = await createArtifact({
      agent_role_id: "role-1",
      content: { summary: "Test" },
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    expect(mockValidateAgainstSchema).toHaveBeenCalledWith(
      { summary: "Test" },
      outputSchema,
    );
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });

  it("returns SCHEMA_VALIDATION_ERROR when content fails schema validation", async () => {
    const outputSchema = {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    };

    setupCreateArtifactMocks(
      { data: { id: "role-1", output_schema: outputSchema }, error: null },
      { data: null, error: null }, // should not reach insert
    );

    mockValidateAgainstSchema.mockReturnValue({
      valid: false,
      errors: ["/ must have required property 'summary'"],
    });

    const result = await createArtifact({
      agent_role_id: "role-1",
      content: {},
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("SCHEMA_VALIDATION_ERROR");
    expect(result.error.validationErrors).toEqual([
      "/ must have required property 'summary'",
    ]);
    // Should NOT have called from('artifacts') for insert (only from('agent_roles'))
    expect(callLog.from.length).toBe(1);
    expect(callLog.from[0][0]).toBe("agent_roles");
  });

  it("returns ROLE_FETCH_ERROR when agent role cannot be fetched", async () => {
    setupCreateArtifactMocks(
      { data: null, error: { message: "Role not found", code: "PGRST116" } },
      { data: null, error: null },
    );

    const result = await createArtifact({
      agent_role_id: "nonexistent-role",
      content: { summary: "Test" },
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("ROLE_FETCH_ERROR");
    expect(result.error.message).toContain("Role not found");
  });

  it("serializes content through JSON round-trip before storing", async () => {
    const content = { summary: "Test", nested: { value: 42 } };

    setupCreateArtifactMocks(
      {
        data: { id: "role-1", output_schema: { type: "object" } },
        error: null,
      },
      { data: { id: "artifact-1", content }, error: null },
    );

    mockValidateAgainstSchema.mockReturnValue({ valid: true });

    await createArtifact({
      agent_role_id: "role-1",
      content,
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    // Verify insert was called (second from() call should be 'artifacts')
    expect(callLog.from.length).toBe(2);
    expect(callLog.from[1][0]).toBe("artifacts");
    // Verify the inserted content is structurally equivalent
    expect(callLog.insert.length).toBe(1);
    expect(callLog.insert[0][0].content).toEqual(content);
  });

  it("skips schema validation when agent role has no output_schema", async () => {
    setupCreateArtifactMocks(
      { data: { id: "role-1", output_schema: null }, error: null },
      { data: { id: "artifact-1", content: { data: "test" } }, error: null },
    );

    const result = await createArtifact({
      agent_role_id: "role-1",
      content: { data: "test" },
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    expect(mockValidateAgainstSchema).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("handles Supabase insert errors", async () => {
    setupCreateArtifactMocks(
      {
        data: { id: "role-1", output_schema: { type: "object" } },
        error: null,
      },
      { data: null, error: { message: "Insert failed", code: "23505" } },
    );

    mockValidateAgainstSchema.mockReturnValue({ valid: true });

    const result = await createArtifact({
      agent_role_id: "role-1",
      content: { data: "test" },
      artifact_type: "plan",
      task_id: "task-1",
      user_id: "user-1",
    });

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("23505");
  });
});

// ---------------------------------------------------------------------------
// getArtifacts
// ---------------------------------------------------------------------------

describe("getArtifacts", () => {
  beforeEach(resetMocks);

  it("deserializes content for each artifact", async () => {
    const artifacts = [
      { id: "a1", content: { summary: "Report 1" }, created_at: "2024-01-02" },
      { id: "a2", content: { summary: "Report 2" }, created_at: "2024-01-01" },
    ];

    queryResult = { data: artifacts, error: null };

    const result = await getArtifacts();

    expect(result.data).toHaveLength(2);
    expect(result.data[0].content).toEqual({ summary: "Report 1" });
    expect(result.data[1].content).toEqual({ summary: "Report 2" });
    expect(result.error).toBeNull();
  });

  it("filters by artifact_type when provided", async () => {
    const artifacts = [
      {
        id: "a1",
        content: { summary: "Audit" },
        artifact_type: "audit_report",
      },
    ];

    queryResult = { data: artifacts, error: null };

    const result = await getArtifacts({ artifact_type: "audit_report" });

    expect(
      callLog.eq.some(
        (args) => args[0] === "artifact_type" && args[1] === "audit_report",
      ),
    ).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("sorts by created_at descending", async () => {
    queryResult = { data: [], error: null };

    await getArtifacts();

    expect(
      callLog.order.some(
        (args) => args[0] === "created_at" && args[1]?.ascending === false,
      ),
    ).toBe(true);
  });

  it("returns PARTIAL_DESERIALIZATION_ERROR when some artifacts fail deserialization", async () => {
    const artifacts = [
      { id: "a1", content: { summary: "Good" } },
      { id: "a2", content: "not-valid-json{" },
    ];

    queryResult = { data: artifacts, error: null };

    const result = await getArtifacts();

    expect(result.error).not.toBeNull();
    expect(result.error.code).toBe("PARTIAL_DESERIALIZATION_ERROR");
    expect(result.error.details).toHaveLength(1);
    expect(result.error.details[0].artifactId).toBe("a2");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("a1");
  });

  it("returns Supabase errors when query fails", async () => {
    queryResult = {
      data: null,
      error: { message: "DB error", code: "DB_ERR" },
    };

    const result = await getArtifacts();

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("DB_ERR");
  });
});

// ---------------------------------------------------------------------------
// getArtifactById
// ---------------------------------------------------------------------------

describe("getArtifactById", () => {
  beforeEach(resetMocks);

  it("deserializes content for the retrieved artifact", async () => {
    const artifact = {
      id: "artifact-1",
      content: { executive_summary: "All good", categories: [] },
      artifact_type: "audit_report",
    };

    // getArtifactById uses .single() at the end
    mockFrom.mockImplementation((...args) => {
      callLog.from.push(args);
      const chain = createChain();
      chain.single = vi.fn(() =>
        Promise.resolve({ data: artifact, error: null }),
      );
      return chain;
    });

    const result = await getArtifactById("artifact-1");

    expect(result.data.content).toEqual({
      executive_summary: "All good",
      categories: [],
    });
    expect(result.error).toBeNull();
  });

  it("handles string content by parsing it as JSON", async () => {
    const artifact = {
      id: "artifact-2",
      content: '{"summary":"parsed"}',
      artifact_type: "plan",
    };

    mockFrom.mockImplementation((...args) => {
      callLog.from.push(args);
      const chain = createChain();
      chain.single = vi.fn(() =>
        Promise.resolve({ data: artifact, error: null }),
      );
      return chain;
    });

    const result = await getArtifactById("artifact-2");

    expect(result.data.content).toEqual({ summary: "parsed" });
    expect(result.error).toBeNull();
  });

  it("returns DESERIALIZATION_ERROR with artifact ID when content is invalid", async () => {
    const artifact = {
      id: "artifact-bad",
      content: "not-valid-json{{{",
      artifact_type: "plan",
    };

    mockFrom.mockImplementation((...args) => {
      callLog.from.push(args);
      const chain = createChain();
      chain.single = vi.fn(() =>
        Promise.resolve({ data: artifact, error: null }),
      );
      return chain;
    });

    const result = await getArtifactById("artifact-bad");

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("DESERIALIZATION_ERROR");
    expect(result.error.artifactId).toBe("artifact-bad");
    expect(result.error.message).toContain("artifact-bad");
  });

  it("returns Supabase errors when query fails", async () => {
    mockFrom.mockImplementation((...args) => {
      callLog.from.push(args);
      const chain = createChain();
      chain.single = vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "Not found", code: "PGRST116" },
        }),
      );
      return chain;
    });

    const result = await getArtifactById("nonexistent");

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("PGRST116");
  });
});
