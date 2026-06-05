import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock axios before importing the module under test
// ---------------------------------------------------------------------------

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: mockGet,
      patch: mockPatch,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks are set up)
// ---------------------------------------------------------------------------

import {
  validateWorkflowDefinition,
  createWorkflow,
  listWorkflows,
  activateWorkflow,
} from "../orchestrator/n8n.js";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeValidDefinition(overrides = {}) {
  return {
    name: "Test Workflow",
    nodes: [
      {
        name: "Start",
        type: "n8n-nodes-base.start",
        position: [250, 300],
        parameters: {},
      },
    ],
    connections: {},
    ...overrides,
  };
}

function makeValidNode(overrides = {}) {
  return {
    name: "HTTP Request",
    type: "n8n-nodes-base.httpRequest",
    position: [450, 300],
    parameters: { url: "https://example.com" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Environment variable setup
// ---------------------------------------------------------------------------

describe("n8n connector", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.VITE_N8N_API_URL = "https://n8n.example.com";
    import.meta.env.VITE_N8N_API_KEY = "test-api-key-123";
  });

  afterEach(() => {
    // Restore original env
    import.meta.env.VITE_N8N_API_URL = originalEnv.VITE_N8N_API_URL;
    import.meta.env.VITE_N8N_API_KEY = originalEnv.VITE_N8N_API_KEY;
  });

  // -------------------------------------------------------------------------
  // validateWorkflowDefinition
  // -------------------------------------------------------------------------

  describe("validateWorkflowDefinition", () => {
    it("returns valid: true for a well-formed definition", () => {
      const result = validateWorkflowDefinition(makeValidDefinition());
      expect(result).toEqual({ valid: true });
    });

    it("rejects null definition", () => {
      const result = validateWorkflowDefinition(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Workflow definition must be a non-null object",
      );
    });

    it("rejects undefined definition", () => {
      const result = validateWorkflowDefinition(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects an array as definition", () => {
      const result = validateWorkflowDefinition([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Workflow definition must be a non-null object",
      );
    });

    it("rejects a string as definition", () => {
      const result = validateWorkflowDefinition("not an object");
      expect(result.valid).toBe(false);
    });

    it("rejects missing name", () => {
      const def = makeValidDefinition();
      delete def.name;
      const result = validateWorkflowDefinition(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"name"')]),
      );
    });

    it("rejects empty string name", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ name: "" }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"name"')]),
      );
    });

    it("rejects whitespace-only name", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ name: "   " }),
      );
      expect(result.valid).toBe(false);
    });

    it("rejects missing nodes", () => {
      const def = makeValidDefinition();
      delete def.nodes;
      const result = validateWorkflowDefinition(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"nodes"')]),
      );
    });

    it("rejects empty nodes array", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("must not be empty")]),
      );
    });

    it("rejects missing connections", () => {
      const def = makeValidDefinition();
      delete def.connections;
      const result = validateWorkflowDefinition(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"connections"')]),
      );
    });

    it("rejects connections as an array", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ connections: [] }),
      );
      expect(result.valid).toBe(false);
    });

    it("rejects connections as null", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ connections: null }),
      );
      expect(result.valid).toBe(false);
    });

    // Node-level validation
    it("rejects a node missing name", () => {
      const node = makeValidNode();
      delete node.name;
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("nodes[0]")]),
      );
    });

    it("rejects a node missing type", () => {
      const node = makeValidNode();
      delete node.type;
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("nodes[0]"),
          expect.stringContaining('"type"'),
        ]),
      );
    });

    it("rejects a node with missing position", () => {
      const node = makeValidNode();
      delete node.position;
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"position"')]),
      );
    });

    it("rejects a node with position of wrong length", () => {
      const node = makeValidNode({ position: [100] });
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"position"')]),
      );
    });

    it("rejects a node with non-numeric position values", () => {
      const node = makeValidNode({ position: ["a", "b"] });
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"position"')]),
      );
    });

    it("rejects a node with missing parameters", () => {
      const node = makeValidNode();
      delete node.parameters;
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"parameters"')]),
      );
    });

    it("rejects a node with parameters as an array", () => {
      const node = makeValidNode({ parameters: [] });
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
    });

    it("rejects a node with parameters as null", () => {
      const node = makeValidNode({ parameters: null });
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [node] }),
      );
      expect(result.valid).toBe(false);
    });

    it("rejects a node that is null", () => {
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [null] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("nodes[0]")]),
      );
    });

    it("validates multiple nodes and reports all errors", () => {
      const badNode1 = {
        name: "",
        type: "x",
        position: [1, 2],
        parameters: {},
      };
      const badNode2 = {
        name: "OK",
        type: "",
        position: [1, 2],
        parameters: {},
      };
      const result = validateWorkflowDefinition(
        makeValidDefinition({ nodes: [badNode1, badNode2] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("accepts a definition with multiple valid nodes", () => {
      const nodes = [
        makeValidNode({
          name: "Start",
          type: "n8n-nodes-base.start",
          position: [100, 200],
        }),
        makeValidNode({
          name: "HTTP",
          type: "n8n-nodes-base.httpRequest",
          position: [300, 200],
        }),
      ];
      const result = validateWorkflowDefinition(makeValidDefinition({ nodes }));
      expect(result).toEqual({ valid: true });
    });

    it("collects multiple top-level errors at once", () => {
      const result = validateWorkflowDefinition({
        name: "",
        nodes: "bad",
        connections: null,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------------------
  // createWorkflow
  // -------------------------------------------------------------------------

  describe("createWorkflow", () => {
    it("returns validation error for invalid definition", async () => {
      const result = await createWorkflow({ name: "" });
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.details.length).toBeGreaterThan(0);
    });

    it("posts valid definition to n8n API and returns data", async () => {
      const definition = makeValidDefinition();
      const mockResponse = {
        data: { id: "wf-1", ...definition, active: false },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await createWorkflow(definition);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse.data);
      expect(mockPost).toHaveBeenCalledWith("/api/v1/workflows", definition);
    });

    it("returns connection error on network failure", async () => {
      const networkError = new Error("connect ECONNREFUSED");
      networkError.code = "ECONNREFUSED";
      networkError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows",
      };
      mockPost.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await createWorkflow(makeValidDefinition());
      consoleSpy.mockRestore();

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.code).toBe("N8N_CONNECTION_ERROR");
      expect(result.error.message).toContain("ECONNREFUSED");
    });

    it("returns error with status details on HTTP error response", async () => {
      const httpError = new Error("Request failed");
      httpError.response = {
        status: 400,
        statusText: "Bad Request",
        data: { message: "Invalid workflow" },
      };
      httpError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows",
      };
      mockPost.mockRejectedValueOnce(httpError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await createWorkflow(makeValidDefinition());
      consoleSpy.mockRestore();

      expect(result.data).toBeNull();
      expect(result.error.message).toContain("400");
      expect(result.error.message).toContain("Invalid workflow");
    });

    it("logs connection failures to console.error", async () => {
      const networkError = new Error("timeout");
      networkError.code = "ECONNABORTED";
      networkError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows",
      };
      mockPost.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await createWorkflow(makeValidDefinition());

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain("createWorkflow");
      consoleSpy.mockRestore();
    });

    it("throws when VITE_N8N_API_URL is missing", async () => {
      import.meta.env.VITE_N8N_API_URL = "";
      const result = await createWorkflow(makeValidDefinition());
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.message).toContain("VITE_N8N_API_URL");
    });

    it("throws when VITE_N8N_API_KEY is missing", async () => {
      import.meta.env.VITE_N8N_API_KEY = "";
      const result = await createWorkflow(makeValidDefinition());
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.message).toContain("VITE_N8N_API_KEY");
    });
  });

  // -------------------------------------------------------------------------
  // listWorkflows
  // -------------------------------------------------------------------------

  describe("listWorkflows", () => {
    it("returns workflows from n8n API", async () => {
      const workflows = [
        { id: "wf-1", name: "Workflow 1", active: true },
        { id: "wf-2", name: "Workflow 2", active: false },
      ];
      mockGet.mockResolvedValueOnce({ data: { data: workflows } });

      const result = await listWorkflows();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(workflows);
      expect(mockGet).toHaveBeenCalledWith("/api/v1/workflows");
    });

    it("handles flat response data (no nested data property)", async () => {
      const workflows = [{ id: "wf-1", name: "Workflow 1" }];
      mockGet.mockResolvedValueOnce({ data: workflows });

      const result = await listWorkflows();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(workflows);
    });

    it("returns connection error on network failure", async () => {
      const networkError = new Error("getaddrinfo ENOTFOUND n8n.example.com");
      networkError.code = "ENOTFOUND";
      networkError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows",
      };
      mockGet.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await listWorkflows();
      consoleSpy.mockRestore();

      expect(result.data).toBeNull();
      expect(result.error.code).toBe("N8N_CONNECTION_ERROR");
      expect(result.error.message).toContain("ENOTFOUND");
    });

    it("logs connection failures to console.error", async () => {
      const networkError = new Error("timeout");
      networkError.config = {};
      mockGet.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await listWorkflows();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain("listWorkflows");
      consoleSpy.mockRestore();
    });

    it("throws when env vars are missing", async () => {
      import.meta.env.VITE_N8N_API_URL = "";
      const result = await listWorkflows();
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.message).toContain("VITE_N8N_API_URL");
    });
  });

  // -------------------------------------------------------------------------
  // activateWorkflow
  // -------------------------------------------------------------------------

  describe("activateWorkflow", () => {
    it("activates a workflow by ID via PATCH", async () => {
      const mockResponse = { data: { id: "wf-1", name: "Test", active: true } };
      mockPatch.mockResolvedValueOnce(mockResponse);

      const result = await activateWorkflow("wf-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockResponse.data);
      expect(mockPatch).toHaveBeenCalledWith("/api/v1/workflows/wf-1", {
        active: true,
      });
    });

    it("returns error for empty workflowId", async () => {
      const result = await activateWorkflow("");
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("INVALID_INPUT");
    });

    it("returns error for null workflowId", async () => {
      const result = await activateWorkflow(null);
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("INVALID_INPUT");
    });

    it("returns error for undefined workflowId", async () => {
      const result = await activateWorkflow(undefined);
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("INVALID_INPUT");
    });

    it("returns error for non-string workflowId", async () => {
      const result = await activateWorkflow(123);
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("INVALID_INPUT");
    });

    it("returns error for whitespace-only workflowId", async () => {
      const result = await activateWorkflow("   ");
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("INVALID_INPUT");
    });

    it("returns connection error on network failure", async () => {
      const networkError = new Error("connect ECONNREFUSED");
      networkError.code = "ECONNREFUSED";
      networkError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows/wf-1",
      };
      mockPatch.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await activateWorkflow("wf-1");
      consoleSpy.mockRestore();

      expect(result.data).toBeNull();
      expect(result.error.code).toBe("N8N_CONNECTION_ERROR");
      expect(result.error.message).toContain("ECONNREFUSED");
    });

    it("logs connection failures to console.error", async () => {
      const networkError = new Error("timeout");
      networkError.config = {};
      mockPatch.mockRejectedValueOnce(networkError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await activateWorkflow("wf-1");

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain("activateWorkflow");
      consoleSpy.mockRestore();
    });

    it("returns error with HTTP status details", async () => {
      const httpError = new Error("Not Found");
      httpError.response = {
        status: 404,
        statusText: "Not Found",
        data: { message: "Workflow not found" },
      };
      httpError.config = {
        baseURL: "https://n8n.example.com",
        url: "/api/v1/workflows/wf-999",
      };
      mockPatch.mockRejectedValueOnce(httpError);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await activateWorkflow("wf-999");
      consoleSpy.mockRestore();

      expect(result.data).toBeNull();
      expect(result.error.message).toContain("404");
      expect(result.error.message).toContain("Workflow not found");
    });

    it("throws when env vars are missing", async () => {
      import.meta.env.VITE_N8N_API_KEY = "";
      const result = await activateWorkflow("wf-1");
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error.message).toContain("VITE_N8N_API_KEY");
    });
  });
});
