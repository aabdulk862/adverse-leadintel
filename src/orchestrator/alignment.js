// ---------------------------------------------------------------------------
// Alignment Check Module
// ---------------------------------------------------------------------------
// Provides formatting for alignment checks (presenting the proposed plan to
// the user for approval) and parsing of the user's response.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Approval keywords — case-insensitive matching
// ---------------------------------------------------------------------------

const APPROVAL_KEYWORDS = [
  "approve",
  "yes",
  "ok",
  "looks good",
  "proceed",
  "go ahead",
  "confirmed",
  "lgtm",
];

// ---------------------------------------------------------------------------
// formatAlignmentCheck
// ---------------------------------------------------------------------------

/**
 * Formats the proposed plan for display, showing task names, assigned agent
 * roles, execution order, and expected outputs.
 *
 * @param {object[]} tasks - Array of task objects with at least: name, agent_role_id, input_data, depends_on
 * @param {object[]} agentRoles - Array of agent role objects with at least: id, name, output_schema
 * @returns {string} A human-readable formatted alignment check string
 */
export function formatAlignmentCheck(tasks, agentRoles) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return "⚠️ No tasks to display in the alignment check.";
  }

  if (!Array.isArray(agentRoles) || agentRoles.length === 0) {
    return "⚠️ No agent roles available for the alignment check.";
  }

  // Build a lookup map from role id to role object
  const roleMap = new Map();
  for (const role of agentRoles) {
    roleMap.set(role.id, role);
  }

  const lines = [];

  lines.push("═══════════════════════════════════════════════════");
  lines.push("  📋 Proposed Execution Plan — Alignment Check");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const role = roleMap.get(task.agent_role_id);
    const roleName = role ? role.name : "Unknown Role";
    const order = i + 1;

    lines.push(`Step ${order}: ${task.name}`);
    lines.push(`  Agent Role: ${roleName}`);
    lines.push(`  Execution Order: ${order} of ${tasks.length}`);

    // Expected outputs derived from the role's output_schema
    const expectedOutputs = describeExpectedOutputs(role);
    lines.push(`  Expected Outputs: ${expectedOutputs}`);

    // Show dependencies if any
    if (task.depends_on && task.depends_on.length > 0) {
      const depNames = task.depends_on
        .map((depId) => {
          const depTask = tasks.find(
            (t) => t.id === depId || t._temp_id === depId,
          );
          return depTask ? depTask.name : depId;
        })
        .join(", ");
      lines.push(`  Depends On: ${depNames}`);
    }

    lines.push("");
  }

  lines.push("───────────────────────────────────────────────────");
  lines.push(`Total Tasks: ${tasks.length}`);
  lines.push("");
  lines.push('Reply "approve" to proceed or provide feedback to revise.');

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// parseAlignmentResponse
// ---------------------------------------------------------------------------

/**
 * Parses the user's response to an alignment check.
 *
 * Approval keywords (case-insensitive): "approve", "yes", "ok", "looks good",
 * "proceed", "go ahead", "confirmed", "lgtm".
 *
 * Anything else is treated as a rejection with the response text as feedback.
 *
 * @param {string} response - The user's response string
 * @returns {{ approved: boolean, feedback?: string }}
 */
export function parseAlignmentResponse(response) {
  if (!response || typeof response !== "string" || response.trim() === "") {
    return { approved: false, feedback: "" };
  }

  const normalised = response.trim().toLowerCase();

  for (const keyword of APPROVAL_KEYWORDS) {
    if (normalised === keyword || normalised.includes(keyword)) {
      return { approved: true };
    }
  }

  // Not an approval — return the original response as feedback
  return { approved: false, feedback: response.trim() };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Produces a human-readable description of expected outputs from an agent
 * role's output_schema. Falls back to a generic description when the schema
 * is missing or empty.
 *
 * @param {object|undefined} role - The agent role object
 * @returns {string}
 */
function describeExpectedOutputs(role) {
  if (!role || !role.output_schema) {
    return "Structured output (schema not specified)";
  }

  const schema = role.output_schema;

  // If the schema has top-level properties, list them
  if (schema.properties && typeof schema.properties === "object") {
    const keys = Object.keys(schema.properties);
    if (keys.length > 0) {
      return keys.join(", ");
    }
  }

  // If the schema has a type, mention it
  if (schema.type) {
    return `${schema.type} output`;
  }

  return "Structured output";
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { APPROVAL_KEYWORDS };
