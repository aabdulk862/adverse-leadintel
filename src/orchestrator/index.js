import { getRoleByType, getActiveRoles } from "../agents/registry.js";
import { getTasksByPipeline, getArtifacts, getPipelineRun } from "./db.js";
import {
  validateAgainstSchema,
  validateTransfer,
  transformData,
  logTransfer,
} from "../agents/contracts.js";
import { createPipeline, executePipeline } from "./pipeline.js";
import { formatAlignmentCheck } from "./alignment.js";
import { createWorkflow, activateWorkflow } from "./n8n.js";

// ---------------------------------------------------------------------------
// Intent classification keywords
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS = {
  build: [
    "build",
    "create",
    "generate",
    "code",
    "develop",
    "implement",
    "construct",
    "make",
    "write",
    "design",
    "scaffold",
    "prototype",
    "configure",
    "setup",
    "deploy",
  ],
  research: [
    "research",
    "find",
    "search",
    "look up",
    "investigate",
    "gather",
    "analyze",
    "explore",
    "discover",
    "learn",
    "study",
    "compare",
    "review",
    "examine",
    "survey",
  ],
  audit: [
    "audit",
    "evaluate",
    "assess",
    "inspect",
    "check",
    "score",
    "grade",
    "rate",
    "benchmark",
    "diagnose",
    "quality",
    "compliance",
    "review operations",
    "business audit",
  ],
  automate: [
    "automate",
    "workflow",
    "schedule",
    "trigger",
    "n8n",
    "pipeline",
    "integration",
    "connect",
    "hook",
    "cron",
    "recurring",
    "bot",
    "notification",
    "alert",
  ],
  plan: [
    "plan",
    "strategy",
    "roadmap",
    "outline",
    "organize",
    "prioritize",
    "decompose",
    "break down",
    "structure",
    "coordinate",
    "propose",
    "recommend",
    "advise",
    "suggest",
  ],
  outreach: [
    "outreach",
    "prospect",
    "email",
    "linkedin",
    "cold email",
    "lead generation",
    "business development",
    "sales",
  ],
};

// ---------------------------------------------------------------------------
// Intent → role_type mapping
// ---------------------------------------------------------------------------

const INTENT_TO_ROLE_TYPE = {
  build: "builder",
  research: "research",
  audit: "audit",
  automate: "automation",
  plan: "planner",
  outreach: "builder",
};

const VALID_INTENTS = [
  "build",
  "research",
  "audit",
  "automate",
  "plan",
  "outreach",
];

// ---------------------------------------------------------------------------
// classifyIntent
// ---------------------------------------------------------------------------

/**
 * Classifies a request string into one of five intent types using keyword
 * matching. Returns a structured error when classification fails.
 *
 * @param {string} requestText - The user's request text
 * @returns {Promise<{ data: string|null, error: object|null }>}
 */
export async function classifyIntent(requestText) {
  if (
    !requestText ||
    typeof requestText !== "string" ||
    requestText.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message:
          "Classification failed: request text must be a non-empty string",
        code: "INVALID_INPUT",
        requestText: requestText ?? null,
      },
    };
  }

  const normalised = requestText.toLowerCase();

  // Score each intent by counting keyword matches
  const scores = {};
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    scores[intent] = 0;
    for (const keyword of keywords) {
      if (normalised.includes(keyword)) {
        scores[intent] += 1;
      }
    }
  }

  // Find the intent with the highest score
  let bestIntent = null;
  let bestScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // If no keywords matched, default to 'plan' as the most general intent
  if (bestScore === 0) {
    return { data: "plan", error: null };
  }

  return { data: bestIntent, error: null };
}

// ---------------------------------------------------------------------------
// decomposeRequest
// ---------------------------------------------------------------------------

/**
 * Decomposes a request into ordered tasks with agent role assignments.
 * Every task references an active agent_role_id. Returns a structured error
 * when decomposition produces zero tasks.
 *
 * @param {string} requestText - The user's request text
 * @param {string} intent - One of the five valid intent types
 * @returns {Promise<{ data: object[]|null, error: object|null }>}
 */
