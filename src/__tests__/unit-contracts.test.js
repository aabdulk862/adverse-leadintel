import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin before importing contracts
vi.mock("../orchestrator/db.js", () => {
  const mockInsert = vi.fn();
  const mockSelect = vi.fn();
  const mockSingle = vi.fn();

  const mockClient = {
    from: vi.fn(() => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
    _mockInsert: mockInsert,
    _mockSelect: mockSelect,
    _mockSingle: mockSingle,
  };

  const supabaseAdmin = vi.fn(() => mockClient);
  supabaseAdmin.from = mockClient.from;
  supabaseAdmin._mockInsert = mockInsert;
  supabaseAdmin._mockSelect = mockSelect;
  supabaseAdmin._mockSingle = mockSingle;

  return { supabaseAdmin };
});

import {
  validateAgainstSchema,
  validateTransfer,
  transformData,
  stripSubjectiveQualifiers,
  logTransfer,
} from "../agents/contracts.js";

import { supabaseAdmin } from "../orchestrator/db.js";

// ---------------------------------------------------------------------------
// validateAgainstSchema
// ---------------------------------------------------------------------------

describe("validateAgainstSchema", () => {
  it("returns valid for data matching schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    };
    const result = validateAgainstSchema({ name: "Alice", age: 30 }, schema);
    expect(result).toEqual({ valid: true });
  });

  it("returns errors for data not matching schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    const result = validateAgainstSchema({}, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns errors for wrong type", () => {
    const schema = {
      type: "object",
      properties: {
        count: { type: "number" },
      },
      required: ["count"],
    };
    const result = validateAgainstSchema({ count: "not-a-number" }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// validateTransfer
// ---------------------------------------------------------------------------

describe("validateTransfer", () => {
  const sourceRole = {
    output_schema: {
      type: "object",
      properties: { result: { type: "string" } },
      required: ["result"],
    },
  };
  const targetRole = {
    input_schema: {
      type: "object",
      properties: { result: { type: "string" } },
      required: ["result"],
    },
  };

  it("returns valid when data matches both schemas", () => {
    const result = validateTransfer({ result: "ok" }, sourceRole, targetRole);
    expect(result).toEqual({ valid: true });
  });

  it("returns sourceErrors when data fails source schema", () => {
    const result = validateTransfer({}, sourceRole, targetRole);
    expect(result.valid).toBe(false);
    expect(result.sourceErrors).toBeDefined();
  });

  it("returns targetErrors when data fails target schema", () => {
    const mismatchedTarget = {
      input_schema: {
        type: "object",
        properties: { value: { type: "number" } },
        required: ["value"],
      },
    };
    const result = validateTransfer(
      { result: "ok" },
      sourceRole,
      mismatchedTarget,
    );
    expect(result.valid).toBe(false);
    expect(result.targetErrors).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// transformData
// ---------------------------------------------------------------------------

describe("transformData", () => {
  it("picks matching keys from data", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    const data = { name: "Alice", age: 30, extra: true };
    const result = transformData(data, schema);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("coerces string to number", () => {
    const schema = {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    };
    const result = transformData({ count: "42" }, schema);
    expect(result).toEqual({ count: 42 });
  });

  it("coerces number to string", () => {
    const schema = {
      type: "object",
      properties: {
        label: { type: "string" },
      },
    };
    const result = transformData({ label: 123 }, schema);
    expect(result).toEqual({ label: "123" });
  });

  it("provides defaults for missing required keys", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
        active: { type: "boolean" },
      },
    };
    const result = transformData({}, schema);
    expect(result).toEqual({ name: "", count: 0, active: false });
  });

  it("uses schema default values when available", () => {
    const schema = {
      type: "object",
      properties: {
        status: { type: "string", default: "pending" },
      },
    };
    const result = transformData({}, schema);
    expect(result).toEqual({ status: "pending" });
  });

  it("returns data as-is when schema has no properties", () => {
    const result = transformData({ a: 1 }, { type: "object" });
    expect(result).toEqual({ a: 1 });
  });

  it("returns data as-is when schema is null", () => {
    const result = transformData({ a: 1 }, null);
    expect(result).toEqual({ a: 1 });
  });
});

// ---------------------------------------------------------------------------
// stripSubjectiveQualifiers
// ---------------------------------------------------------------------------

describe("stripSubjectiveQualifiers", () => {
  it("removes qualifiers from a string", () => {
    const result = stripSubjectiveQualifiers("This is an amazing product");
    expect(result).toBe("This is an product");
  });

  it("removes multiple qualifiers", () => {
    const result = stripSubjectiveQualifiers("The best and worst outcome");
    expect(result).toBe("The and outcome");
  });

  it("is case-insensitive", () => {
    const result = stripSubjectiveQualifiers(
      "AMAZING results and Terrible bugs",
    );
    expect(result).toBe("results and bugs");
  });

  it("preserves object structure", () => {
    const data = {
      title: "An incredible report",
      score: 8,
      details: {
        summary: "The worst performance ever",
        tags: ["fantastic", "normal tag"],
      },
    };
    const result = stripSubjectiveQualifiers(data);
    expect(result.title).toBe("An report");
    expect(result.score).toBe(8);
    expect(result.details.summary).toBe("The performance ever");
    expect(result.details.tags).toEqual(["", "normal tag"]);
  });

  it("handles null and undefined", () => {
    expect(stripSubjectiveQualifiers(null)).toBe(null);
    expect(stripSubjectiveQualifiers(undefined)).toBe(undefined);
  });

  it("handles arrays", () => {
    const result = stripSubjectiveQualifiers(["amazing work", "good job"]);
    expect(result).toEqual(["work", "good job"]);
  });

  it("passes through numbers and booleans unchanged", () => {
    expect(stripSubjectiveQualifiers(42)).toBe(42);
    expect(stripSubjectiveQualifiers(true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// logTransfer
// ---------------------------------------------------------------------------

describe("logTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a transfer log entry with correct fields", async () => {
    const mockLogEntry = {
      id: "log-1",
      source_role_id: "source-uuid",
      target_role_id: "target-uuid",
      data_hash: "abc123",
      created_at: "2024-01-01T00:00:00Z",
    };

    supabaseAdmin._mockSingle.mockResolvedValue({
      data: mockLogEntry,
      error: null,
    });

    const result = await logTransfer("source-uuid", "target-uuid", {
      key: "value",
    });

    expect(supabaseAdmin.from).toHaveBeenCalledWith("transfer_logs");
    expect(supabaseAdmin._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_role_id: "source-uuid",
        target_role_id: "target-uuid",
        data_hash: expect.any(String),
      }),
    );
    expect(result.data).toEqual(mockLogEntry);
    expect(result.error).toBeNull();
  });

  it("returns error when supabase insert fails", async () => {
    supabaseAdmin._mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Insert failed", code: "DB_ERROR" },
    });

    const result = await logTransfer("source-uuid", "target-uuid", {
      key: "value",
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      message: "Insert failed",
      code: "DB_ERROR",
    });
  });

  it("handles unexpected exceptions", async () => {
    supabaseAdmin._mockSingle.mockRejectedValue(new Error("Network error"));

    const result = await logTransfer("source-uuid", "target-uuid", {
      key: "value",
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      message: "Network error",
      code: "UNEXPECTED_ERROR",
    });
  });

  it("produces a consistent hash for the same data", async () => {
    supabaseAdmin._mockSingle.mockResolvedValue({
      data: { id: "log-1" },
      error: null,
    });

    await logTransfer("s", "t", { hello: "world" });
    const firstHash = supabaseAdmin._mockInsert.mock.calls[0][0].data_hash;

    await logTransfer("s", "t", { hello: "world" });
    const secondHash = supabaseAdmin._mockInsert.mock.calls[1][0].data_hash;

    expect(firstHash).toBe(secondHash);
  });

  it("produces different hashes for different data", async () => {
    supabaseAdmin._mockSingle.mockResolvedValue({
      data: { id: "log-1" },
      error: null,
    });

    await logTransfer("s", "t", { a: 1 });
    const hash1 = supabaseAdmin._mockInsert.mock.calls[0][0].data_hash;

    await logTransfer("s", "t", { b: 2 });
    const hash2 = supabaseAdmin._mockInsert.mock.calls[1][0].data_hash;

    expect(hash1).not.toBe(hash2);
  });
});
