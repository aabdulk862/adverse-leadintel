import {
  getActiveAgentRoles,
  getAgentRoleById,
  createAgentRole,
} from "../orchestrator/db.js";

// ---------------------------------------------------------------------------
// Persistence mode: use in-memory defaults when Supabase service-role key
// is not configured (i.e. no VITE_SUPABASE_SERVICE_ROLE_KEY in env).
// This lets the agent console work without any backend.
// ---------------------------------------------------------------------------

const USE_MEMORY = !import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Required fields for a valid agent role configuration
// ---------------------------------------------------------------------------

const REQUIRED_ROLE_FIELDS = [
  "name",
  "description",
  "role_type",
  "system_prompt",
  "input_schema",
  "output_schema",
  "status",
];

const VALID_ROLE_TYPES = [
  "planner",
  "research",
  "builder",
  "audit",
  "automation",
];
const VALID_STATUSES = ["active", "inactive", "draft"];

// ---------------------------------------------------------------------------
// Default agent roles seed data
// ---------------------------------------------------------------------------

const DEFAULT_ROLES = [
  {
    name: "Planner",
    description:
      "Decomposes goals into structured plans and synthesizes findings into reports",
    role_type: "planner",
    system_prompt:
      "You are a planning agent. Your job is to decompose high-level goals into structured, actionable plans and synthesize findings from other agents into coherent reports. Always produce clear, ordered steps with defined inputs and outputs.",
    input_schema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "The high-level goal to decompose",
        },
        context: {
          type: "string",
          description: "Additional context for planning",
        },
      },
      required: ["goal"],
    },
    output_schema: {
      type: "object",
      properties: {
        plan: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step: { type: "number" },
              description: { type: "string" },
              agent_role: { type: "string" },
              expected_output: { type: "string" },
            },
            required: ["step", "description"],
          },
        },
        summary: { type: "string" },
      },
      required: ["plan", "summary"],
    },
    status: "active",
  },
  {
    name: "Research",
    description: "Gathers and validates information using iterative search",
    role_type: "research",
    system_prompt:
      "You are a research agent. Your job is to gather, validate, and organize information from available sources. Use iterative search to build comprehensive, factual summaries. Always cite your sources and flag uncertain data.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The research query or topic" },
        url: {
          type: "string",
          description: "Optional URL to extract information from",
        },
      },
      required: ["query"],
    },
    output_schema: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              content: { type: "string" },
              confidence: { type: "string" },
            },
            required: ["topic", "content"],
          },
        },
        summary: { type: "string" },
      },
      required: ["findings", "summary"],
    },
    status: "active",
  },
  {
    name: "Builder",
    description: "Generates code, configurations, and structured documents",
    role_type: "builder",
    system_prompt:
      "You are a builder agent. Your job is to generate code, configurations, and structured documents based on specifications. Produce clean, well-documented output that follows best practices for the target format.",
    input_schema: {
      type: "object",
      properties: {
        specification: { type: "string", description: "What to build" },
        format: { type: "string", description: "Target output format" },
        context: {
          type: "string",
          description: "Additional context or constraints",
        },
      },
      required: ["specification"],
    },
    output_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The generated content" },
        format: { type: "string", description: "The output format used" },
        notes: { type: "string", description: "Implementation notes" },
      },
      required: ["content", "format"],
    },
    status: "active",
  },
  {
    name: "Audit",
    description:
      "Evaluates systems, workflows, and designs against quality criteria",
    role_type: "audit",
    system_prompt:
      "You are an audit agent. Your job is to evaluate systems, workflows, and designs against defined quality criteria. Produce structured evaluations with numeric scores, specific findings, and prioritized recommendations. Be objective and evidence-based.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "What to audit" },
        criteria: {
          type: "array",
          items: { type: "string" },
          description: "Quality criteria to evaluate against",
        },
        data: { type: "object", description: "Supporting data for the audit" },
      },
      required: ["target"],
    },
    output_schema: {
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
    },
    status: "active",
  },
  {
    name: "Automation",
    description: "Defines and connects workflow automations via n8n",
    role_type: "automation",
    system_prompt:
      "You are an automation agent. Your job is to define workflow automations compatible with n8n. Produce valid n8n workflow definitions with properly configured nodes, connections, and triggers. Ensure workflows are testable and well-documented.",
    input_schema: {
      type: "object",
      properties: {
        workflow_description: {
          type: "string",
          description: "Description of the workflow to automate",
        },
        triggers: {
          type: "array",
          items: { type: "string" },
          description: "Events that should trigger the workflow",
        },
      },
      required: ["workflow_description"],
    },
    output_schema: {
      type: "object",
      properties: {
        workflow_definition: {
          type: "object",
          description: "n8n-compatible workflow definition",
        },
        description: { type: "string" },
        notes: { type: "string" },
      },
      required: ["workflow_definition", "description"],
    },
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Registry functions
// ---------------------------------------------------------------------------

/**
 * Returns all agent roles with status 'active'.
 * @returns {Promise<AgentRole[]>}
 */
export async function getActiveRoles() {
  if (USE_MEMORY) {
    return DEFAULT_ROLES.map((r) => ({ id: `default-${r.role_type}`, ...r }));
  }
  try {
    const { data, error } = await getActiveAgentRoles();
    if (error) {
      console.warn(
        "[registry] Supabase unavailable, using default roles:",
        error.message,
      );
      return DEFAULT_ROLES.map((r) => ({ id: `default-${r.role_type}`, ...r }));
    }
    return data;
  } catch {
    return DEFAULT_ROLES.map((r) => ({ id: `default-${r.role_type}`, ...r }));
  }
}

/**
 * Returns a single agent role by ID.
 * @param {string} id - Agent role UUID
 * @returns {Promise<AgentRole>}
 */
export async function getRoleById(id) {
  if (!id) {
    throw new Error("getRoleById requires a valid id");
  }
  if (USE_MEMORY) {
    const role = DEFAULT_ROLES.find((r) => `default-${r.role_type}` === id);
    if (!role) throw new Error(`No role found with id "${id}"`);
    return { id, ...role };
  }
  const { data, error } = await getAgentRoleById(id);
  if (error) {
    throw new Error(`Failed to fetch role by id "${id}": ${error.message}`);
  }
  return data;
}

/**
 * Returns the active agent role matching the given role_type.
 * Queries the agent_roles table filtering by role_type and status='active'.
 * @param {string} roleType - One of 'planner', 'research', 'builder', 'audit', 'automation'
 * @returns {Promise<AgentRole>}
 */
export async function getRoleByType(roleType) {
  if (!roleType) {
    throw new Error("getRoleByType requires a valid roleType");
  }
  if (!VALID_ROLE_TYPES.includes(roleType)) {
    throw new Error(
      `Invalid role_type "${roleType}". Must be one of: ${VALID_ROLE_TYPES.join(", ")}`,
    );
  }

  if (USE_MEMORY) {
    const defaultRole = DEFAULT_ROLES.find((r) => r.role_type === roleType);
    if (!defaultRole)
      throw new Error(`No default role found for type "${roleType}"`);
    return { id: `default-${roleType}`, ...defaultRole };
  }

  try {
    const { data, error } = await getActiveAgentRoles();
    if (error) throw new Error(error.message);
    const match = (data || []).find(
      (r) => r.role_type === roleType && r.status === "active",
    );
    if (!match) throw new Error(`No active role for type "${roleType}"`);
    return match;
  } catch (err) {
    throw new Error(
      `Failed to fetch role by type "${roleType}": ${err.message}`,
    );
  }
}

/**
 * Inserts the five default agent roles if they don't already exist.
 * Checks by role_type to avoid duplicates.
 * @returns {Promise<void>}
 */
export async function seedDefaultRoles() {
  const { data: existingRoles, error: fetchError } =
    await getActiveAgentRoles();
  if (fetchError) {
    throw new Error(`Failed to check existing roles: ${fetchError.message}`);
  }

  const existingTypes = new Set((existingRoles || []).map((r) => r.role_type));

  for (const role of DEFAULT_ROLES) {
    if (!existingTypes.has(role.role_type)) {
      const { error: createError } = await createAgentRole(role);
      if (createError) {
        throw new Error(
          `Failed to seed default role "${role.name}": ${createError.message}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Serialization / Deserialization
// ---------------------------------------------------------------------------

/**
 * Serializes an agent role configuration (including JSON Schema fields) to a
 * JSON string.
 * @param {object} role - An agent role object
 * @returns {string} JSON string representation
 */
export function serializeConfig(role) {
  if (!role || typeof role !== "object") {
    throw new Error("serializeConfig requires a valid role object");
  }
  return JSON.stringify(role);
}

/**
 * Deserializes a JSON string back to an agent role configuration object.
 * Validates that all required fields are present and correctly typed.
 * Throws a descriptive error on malformed JSON or missing fields.
 *
 * @param {string} json - JSON string to deserialize
 * @returns {object} The deserialized agent role configuration
 */
export function deserializeConfig(json) {
  if (typeof json !== "string") {
    throw new Error(
      "deserializeConfig requires a JSON string argument, received " +
        typeof json,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Malformed JSON: ${err.message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "Deserialized value must be a plain object, received " +
        (parsed === null
          ? "null"
          : Array.isArray(parsed)
            ? "array"
            : typeof parsed),
    );
  }

  // Validate required fields
  const missingFields = REQUIRED_ROLE_FIELDS.filter(
    (field) => !(field in parsed),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `Agent role config is missing required fields: ${missingFields.join(", ")}`,
    );
  }

  // Validate field types
  if (typeof parsed.name !== "string" || parsed.name.trim() === "") {
    throw new Error('Agent role "name" must be a non-empty string');
  }
  if (typeof parsed.description !== "string") {
    throw new Error('Agent role "description" must be a string');
  }
  if (!VALID_ROLE_TYPES.includes(parsed.role_type)) {
    throw new Error(
      `Agent role "role_type" must be one of: ${VALID_ROLE_TYPES.join(", ")}. Got "${parsed.role_type}"`,
    );
  }
  if (typeof parsed.system_prompt !== "string") {
    throw new Error('Agent role "system_prompt" must be a string');
  }
  if (
    parsed.input_schema === null ||
    typeof parsed.input_schema !== "object" ||
    Array.isArray(parsed.input_schema)
  ) {
    throw new Error(
      'Agent role "input_schema" must be a valid JSON Schema object',
    );
  }
  if (
    parsed.output_schema === null ||
    typeof parsed.output_schema !== "object" ||
    Array.isArray(parsed.output_schema)
  ) {
    throw new Error(
      'Agent role "output_schema" must be a valid JSON Schema object',
    );
  }
  if (!VALID_STATUSES.includes(parsed.status)) {
    throw new Error(
      `Agent role "status" must be one of: ${VALID_STATUSES.join(", ")}. Got "${parsed.status}"`,
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export {
  DEFAULT_ROLES,
  REQUIRED_ROLE_FIELDS,
  VALID_ROLE_TYPES,
  VALID_STATUSES,
};