export async function decomposeRequest(requestText, intent) {
  if (
    !requestText ||
    typeof requestText !== "string" ||
    requestText.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message:
          "Decomposition failed: request text must be a non-empty string",
        code: "INVALID_INPUT",
      },
    };
  }

  if (!VALID_INTENTS.includes(intent)) {
    return {
      data: null,
      error: {
        message: `Decomposition failed: invalid intent "${intent}". Must be one of: ${VALID_INTENTS.join(", ")}`,
        code: "INVALID_INTENT",
      },
    };
  }

  try {
    // Build the task list based on the intent
    const tasks = await buildTasksForIntent(requestText, intent);

    if (!tasks || tasks.length === 0) {
      return {
        data: null,
        error: {
          message:
            "Decomposition failed: produced zero tasks for the given request",
          code: "ZERO_TASKS",
          requestText,
          intent,
        },
      };
    }

    return { data: tasks, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Decomposition failed: ${err.message}`,
        code: "DECOMPOSITION_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// synthesizeResults
// ---------------------------------------------------------------------------

/**
 * Collects all artifacts from a completed pipeline and produces a final
 * structured output.
 *
 * @param {string} pipelineId - The pipeline run UUID
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function synthesizeResults(pipelineId) {
  if (!pipelineId || typeof pipelineId !== "string") {
    return {
      data: null,
      error: {
        message: "Synthesis failed: pipelineId must be a non-empty string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // Fetch the pipeline run
    const { data: pipeline, error: pipelineError } =
      await getPipelineRun(pipelineId);
    if (pipelineError) {
      return {
        data: null,
        error: {
          message: `Synthesis failed: could not fetch pipeline - ${pipelineError.message}`,
          code: "PIPELINE_FETCH_ERROR",
        },
      };
    }

    // Fetch all tasks for this pipeline
    const { data: tasks, error: tasksError } =
      await getTasksByPipeline(pipelineId);
    if (tasksError) {
      return {
        data: null,
        error: {
          message: `Synthesis failed: could not fetch tasks - ${tasksError.message}`,
          code: "TASKS_FETCH_ERROR",
        },
      };
    }

    // Collect artifacts from each task's output_data
    const artifacts = [];
    for (const task of tasks) {
      if (task.output_data) {
        artifacts.push({
          task_id: task.id,
          task_name: task.name,
          agent_role_id: task.agent_role_id,
          content: task.output_data,
        });
      }
    }

    // Build the synthesized result
    const synthesized = {
      pipeline_id: pipelineId,
      request_summary: pipeline.request_summary,
      status: pipeline.status,
      total_tasks: tasks.length,
      completed_tasks: tasks.filter((t) => t.status === "completed").length,
      failed_tasks: tasks.filter((t) => t.status === "failed").length,
      artifacts,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        agent_role_id: t.agent_role_id,
      })),
      created_at: pipeline.created_at,
      completed_at: pipeline.completed_at || null,
    };

    return { data: synthesized, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Synthesis failed: ${err.message}`,
        code: "SYNTHESIS_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds an array of task objects for a given intent. Each task has:
 *   - name: descriptive task name
 *   - agent_role_id: UUID of the assigned active agent role
 *   - depends_on: array of task IDs (indices used as temp IDs, resolved later)
 *   - input_data: task-specific input
 *
 * @param {string} requestText - The user's request text
 * @param {string} intent - The classified intent
 * @returns {Promise<object[]>}
 */
async function buildTasksForIntent(requestText, intent) {
  // Map intent to a task template
  const templates = getTaskTemplates(requestText, intent);

  // Resolve agent role IDs for each task
  const tasks = [];
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const role = await getRoleByType(template.role_type);

    tasks.push({
      name: template.name,
      agent_role_id: role.id,
      depends_on: template.depends_on_indices.map((idx) => `__temp_${idx}`),
      input_data: template.input_data,
    });
  }

  // Replace temp dependency references with actual task indices
  // (These will be replaced with real UUIDs when persisted via createPipeline)
  for (let i = 0; i < tasks.length; i++) {
    tasks[i].depends_on = tasks[i].depends_on.map((dep) => {
      const idx = parseInt(dep.replace("__temp_", ""), 10);
      return `__task_${idx}`;
    });
  }

  // Assign temporary IDs so dependencies can reference each other
  for (let i = 0; i < tasks.length; i++) {
    tasks[i]._temp_id = `__task_${i}`;
  }

  return tasks;
}

/**
 * Returns task templates for a given intent. Each template defines the task
 * name, required role_type, dependency indices, and input data.
 *
 * @param {string} requestText - The user's request text
 * @param {string} intent - The classified intent
 * @returns {object[]}
 */
function getTaskTemplates(requestText, intent) {
  switch (intent) {
    case "build":
      return [
        {
          name: "Plan implementation",
          role_type: "planner",
          depends_on_indices: [],
          input_data: { goal: requestText },
        },
        {
          name: "Build deliverable",
          role_type: "builder",
          depends_on_indices: [0],
          input_data: { specification: requestText },
        },
      ];

    case "research":
      return [
        {
          name: "Research topic",
          role_type: "research",
          depends_on_indices: [],
          input_data: { query: requestText },
        },
        {
          name: "Synthesize findings",
          role_type: "planner",
          depends_on_indices: [0],
          input_data: {
            goal: `Synthesize research findings for: ${requestText}`,
          },
        },
      ];

    case "audit": {
      // Detect a URL in the request text so the Research task can extract data from it
      const urlMatch = requestText.match(/https?:\/\/[^\s]+/);
      const researchInputData = { query: requestText };
      if (urlMatch) {
        researchInputData.url = urlMatch[0];
      }

      return [
        {
          name: "Define audit scope",
          role_type: "planner",
          depends_on_indices: [],
          input_data: { goal: `Define audit scope for: ${requestText}` },
        },
        {
          name: "Gather business data",
          role_type: "research",
          depends_on_indices: [0],
          input_data: researchInputData,
        },
        {
          name: "Evaluate operations",
          role_type: "audit",
          depends_on_indices: [1],
          input_data: { target: requestText },
        },
        {
          name: "Synthesize audit report",
          role_type: "planner",
          depends_on_indices: [2],
          input_data: { goal: `Synthesize audit findings for: ${requestText}` },
        },
      ];
    }

    case "automate":
      return [
        {
          name: "Plan automation workflow",
          role_type: "planner",
          depends_on_indices: [],
          input_data: { goal: `Plan automation for: ${requestText}` },
        },
        {
          name: "Define workflow",
          role_type: "automation",
          depends_on_indices: [0],
          input_data: { workflow_description: requestText },
        },
      ];

    case "plan":
      return [
        {
          name: "Create strategic plan",
          role_type: "planner",
          depends_on_indices: [],
          input_data: { goal: requestText },
        },
      ];

    case "outreach":
      return [
        {
          name: "Gather prospect information",
          role_type: "research",
          depends_on_indices: [],
          input_data: { query: requestText },
        },
        {
          name: "Define outreach strategy",
          role_type: "planner",
          depends_on_indices: [0],
          input_data: { goal: `Define outreach strategy for: ${requestText}` },
        },
        {
          name: "Generate outreach content",
          role_type: "builder",
          depends_on_indices: [1],
          input_data: {
            specification: `Generate outreach content for: ${requestText}`,
            format: "outreach",
          },
        },
      ];

    default:
      return [
        {
          name: "Create strategic plan",
          role_type: "planner",
          depends_on_indices: [],
          input_data: { goal: requestText },
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// Outreach output schema (Task 13.2)
// ---------------------------------------------------------------------------

/**
 * JSON Schema that the Builder agent's output must conform to when generating
 * outreach content. Enforces email_draft, linkedin_message, proposal_outline
 * as non-empty strings and placeholders as an array of bracket-notation strings.
 */
const OUTREACH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    email_draft: { type: "string", minLength: 1 },
    linkedin_message: { type: "string", minLength: 1 },
    proposal_outline: { type: "string", minLength: 1 },
    placeholders: {
      type: "array",
      items: {
        type: "string",
        pattern: "^\\[\\w+\\]$",
      },
    },
  },
  required: [
    "email_draft",
    "linkedin_message",
    "proposal_outline",
    "placeholders",
  ],
};

// ---------------------------------------------------------------------------
// Outreach approval → Automation task creation (Task 13.2)
// ---------------------------------------------------------------------------

/**
 * When the user approves outreach content, creates an Automation task to
 * generate an n8n workflow definition for scheduling and sending the outreach
 * sequence.
 *
 * @param {object} outreachArtifact - The approved outreach artifact content
 * @param {string} pipelineId - The pipeline run UUID (for context)
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createOutreachAutomationTask(
  outreachArtifact,
  pipelineId,
) {
  if (!outreachArtifact || typeof outreachArtifact !== "object") {
    return {
      data: null,
      error: {
        message:
          "createOutreachAutomationTask requires a valid outreach artifact object",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    const automationRole = await getRoleByType("automation");

    const task = {
      name: "Generate outreach automation workflow",
      agent_role_id: automationRole.id,
      depends_on: [],
      input_data: {
        workflow_description:
          "Create an n8n workflow definition for scheduling and sending the approved outreach sequence",
        outreach_content: outreachArtifact,
        pipeline_id: pipelineId,
      },
    };

    return { data: task, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Failed to create outreach automation task: ${err.message}`,
        code: "AUTOMATION_TASK_ERROR",
      },
    };
  }
}

/**
 * Validates outreach content against the OUTREACH_OUTPUT_SCHEMA.
 *
 * @param {object} content - The outreach content to validate
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateOutreachContent(content) {
  return validateAgainstSchema(content, OUTREACH_OUTPUT_SCHEMA);
}

// ---------------------------------------------------------------------------
// Top-level orchestration flow (Task 19.1)
// ---------------------------------------------------------------------------

/**
 * Full request lifecycle entry point. Classifies intent, decomposes the
 * request into tasks, fetches active roles, and returns an alignment check
 * for user approval.
 *
 * The caller is responsible for presenting the alignment check and collecting
 * the user's approval/rejection. After approval, call `executeApprovedPipeline`.
 * After rejection, call `handleAlignmentRejection`.
 *
 * @param {string} requestText - The user's request text
 * @returns {Promise<{ data: object|null, error: object|null }>}
 *   On success, data contains: { intent, tasks, roles, alignmentCheck, requestText }
 */
export async function orchestrate(requestText) {
  if (
    !requestText ||
    typeof requestText !== "string" ||
    requestText.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message:
          "Orchestration failed: request text must be a non-empty string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // 1. Classify intent
    const { data: intent, error: intentError } =
      await classifyIntent(requestText);
    if (intentError) {
      return { data: null, error: intentError };
    }

    // 2. Decompose request into tasks
    const { data: tasks, error: decomposeError } = await decomposeRequest(
      requestText,
      intent,
    );
    if (decomposeError) {
      return { data: null, error: decomposeError };
    }

    // 3. Fetch active roles for alignment check
    const roles = await getActiveRoles();

    // 4. Format alignment check
    const alignmentCheck = formatAlignmentCheck(tasks, roles);

    return {
      data: {
        intent,
        tasks,
        roles,
        alignmentCheck,
        requestText,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Orchestration failed: ${err.message}`,
        code: "ORCHESTRATION_ERROR",
      },
    };
  }
}

/**
 * Executes an approved pipeline: creates the pipeline in Supabase, executes
 * all tasks in dependency order, and synthesizes the results.
 *
 * For automation intents, also creates and activates an n8n workflow from
 * the automation agent's output.
 *
 * @param {object[]} tasks - The decomposed tasks (from orchestrate result)
 * @param {string} requestSummary - Human-readable summary of the request
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function executeApprovedPipeline(tasks, requestSummary) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      data: null,
      error: {
        message: "executeApprovedPipeline requires a non-empty array of tasks",
        code: "INVALID_INPUT",
      },
    };
  }

  if (
    !requestSummary ||
    typeof requestSummary !== "string" ||
    requestSummary.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message:
          "executeApprovedPipeline requires a non-empty requestSummary string",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // 1. Create pipeline in Supabase
    const { data: pipeline, error: pipelineError } = await createPipeline(
      tasks,
      requestSummary,
    );
    if (pipelineError) {
      return { data: null, error: pipelineError };
    }

    // 2. Execute the pipeline
    const { data: executionResult, error: execError } = await executePipeline(
      pipeline.id,
    );
    if (execError) {
      return { data: null, error: execError };
    }

    // 3. Synthesize results
    const { data: synthesized, error: synthError } = await synthesizeResults(
      pipeline.id,
    );
    if (synthError) {
      return { data: null, error: synthError };
    }

    // 4. For automation workflows, attempt to create and activate n8n workflow
    const n8nResult = await maybeCreateN8nWorkflow(pipeline.id);

    return {
      data: {
        ...synthesized,
        n8n_workflow: n8nResult,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Pipeline execution failed: ${err.message}`,
        code: "PIPELINE_EXECUTION_ERROR",
      },
    };
  }
}

/**
 * Handles alignment rejection by re-decomposing the request with user
 * feedback incorporated, then returning a new alignment check.
 *
 * @param {object[]} tasks - The original decomposed tasks
 * @param {string} feedback - The user's feedback/revision instructions
 * @param {string} requestText - The original request text
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function handleAlignmentRejection(tasks, feedback, requestText) {
  if (!feedback || typeof feedback !== "string" || feedback.trim() === "") {
    return {
      data: null,
      error: {
        message: "handleAlignmentRejection requires non-empty feedback",
        code: "INVALID_INPUT",
      },
    };
  }

  if (
    !requestText ||
    typeof requestText !== "string" ||
    requestText.trim() === ""
  ) {
    return {
      data: null,
      error: {
        message: "handleAlignmentRejection requires non-empty requestText",
        code: "INVALID_INPUT",
      },
    };
  }

  try {
    // Re-classify with the combined request + feedback for better intent matching
    const revisedRequest = `${requestText} [User feedback: ${feedback}]`;

    const { data: intent, error: intentError } =
      await classifyIntent(requestText);
    if (intentError) {
      return { data: null, error: intentError };
    }

    // Re-decompose with the revised request
    const { data: revisedTasks, error: decomposeError } =
      await decomposeRequest(revisedRequest, intent);
    if (decomposeError) {
      return { data: null, error: decomposeError };
    }

    // Fetch active roles and format new alignment check
    const roles = await getActiveRoles();
    const alignmentCheck = formatAlignmentCheck(revisedTasks, roles);

    return {
      data: {
        intent,
        tasks: revisedTasks,
        roles,
        alignmentCheck,
        requestText,
        feedback,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: `Alignment rejection handling failed: ${err.message}`,
        code: "ALIGNMENT_REJECTION_ERROR",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: n8n workflow creation for automation pipelines
// ---------------------------------------------------------------------------

/**
 * Checks if a completed pipeline produced an automation workflow definition
 * artifact, and if so, creates and activates it in n8n.
 *
 * @param {string} pipelineId - The pipeline run UUID
 * @returns {Promise<object|null>} The n8n workflow result, or null if not applicable
 */
async function maybeCreateN8nWorkflow(pipelineId) {
  try {
    const { data: tasks } = await getTasksByPipeline(pipelineId);
    if (!tasks) return null;

    // Look for a completed automation task with a workflow_definition in its output
    const automationTask = tasks.find(
      (t) => t.status === "completed" && t.output_data?.workflow_definition,
    );

    if (!automationTask) return null;

    const workflowDef = automationTask.output_data.workflow_definition;

    // Create the workflow in n8n
    const { data: created, error: createError } =
      await createWorkflow(workflowDef);
    if (createError) {
      return { created: null, activated: null, error: createError };
    }

    // Activate the workflow
    const workflowId = created.id || created.workflow?.id;
    if (workflowId) {
      const { data: activated, error: activateError } = await activateWorkflow(
        String(workflowId),
      );
      if (activateError) {
        return { created, activated: null, error: activateError };
      }
      return { created, activated, error: null };
    }

    return { created, activated: null, error: null };
  } catch {
    // n8n integration is best-effort; don't fail the pipeline
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export {
  INTENT_KEYWORDS,
  INTENT_TO_ROLE_TYPE,
  VALID_INTENTS,
  OUTREACH_OUTPUT_SCHEMA,
};
