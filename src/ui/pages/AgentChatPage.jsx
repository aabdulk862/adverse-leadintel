import { useState, useCallback } from "react";
import ChatInterface from "../components/agents/ChatInterface";
import AlignmentCard from "../components/agents/AlignmentCard";
import TaskBoard from "../components/agents/TaskBoard";
import ArtifactViewer from "../components/agents/ArtifactViewer";
import {
  classifyIntent,
  decomposeRequest,
  synthesizeResults,
} from "../../orchestrator/index.js";
import {
  createPipeline,
  executePipeline,
} from "../../orchestrator/pipeline.js";
import {
  formatAlignmentCheck,
  parseAlignmentResponse,
} from "../../orchestrator/alignment.js";
import { getActiveRoles } from "../../agents/registry.js";

function createMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export default function AgentChatPage() {
  const [messages, setMessages] = useState([]);
  const [currentPipeline, setCurrentPipeline] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pending alignment state — holds data needed to proceed after approval
  const [pendingAlignment, setPendingAlignment] = useState(null);

  const addMessage = useCallback((role, content) => {
    setMessages((prev) => [...prev, createMessage(role, content)]);
  }, []);

  // ── Handle user sending a message ──
  const handleSendMessage = useCallback(
    async (text) => {
      addMessage("user", text);

      // If there's a pending alignment, treat the message as an alignment response
      if (pendingAlignment) {
        const { approved, feedback } = parseAlignmentResponse(text);
        if (approved) {
          await handleApprove();
        } else {
          handleRevise(feedback || text);
        }
        return;
      }

      setIsLoading(true);
      try {
        // 1. Classify intent
        const { data: intent, error: intentError } = await classifyIntent(text);
        if (intentError) {
          addMessage(
            "assistant",
            `Sorry, I couldn't understand your request: ${intentError.message}`,
          );
          return;
        }

        // 2. Decompose request into tasks
        const { data: decomposedTasks, error: decomposeError } =
          await decomposeRequest(text, intent);
        if (decomposeError) {
          addMessage(
            "assistant",
            `I had trouble breaking down your request: ${decomposeError.message}`,
          );
          return;
        }

        // 3. Get active roles for alignment check formatting
        const activeRoles = await getActiveRoles();

        // 4. Format alignment check
        const alignmentText = formatAlignmentCheck(
          decomposedTasks,
          activeRoles,
        );

        // Store pending alignment data so we can proceed on approval
        setPendingAlignment({
          tasks: decomposedTasks,
          requestSummary: text,
          alignmentText,
        });

        addMessage(
          "assistant",
          "Here is the proposed execution plan. Please review and approve or revise.",
        );
      } catch (err) {
        addMessage("assistant", `An error occurred: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [addMessage, pendingAlignment],
  );

  // ── Handle alignment approval ──
  const handleApprove = useCallback(async () => {
    if (!pendingAlignment) return;

    const { tasks: pendingTasks, requestSummary } = pendingAlignment;
    setPendingAlignment(null);
    addMessage(
      "assistant",
      "Plan approved. Creating pipeline and starting execution…",
    );
    setIsLoading(true);

    try {
      // 1. Create pipeline
      const { data: pipeline, error: pipelineError } = await createPipeline(
        pendingTasks,
        requestSummary,
      );
      if (pipelineError) {
        addMessage(
          "assistant",
          `Failed to create pipeline: ${pipelineError.message}`,
        );
        return;
      }

      setCurrentPipeline(pipeline);
      setTasks(pipeline.tasks || []);

      // 2. Execute pipeline
      const { data: completedPipeline, error: execError } =
        await executePipeline(pipeline.id);
      if (execError) {
        addMessage(
          "assistant",
          `Pipeline execution failed: ${execError.message}`,
        );
        return;
      }

      setCurrentPipeline(completedPipeline);

      // 3. Synthesize results
      const { data: results, error: synthesisError } = await synthesizeResults(
        pipeline.id,
      );
      if (synthesisError) {
        addMessage(
          "assistant",
          `Result synthesis failed: ${synthesisError.message}`,
        );
        return;
      }

      // Update tasks from synthesis data
      if (results.tasks) {
        setTasks(results.tasks);
      }

      // Collect artifacts
      if (results.artifacts && results.artifacts.length > 0) {
        setArtifacts(results.artifacts);
        addMessage(
          "assistant",
          `Pipeline complete. ${results.completed_tasks} of ${results.total_tasks} tasks finished. ${results.artifacts.length} artifact(s) produced.`,
        );
      } else {
        addMessage(
          "assistant",
          `Pipeline complete. ${results.completed_tasks} of ${results.total_tasks} tasks finished.`,
        );
      }
    } catch (err) {
      addMessage("assistant", `An unexpected error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [pendingAlignment, addMessage]);

  // ── Handle alignment revision ──
  const handleRevise = useCallback(
    (feedback) => {
      setPendingAlignment(null);
      addMessage(
        "assistant",
        `Got it — I'll revise the plan based on your feedback: "${feedback}". Please send your updated request.`,
      );
    },
    [addMessage],
  );

  return (
    <div>
      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      {pendingAlignment && (
        <AlignmentCard
          alignmentText={pendingAlignment.alignmentText}
          onApprove={handleApprove}
          onRevise={handleRevise}
        />
      )}

      {tasks.length > 0 && (
        <TaskBoard tasks={tasks} pipelineStatus={currentPipeline?.status} />
      )}

      {artifacts.map((artifact) => (
        <ArtifactViewer key={artifact.task_id} artifact={artifact} />
      ))}
    </div>
  );
}
