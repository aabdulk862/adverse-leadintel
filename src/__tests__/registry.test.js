import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the db module before importing registry
// ---------------------------------------------------------------------------

vi.mock("../orchestrator/db.js", () => {
  const mockFrom = vi.fn();
  const supabaseAdmin = vi.fn(() => ({ from: mockFrom }));
  supabaseAdmin.from = mockFrom;
  return {
    supabaseAdmin,
    getActiveAgentRoles: vi.fn(),
    getAgentRoleById: vi.fn(),
    createAgentRole: vi.fn(),
  };
});

import {
  getActiveRoles,
  getRoleById,
  getRoleByType,
  seedDefaultRoles,
  serializeConfig,
  deserializeConfig,
  DEFAULT_ROLES,
  REQUIRED_ROLE_FIELDS,
  VALID_ROLE_TYPES,
  VALID_STATUSES,
} from "../agents/registry.js";

import {
  supabaseAdmin,
  getActiveAgentRoles,
  getAgentRoleById,
  createAgentRole,
} from "../orchestrator/db.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRole(overrides = {}) {
  return {
    id: "uuid-1",
    name: "Planner",
    description: "Plans things",
    role_type: "planner",
    system_prompt: "You are a planner.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", properties: {} },
    status: "active",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registry.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getActiveRoles
  // -------------------------------------------------------------------------

  describe("getActiveRoles", () => {
    it("returns default roles in memory mode (no service-role key)", async () => {
      const result = await getActiveRoles();
      expect(result).toHaveLength(5);
      expect(result[0].id).toBe("default-planner");
      expect(result[0].name).toBe("Planner");
      expect(result[4].id).toBe("default-automation");
    });

    it("returns all five role types", async () => {
      const result = await getActiveRoles();
      const types = result.map((r) => r.role_type);
      expect(types).toEqual([
        "planner",
        "research",
        "builder",
        "audit",
        "automation",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // getRoleById
  // -------------------------------------------------------------------------

  describe("getRoleById", () => {
    it("returns a default role by id in memory mode", async () => {
      const result = await getRoleById("default-planner");
      expect(result.name).toBe("Planner");
      expect(result.role_type).toBe("planner");
      expect(result.id).toBe("default-planner");
    });

    it("throws when id is falsy", async () => {
      await expect(getRoleById("")).rejects.toThrow("requires a valid id");
      await expect(getRoleById(null)).rejects.toThrow("requires a valid id");
      await expect(getRoleById(undefined)).rejects.toThrow(
        "requires a valid id",
      );
    });

    it("throws when id does not match any default role", async () => {
      await expect(getRoleById("bad-id")).rejects.toThrow(
        "No role found with id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // getRoleByType
  // -------------------------------------------------------------------------

  describe("getRoleByType", () => {
    it("returns the matching default role by type in memory mode", async () => {
      const result = await getRoleByType("planner");
      expect(result.id).toBe("default-planner");
      expect(result.name).toBe("Planner");
      expect(result.role_type).toBe("planner");
      expect(result.status).toBe("active");
    });

    it("throws when roleType is falsy", async () => {
      await expect(getRoleByType("")).rejects.toThrow(
        "requires a valid roleType",
      );
    });

    it("throws for invalid role type", async () => {
      await expect(getRoleByType("invalid")).rejects.toThrow(
        "Invalid role_type",
      );
    });

    it("returns each of the five role types", async () => {
      for (const type of [
        "planner",
        "research",
        "builder",
        "audit",
        "automation",
      ]) {
        const result = await getRoleByType(type);
        expect(result.role_type).toBe(type);
        expect(result.id).toBe(`default-${type}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // seedDefaultRoles
  // -------------------------------------------------------------------------

  describe("seedDefaultRoles", () => {
    it("seeds all five roles when none exist", async () => {
      getActiveAgentRoles.mockResolvedValue({ data: [], error: null });
      createAgentRole.mockResolvedValue({ data: {}, error: null });

      await seedDefaultRoles();

      expect(createAgentRole).toHaveBeenCalledTimes(5);
      const seededTypes = createAgentRole.mock.calls.map((c) => c[0].role_type);
      expect(seededTypes).toEqual(
        expect.arrayContaining([
          "planner",
          "research",
          "builder",
          "audit",
          "automation",
        ]),
      );
    });

    it("skips roles that already exist", async () => {
      getActiveAgentRoles.mockResolvedValue({
        data: [
          makeRole({ role_type: "planner" }),
          makeRole({ role_type: "research" }),
        ],
        error: null,
      });
      createAgentRole.mockResolvedValue({ data: {}, error: null });

      await seedDefaultRoles();

      expect(createAgentRole).toHaveBeenCalledTimes(3);
      const seededTypes = createAgentRole.mock.calls.map((c) => c[0].role_type);
      expect(seededTypes).not.toContain("planner");
      expect(seededTypes).not.toContain("research");
      expect(seededTypes).toEqual(
        expect.arrayContaining(["builder", "audit", "automation"]),
      );
    });

    it("does not seed any roles when all exist", async () => {
      getActiveAgentRoles.mockResolvedValue({
        data: VALID_ROLE_TYPES.map((t) => makeRole({ role_type: t })),
        error: null,
      });

      await seedDefaultRoles();

      expect(createAgentRole).not.toHaveBeenCalled();
    });

    it("throws when fetching existing roles fails", async () => {
      getActiveAgentRoles.mockResolvedValue({
        data: null,
        error: { message: "db down" },
      });

      await expect(seedDefaultRoles()).rejects.toThrow(
        "Failed to check existing roles",
      );
    });

    it("throws when creating a role fails", async () => {
      getActiveAgentRoles.mockResolvedValue({ data: [], error: null });
      createAgentRole.mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
      });

      await expect(seedDefaultRoles()).rejects.toThrow(
        "Failed to seed default role",
      );
    });
  });

  // -------------------------------------------------------------------------
  // DEFAULT_ROLES shape
  // -------------------------------------------------------------------------

  describe("DEFAULT_ROLES", () => {
    it("contains exactly five roles", () => {
      expect(DEFAULT_ROLES).toHaveLength(5);
    });

    it("covers all five role types", () => {
      const types = DEFAULT_ROLES.map((r) => r.role_type);
      expect(types).toEqual(
        expect.arrayContaining([
          "planner",
          "research",
          "builder",
          "audit",
          "automation",
        ]),
      );
    });

    it.each(DEFAULT_ROLES)("$name has all required fields", (role) => {
      for (const field of REQUIRED_ROLE_FIELDS) {
        expect(role).toHaveProperty(field);
      }
      expect(role.status).toBe("active");
      expect(VALID_ROLE_TYPES).toContain(role.role_type);
      expect(typeof role.input_schema).toBe("object");
      expect(typeof role.output_schema).toBe("object");
    });
  });

  // -------------------------------------------------------------------------
  // serializeConfig
  // -------------------------------------------------------------------------

  describe("serializeConfig", () => {
    it("serializes a role to a JSON string", () => {
      const role = makeRole();
      const json = serializeConfig(role);
      expect(typeof json).toBe("string");
      expect(JSON.parse(json)).toEqual(role);
    });

    it("throws for null input", () => {
      expect(() => serializeConfig(null)).toThrow(
        "requires a valid role object",
      );
    });

    it("throws for non-object input", () => {
      expect(() => serializeConfig("string")).toThrow(
        "requires a valid role object",
      );
    });
  });

  // -------------------------------------------------------------------------
  // deserializeConfig
  // -------------------------------------------------------------------------

  describe("deserializeConfig", () => {
    it("deserializes a valid JSON string to a role config", () => {
      const role = makeRole();
      const json = JSON.stringify(role);
      const result = deserializeConfig(json);
      expect(result).toEqual(role);
    });

    it("round-trips through serialize then deserialize", () => {
      const role = makeRole();
      const result = deserializeConfig(serializeConfig(role));
      expect(result).toEqual(role);
    });

    it("throws for non-string input", () => {
      expect(() => deserializeConfig(123)).toThrow(
        "requires a JSON string argument",
      );
      expect(() => deserializeConfig(null)).toThrow(
        "requires a JSON string argument",
      );
    });

    it("throws for malformed JSON", () => {
      expect(() => deserializeConfig("{bad json}")).toThrow("Malformed JSON");
    });

    it("throws for JSON that parses to null", () => {
      expect(() => deserializeConfig("null")).toThrow("must be a plain object");
    });

    it("throws for JSON that parses to an array", () => {
      expect(() => deserializeConfig("[]")).toThrow("must be a plain object");
    });

    it("throws for JSON that parses to a primitive", () => {
      expect(() => deserializeConfig('"hello"')).toThrow(
        "must be a plain object",
      );
    });

    it("throws when required fields are missing", () => {
      const partial = JSON.stringify({ name: "Test" });
      expect(() => deserializeConfig(partial)).toThrow(
        "missing required fields",
      );
    });

    it("lists all missing fields in the error", () => {
      try {
        deserializeConfig("{}");
      } catch (err) {
        for (const field of REQUIRED_ROLE_FIELDS) {
          expect(err.message).toContain(field);
        }
      }
    });

    it("throws for empty name", () => {
      const role = makeRole({ name: "  " });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"name" must be a non-empty string',
      );
    });

    it("throws for invalid role_type", () => {
      const role = makeRole({ role_type: "invalid" });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"role_type" must be one of',
      );
    });

    it("throws for invalid status", () => {
      const role = makeRole({ status: "deleted" });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"status" must be one of',
      );
    });

    it("throws when input_schema is not an object", () => {
      const role = makeRole({ input_schema: "not-an-object" });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"input_schema" must be a valid JSON Schema object',
      );
    });

    it("throws when output_schema is null", () => {
      const role = makeRole({ output_schema: null });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"output_schema" must be a valid JSON Schema object',
      );
    });

    it("throws when output_schema is an array", () => {
      const role = makeRole({ output_schema: [1, 2, 3] });
      expect(() => deserializeConfig(JSON.stringify(role))).toThrow(
        '"output_schema" must be a valid JSON Schema object',
      );
    });
  });
});
