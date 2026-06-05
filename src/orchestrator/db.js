import { createClient } from "@supabase/supabase-js";
import { validateAgainstSchema } from "../agents/contracts.js";

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "[db.js] Supabase service-role not configured. DB operations will return errors.",
    );
    return null;
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  return _supabaseAdmin;
}

export { getSupabaseAdmin as supabaseAdmin };

// ---------------------------------------------------------------------------
// Internal helper — get the lazily-initialized client
// ---------------------------------------------------------------------------
const db = () => {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY to enable persistence.",
    );
  }
  return client;
};

// ---------------------------------------------------------------------------
// Pipeline Run operations
// ---------------------------------------------------------------------------

/**
 * Creates a new pipeline run record.
 * @param {object} run - { request_summary: string, status?: string }
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createPipelineRun(run) {
  try {
    const { data, error } = await db()
      .from("pipeline_runs")
      .insert(run)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Updates an existing pipeline run by ID.
 * @param {string} id - Pipeline run UUID
 * @param {object} updates - Partial pipeline run fields to update
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function updatePipelineRun(id, updates) {
  try {
    const { data, error } = await db()
      .from("pipeline_runs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Retrieves a pipeline run by ID.
 * @param {string} id - Pipeline run UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function getPipelineRun(id) {
  try {
    const { data, error } = await db()
      .from("pipeline_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

// ---------------------------------------------------------------------------
// Task operations
// ---------------------------------------------------------------------------

/**
 * Creates multiple tasks in a single insert.
 * @param {object[]} tasks - Array of task objects to insert
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function createTasks(tasks) {
  try {
    const { data, error } = await db().from("tasks").insert(tasks).select();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Updates a single task by ID.
 * @param {string} id - Task UUID
 * @param {object} updates - Partial task fields to update
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function updateTask(id, updates) {
  try {
    const { data, error } = await db()
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Retrieves all tasks for a given pipeline, ordered by created_at.
 * @param {string} pipelineId - Pipeline run UUID
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function getTasksByPipeline(pipelineId) {
  try {
    const { data, error } = await db()
      .from("tasks")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("created_at", { ascending: true });

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

// ---------------------------------------------------------------------------
// Artifact operations
// ---------------------------------------------------------------------------

/**
 * Creates a new artifact record.
 * Validates content against the producing agent role's output_schema before storage.
 * Serializes content to JSON for round-trip guarantee.
 * @param {object} artifact - Artifact data to insert (must include agent_role_id and content)
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createArtifact(artifact) {
  try {
    // Validate content against the producing agent role's output_schema
    if (artifact.agent_role_id && artifact.content !== undefined) {
      const { data: role, error: roleError } = await getAgentRoleById(
        artifact.agent_role_id,
      );

      if (roleError) {
        return {
          data: null,
          error: {
            message: `Failed to fetch agent role for schema validation: ${roleError.message}`,
            code: "ROLE_FETCH_ERROR",
          },
        };
      }

      if (role && role.output_schema) {
        const validation = validateAgainstSchema(
          artifact.content,
          role.output_schema,
        );
        if (!validation.valid) {
          return {
            data: null,
            error: {
              message: `Artifact content does not conform to agent role output_schema: ${validation.errors.join("; ")}`,
              code: "SCHEMA_VALIDATION_ERROR",
              validationErrors: validation.errors,
            },
          };
        }
      }
    }

    // Serialize content to JSON string for round-trip guarantee, then parse back
    // This ensures the content survives a full JSON round-trip before storage
    const serializedContent = JSON.parse(JSON.stringify(artifact.content));

    const artifactToStore = {
      ...artifact,
      content: serializedContent,
    };

    const { data, error } = await db()
      .from("artifacts")
      .insert(artifactToStore)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Deserializes an artifact's content field from JSON.
 * Supabase JSONB typically returns objects, but this handles edge cases
 * where content may be a JSON string that needs parsing.
 * @param {object} artifact - The artifact record from Supabase
 * @returns {{ artifact: object|null, error: object|null }}
 */
function deserializeArtifactContent(artifact) {
  if (!artifact) return { artifact: null, error: null };

  try {
    let content = artifact.content;

    // If content is a string, attempt to parse it as JSON
    if (typeof content === "string") {
      content = JSON.parse(content);
    }

    // Verify round-trip: serialize and deserialize to ensure structural integrity
    content = JSON.parse(JSON.stringify(content));

    return { artifact: { ...artifact, content }, error: null };
  } catch (err) {
    return {
      artifact: null,
      error: {
        message: `Failed to deserialize artifact content for artifact ${artifact.id}: ${err.message}`,
        code: "DESERIALIZATION_ERROR",
        artifactId: artifact.id,
      },
    };
  }
}

/**
 * Retrieves artifacts with optional filtering by artifact_type.
 * Results are sorted by created_at descending (newest first).
 * Deserializes content fields back to structured objects.
 * @param {object} [filters={}] - Optional filters
 * @param {string} [filters.artifact_type] - Filter by artifact type
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function getArtifacts(filters = {}) {
  try {
    let query = db()
      .from("artifacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.artifact_type) {
      query = query.eq("artifact_type", filters.artifact_type);
    }

    const { data, error } = await query;

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };

    // Deserialize content for each artifact
    const deserialized = [];
    const deserializationErrors = [];

    for (const artifact of data) {
      const result = deserializeArtifactContent(artifact);
      if (result.error) {
        deserializationErrors.push(result.error);
      } else {
        deserialized.push(result.artifact);
      }
    }

    if (deserializationErrors.length > 0) {
      return {
        data: deserialized,
        error: {
          message: `Failed to deserialize ${deserializationErrors.length} artifact(s)`,
          code: "PARTIAL_DESERIALIZATION_ERROR",
          details: deserializationErrors,
        },
      };
    }

    return { data: deserialized, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Retrieves a single artifact by ID.
 * Deserializes content field back to a structured object.
 * @param {string} id - Artifact UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function getArtifactById(id) {
  try {
    const { data, error } = await db()
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };

    // Deserialize content
    const result = deserializeArtifactContent(data);
    if (result.error) {
      return { data: null, error: result.error };
    }

    return { data: result.artifact, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

// ---------------------------------------------------------------------------
// Agent Role operations
// ---------------------------------------------------------------------------

/**
 * Retrieves all agent roles with status 'active'.
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function getActiveAgentRoles() {
  try {
    const { data, error } = await db()
      .from("agent_roles")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Retrieves a single agent role by ID.
 * @param {string} id - Agent role UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function getAgentRoleById(id) {
  try {
    const { data, error } = await db()
      .from("agent_roles")
      .select("*")
      .eq("id", id)
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Creates a new agent role.
 * @param {object} role - Agent role data to insert
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createAgentRole(role) {
  try {
    const { data, error } = await db()
      .from("agent_roles")
      .insert(role)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}

/**
 * Updates an existing agent role by ID.
 * @param {string} id - Agent role UUID
 * @param {object} updates - Partial agent role fields to update
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function updateAgentRole(id, updates) {
  try {
    const { data, error } = await db()
      .from("agent_roles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}
