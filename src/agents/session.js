import crypto from "crypto";
import { validateAgainstSchema } from "./contracts.js";
import { createArtifact, updateTask } from "../orchestrator/db.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONTEXT_WINDOW_LIMIT = 128_000;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/**
 * Creates a new isolated agent session with the role's system prompt,
 * task inputs, empty conversation history, and retry count of 0.
 *
 * @param {object} agentRole - The agent role object (must include system_prompt)
 * @param {object} taskInput - The task input data (must include task_id)
 * @returns {object} A new AgentSession object
 */
export function createSession(agentRole, taskInput) {
  if (!agentRole || typeof agentRole !== "object") {
    throw new Error("createSession requires a valid agentRole object");
  }
  if (!taskInput || typeof taskInput !== "object") {
    throw new Error("createSession requires a valid taskInput object");
  }

  return {
    id: crypto.randomUUID(),
    agent_role: structuredClone(agentRole),
    task_id: taskInput.task_id || null,
    system_prompt: agentRole.system_prompt,
    input_data: structuredClone(taskInput),
    conversation_history: [],
    context_window_used: 0,
    context_window_limit: DEFAULT_CONTEXT_WINDOW_LIMIT,
    retry_count: 0,
    max_retries: MAX_RETRIES,
  };
}

// ---------------------------------------------------------------------------
// Session execution
// ---------------------------------------------------------------------------

/**
 * Runs the agent session and produces output artifacts.
 *
 * This is a simulation of agent execution — in a real system this would call
 * an LLM API. Here it constructs a user message from the input data, appends
 * it to the conversation history, generates a placeholder output conforming
 * to the agent role's output schema, and returns a SessionResult.
 *
 * @param {object} session - An AgentSession object
 * @returns {Promise<{ success: boolean, output?: object, error?: string, session: object }>}
 */
