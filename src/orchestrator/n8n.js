// ---------------------------------------------------------------------------
// n8n Workflow Connector
// ---------------------------------------------------------------------------
// Connects to an n8n instance via REST API for creating, listing, and
// activating workflows. Validates workflow definitions against the expected
// n8n schema before submission.
// ---------------------------------------------------------------------------
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

import axios from "axios";

// ---------------------------------------------------------------------------
// Environment helpers (checked at call time, not module load)
// ---------------------------------------------------------------------------

/**
 * Reads and validates the required n8n environment variables.
 * Throws a descriptive error if either is missing.
 *
 * @returns {{ apiUrl: string, apiKey: string }}
 */
function getN8nConfig() {
  const apiUrl = import.meta.env.VITE_N8N_API_URL;
  const apiKey = import.meta.env.VITE_N8N_API_KEY;

  if (!apiUrl || typeof apiUrl !== "string" || apiUrl.trim() === "") {
    throw new Error(
      "Missing required environment variable VITE_N8N_API_URL. " +
        "Set it to the base URL of your n8n instance (e.g. https://n8n.example.com).",
    );
  }

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error(
      "Missing required environment variable VITE_N8N_API_KEY. " +
        "Set it to a valid n8n API key for authentication.",
    );
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""), // strip trailing slashes
    apiKey,
  };
}

/**
 * Builds an axios instance configured with the n8n base URL and API key header.
 *
 * @returns {import('axios').AxiosInstance}
 */
function createN8nClient() {
  const { apiUrl, apiKey } = getN8nConfig();

  return axios.create({
    baseURL: apiUrl,
    headers: {
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// validateWorkflowDefinition
// ---------------------------------------------------------------------------

/**
 * Validates a workflow definition against the expected n8n workflow schema.
 *
 * A valid n8n workflow definition must have:
 * - name: non-empty string
 * - nodes: non-empty array where each node has:
 *   - name: non-empty string
 *   - type: non-empty string
 *   - position: array of exactly 2 numbers
 *   - parameters: object
 * - connections: object
 *
 * @param {object} definition - The workflow definition to validate
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateWorkflowDefinition(definition) {
  const errors = [];

  if (
    !definition ||
    typeof definition !== "object" ||
    Array.isArray(definition)
  ) {
    return {
      valid: false,
      errors: ["Workflow definition must be a non-null object"],
    };
  }

  // Validate name
  if (
    !definition.name ||
    typeof definition.name !== "string" ||
    definition.name.trim() === ""
  ) {
    errors.push('Workflow definition must have a non-empty "name" string');
  }

  // Validate nodes
  if (!Array.isArray(definition.nodes)) {
    errors.push('Workflow definition must have a "nodes" array');
  } else if (definition.nodes.length === 0) {
    errors.push('Workflow definition "nodes" array must not be empty');
  } else {
    for (let i = 0; i < definition.nodes.length; i++) {
      const node = definition.nodes[i];
      const prefix = `nodes[${i}]`;

      if (!node || typeof node !== "object" || Array.isArray(node)) {
        errors.push(`${prefix}: must be a non-null object`);
        continue;
      }

      if (
        !node.name ||
        typeof node.name !== "string" ||
        node.name.trim() === ""
      ) {
        errors.push(`${prefix}: must have a non-empty "name" string`);
      }

      if (
        !node.type ||
        typeof node.type !== "string" ||
        node.type.trim() === ""
      ) {
        errors.push(`${prefix}: must have a non-empty "type" string`);
      }

      if (!Array.isArray(node.position) || node.position.length !== 2) {
        errors.push(
          `${prefix}: must have a "position" array of exactly 2 numbers`,
        );
      } else if (
        typeof node.position[0] !== "number" ||
        typeof node.position[1] !== "number"
      ) {
        errors.push(
          `${prefix}: "position" array must contain exactly 2 numbers`,
        );
      }

      if (
        node.parameters === null ||
        node.parameters === undefined ||
        typeof node.parameters !== "object" ||
        Array.isArray(node.parameters)
      ) {
        errors.push(`${prefix}: must have a "parameters" object`);
      }
    }
  }

  // Validate connections
  if (
    definition.connections === null ||
    definition.connections === undefined ||
    typeof definition.connections !== "object" ||
    Array.isArray(definition.connections)
  ) {
    errors.push('Workflow definition must have a "connections" object');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// createWorkflow
// ---------------------------------------------------------------------------

/**
 * Validates a workflow definition and creates it in the n8n instance via
 * the REST API.
 *
 * @param {object} definition - The n8n workflow definition
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createWorkflow(definition) {
  // Validate first
  const validation = validateWorkflowDefinition(definition);
  if (!validation.valid) {
    return {
      data: null,
      error: {
        message: "Workflow definition validation failed",
        code: "VALIDATION_ERROR",
        details: validation.errors,
      },
    };
  }

  try {
    const client = createN8nClient();
    const response = await client.post("/api/v1/workflows", definition);
    return { data: response.data, error: null };
  } catch (err) {
    const errorMessage = formatConnectionError(err, "createWorkflow");
    console.error(errorMessage);
    return {
      data: null,
      error: {
        message: errorMessage,
        code: "N8N_CONNECTION_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// listWorkflows
// ---------------------------------------------------------------------------

/**
 * Lists all workflows from the connected n8n instance.
 *
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function listWorkflows() {
  try {
    const client = createN8nClient();
    const response = await client.get("/api/v1/workflows");
    return { data: response.data?.data || response.data, error: null };
  } catch (err) {
    const errorMessage = formatConnectionError(err, "listWorkflows");
    console.error(errorMessage);
    return {
      data: null,
      error: {
        message: errorMessage,
        code: "N8N_CONNECTION_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// activateWorkflow
// ---------------------------------------------------------------------------

/**
 * Activates a workflow by ID in the connected n8n instance.
 *
 * @param {string} workflowId - The n8n workflow ID to activate
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function activateWorkflow(workflowId) {
  if (
    !workflowId ||
    typeof workflowId !== "string" ||
    workflowId.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message:
          "activateWorkflow requires a valid non-empty workflowId string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    const client = createN8nClient();
    const response = await client.patch(`/api/v1/workflows/${workflowId}`, {
      active: true,
    });
    return { data: response.data, error: null };
  } catch (err) {
    const errorMessage = formatConnectionError(err, "activateWorkflow");
    console.error(errorMessage);
    return {
      data: null,
      error: {
        message: errorMessage,
        code: "N8N_CONNECTION_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

/**
 * Formats a connection error into a descriptive message including the
 * operation name, URL, and underlying error details.
 *
 * @param {Error} err - The caught error (typically an AxiosError)
 * @param {string} operation - The name of the operation that failed
 * @returns {string}
 */
function formatConnectionError(err, operation) {
  const parts = [`n8n ${operation} failed`];

  if (
    err.code === "ECONNREFUSED" ||
    err.code === "ENOTFOUND" ||
    err.code === "ECONNABORTED"
  ) {
    parts.push(`Network error: ${err.code}`);
  }

  if (err.config?.baseURL) {
    parts.push(`URL: ${err.config.baseURL}${err.config?.url || ""}`);
  }

  if (err.response) {
    parts.push(`Status: ${err.response.status}`);
    const detail = err.response.data?.message || err.response.statusText;
    if (detail) {
      parts.push(`Detail: ${detail}`);
    }
  } else if (err.message) {
    parts.push(`Error: ${err.message}`);
  }

  return parts.join(" — ");
}