export async function executeSession(session) {
  if (!session || typeof session !== "object") {
    throw new Error("executeSession requires a valid session object");
  }

  try {
    // Add the task input as a user message in the conversation
    const userMessage = {
      role: "user",
      content: JSON.stringify(session.input_data),
    };
    session.conversation_history.push(userMessage);

    // Update context window usage estimate (rough character count)
    session.context_window_used = estimateContextUsage(session);

    // Check for context window overflow
    if (session.context_window_used > session.context_window_limit) {
      const summary = summarizeContext(session);
      const continuationSession = createContinuationSession(session, summary);
      return executeSession(continuationSession);
    }

    // Simulate agent producing output based on the role and input
    const output = generateOutput(session);

    // Add assistant response to conversation history
    const assistantMessage = {
      role: "assistant",
      content: JSON.stringify(output),
    };
    session.conversation_history.push(assistantMessage);

    // Validate output against the agent role's output schema
    const validation = validateOutput(output, session.agent_role.output_schema);

    if (!validation.valid) {
      return {
        success: false,
        error: `Output validation failed: ${validation.errors.join("; ")}`,
        session,
      };
    }

    // Store the artifact if we have a task_id
    if (session.task_id) {
      await storeArtifact(session, output);
    }

    return {
      success: true,
      output,
      session,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      session,
    };
  }
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------

/**
 * Validates session output against the agent role's output schema.
 * Delegates to the validateAgainstSchema function from contracts.js.
 *
 * @param {object} output - The output data to validate
 * @param {object} outputSchema - A JSON Schema object
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateOutput(output, outputSchema) {
  if (!outputSchema || typeof outputSchema !== "object") {
    // If no schema is provided, consider the output valid
    return { valid: true };
  }

  return validateAgainstSchema(output, outputSchema);
}

// ---------------------------------------------------------------------------
// Session retry
// ---------------------------------------------------------------------------

/**
 * Retries a session with a correction prompt. Increments retry_count,
 * adds the correction prompt to conversation_history, and re-executes.
 * After max_retries (3) exhaustion, returns a failure result and marks
 * the task as failed.
 *
 * @param {object} session - An AgentSession object
 * @param {string} correctionPrompt - The correction prompt to guide the retry
 * @returns {Promise<{ success: boolean, output?: object, error?: string, session: object }>}
 */
export async function retrySession(session, correctionPrompt) {
  if (!session || typeof session !== "object") {
    throw new Error("retrySession requires a valid session object");
  }
  if (typeof correctionPrompt !== "string" || correctionPrompt.trim() === "") {
    throw new Error(
      "retrySession requires a non-empty correctionPrompt string",
    );
  }

  session.retry_count += 1;

  if (session.retry_count > session.max_retries) {
    // Mark task as failed after exhausting retries
    if (session.task_id) {
      await updateTask(session.task_id, { status: "failed" });
    }

    return {
      success: false,
      error: `Max retries (${session.max_retries}) exhausted. Task marked as failed.`,
      session,
    };
  }

  // Add correction prompt to conversation history
  session.conversation_history.push({
    role: "user",
    content: correctionPrompt,
  });

  // Re-execute the session
  return executeSession(session);
}

// ---------------------------------------------------------------------------
// Context summarization
// ---------------------------------------------------------------------------

/**
 * Summarizes the session's conversation history for context window overflow
 * handling. Produces a condensed string from the conversation history.
 *
 * @param {object} session - An AgentSession object
 * @returns {string} A summary string of the session's conversation
 */
export function summarizeContext(session) {
  if (!session || typeof session !== "object") {
    throw new Error("summarizeContext requires a valid session object");
  }

  if (
    !session.conversation_history ||
    session.conversation_history.length === 0
  ) {
    return `Session ${session.id} for role "${session.agent_role?.name || "unknown"}": No conversation history.`;
  }

  const roleDescription = session.agent_role?.name || "unknown";
  const messageCount = session.conversation_history.length;

  // Build a condensed summary from conversation history
  const summaryParts = [
    `Agent role: ${roleDescription}`,
    `Messages exchanged: ${messageCount}`,
  ];

  // Include a condensed version of each message
  for (const message of session.conversation_history) {
    const truncatedContent =
      message.content.length > 200
        ? message.content.slice(0, 200) + "..."
        : message.content;
    summaryParts.push(`[${message.role}]: ${truncatedContent}`);
  }

  if (session.input_data) {
    summaryParts.push(
      `Original input: ${JSON.stringify(session.input_data).slice(0, 300)}`,
    );
  }

  return summaryParts.join("\n");
}

// ---------------------------------------------------------------------------
// Continuation session
// ---------------------------------------------------------------------------

/**
 * Creates a new session with the summary as initial context, resetting
 * conversation_history to contain just the summary message.
 *
 * @param {object} session - The original AgentSession object
 * @param {string} summary - The context summary string
 * @returns {object} A new AgentSession with the summary as initial context
 */
export function createContinuationSession(session, summary) {
  if (!session || typeof session !== "object") {
    throw new Error(
      "createContinuationSession requires a valid session object",
    );
  }
  if (typeof summary !== "string" || summary.trim() === "") {
    throw new Error(
      "createContinuationSession requires a non-empty summary string",
    );
  }

  return {
    id: crypto.randomUUID(),
    agent_role: structuredClone(session.agent_role),
    task_id: session.task_id,
    system_prompt: session.system_prompt,
    input_data: structuredClone(session.input_data),
    conversation_history: [
      {
        role: "system",
        content: `Context summary from previous session: ${summary}`,
      },
    ],
    context_window_used: summary.length,
    context_window_limit: session.context_window_limit,
    retry_count: session.retry_count,
    max_retries: session.max_retries,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Estimates the context window usage based on the session's conversation
 * history and system prompt.
 * @param {object} session
 * @returns {number} Estimated character count
 */
function estimateContextUsage(session) {
  let total = (session.system_prompt || "").length;

  for (const message of session.conversation_history) {
    total += (message.content || "").length;
  }

  return total;
}

/**
 * Generates a placeholder output based on the agent role's output schema.
 * In a real system, this would be replaced by an LLM API call.
 * @param {object} session
 * @returns {object}
 */
function generateOutput(session) {
  const schema = session.agent_role?.output_schema;
  if (!schema || !schema.properties) {
    return {};
  }

  const output = {};
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    output[key] = generateDefaultValue(propSchema);
  }

  return output;
}

/**
 * Generates a default value for a given JSON Schema property.
 * @param {object} propSchema
 * @returns {*}
 */
function generateDefaultValue(propSchema) {
  if (!propSchema || !propSchema.type) return null;

  switch (propSchema.type) {
    case "string":
      return propSchema.default || "generated content";
    case "number":
    case "integer":
      return propSchema.default || 0;
    case "boolean":
      return propSchema.default || false;
    case "array":
      return propSchema.default || [];
    case "object":
      if (propSchema.properties) {
        const obj = {};
        for (const [key, nested] of Object.entries(propSchema.properties)) {
          obj[key] = generateDefaultValue(nested);
        }
        return obj;
      }
      return propSchema.default || {};
    default:
      return null;
  }
}

/**
 * Stores the session output as an artifact in Supabase.
 * @param {object} session
 * @param {object} output
 * @returns {Promise<void>}
 */
async function storeArtifact(session, output) {
  const artifactType = inferArtifactType(session.agent_role?.role_type);

  await createArtifact({
    task_id: session.task_id,
    agent_role_id: session.agent_role?.id,
    artifact_type: artifactType,
    content: output,
  });
}

/**
 * Infers the artifact type from the agent role type.
 * @param {string} roleType
 * @returns {string}
 */
function inferArtifactType(roleType) {
  const mapping = {
    planner: "plan",
    research: "research_summary",
    builder: "code_snippet",
    audit: "audit_report",
    automation: "workflow_definition",
  };
  return mapping[roleType] || "plan";
}
