import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Hoist mock fns for supabase realtime (needed by TaskBoard)
const { mockSubscribe, mockOn, mockRemoveChannel, mockChannel } = vi.hoisted(
  () => {
    const mockSubscribe = vi.fn().mockReturnThis();
    const mockOn = vi.fn().mockReturnThis();
    const mockRemoveChannel = vi.fn();
    const mockChannel = vi.fn(() => ({
      on: mockOn,
      subscribe: mockSubscribe,
    }));
    return { mockSubscribe, mockOn, mockRemoveChannel, mockChannel };
  },
);

vi.mock("../lib/supabase", () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

// Mock db.js to prevent top-level env var check from throwing
vi.mock("../../orchestrator/db.js", () => ({
  getTasksByPipeline: vi.fn(),
  getArtifacts: vi.fn(),
  getArtifactById: vi.fn(),
  getPipelineRun: vi.fn(),
  getActiveAgentRoles: vi.fn(),
  getAgentRoleById: vi.fn(),
  createArtifact: vi.fn(),
  createAgentRole: vi.fn(),
  updateAgentRole: vi.fn(),
  createPipelineRun: vi.fn(),
  updatePipelineRun: vi.fn(),
  createTasks: vi.fn(),
  updateTask: vi.fn(),
  supabaseAdmin: {},
}));

// Mock orchestrator modules
vi.mock("../../orchestrator/index.js", () => ({
  classifyIntent: vi.fn(),
  decomposeRequest: vi.fn(),
  synthesizeResults: vi.fn(),
}));

vi.mock("../../orchestrator/pipeline.js", () => ({
  createPipeline: vi.fn(),
  executePipeline: vi.fn(),
}));

vi.mock("../../orchestrator/alignment.js", () => ({
  formatAlignmentCheck: vi.fn(),
  parseAlignmentResponse: vi.fn(),
}));

vi.mock("../../agents/registry.js", () => ({
  getActiveRoles: vi.fn(),
}));

import AgentChatPage from "./AgentChatPage";
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

describe("AgentChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      ...globalThis.crypto,
      randomUUID: vi.fn(
        () => `test-uuid-${Math.random().toString(36).slice(2, 9)}`,
      ),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders ChatInterface with empty state", () => {
    render(<AgentChatPage />);
    expect(
      screen.getByRole("region", { name: /chat interface/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/send a message to start/i)).toBeInTheDocument();
  });

  it("sends a message and shows the alignment card on successful classification", async () => {
    classifyIntent.mockResolvedValue({ data: "audit", error: null });
    decomposeRequest.mockResolvedValue({
      data: [
        {
          name: "Define scope",
          agent_role_id: "role-1",
          depends_on: [],
          input_data: {},
        },
      ],
      error: null,
    });
    getActiveRoles.mockResolvedValue([{ id: "role-1", name: "Planner" }]);
    formatAlignmentCheck.mockReturnValue(
      "Proposed plan: Step 1 - Define scope",
    );

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Run an audit" } });
    fireEvent.submit(input.closest("form"));

    expect(screen.getByText("Run an audit")).toBeInTheDocument();

    await waitFor(() => {
      expect(classifyIntent).toHaveBeenCalledWith("Run an audit");
    });

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /alignment check/i }),
      ).toBeInTheDocument();
    });

    expect(formatAlignmentCheck).toHaveBeenCalled();
  });

  it("shows error message when classifyIntent fails", async () => {
    classifyIntent.mockResolvedValue({
      data: null,
      error: { message: "Classification failed" },
    });

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "something" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(
        screen.getByText(/couldn't understand your request/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error message when decomposeRequest fails", async () => {
    classifyIntent.mockResolvedValue({ data: "plan", error: null });
    decomposeRequest.mockResolvedValue({
      data: null,
      error: { message: "Zero tasks produced" },
    });

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "do something" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/trouble breaking down/i)).toBeInTheDocument();
    });
  });

  it("executes pipeline and shows TaskBoard after approval", async () => {
    classifyIntent.mockResolvedValue({ data: "audit", error: null });
    decomposeRequest.mockResolvedValue({
      data: [
        { name: "Task A", agent_role_id: "r1", depends_on: [], input_data: {} },
      ],
      error: null,
    });
    getActiveRoles.mockResolvedValue([{ id: "r1", name: "Planner" }]);
    formatAlignmentCheck.mockReturnValue("Plan text");

    const pipelineData = {
      id: "pipeline-1",
      status: "pending",
      tasks: [
        {
          id: "t1",
          name: "Task A",
          status: "pending",
          agent_role_id: "r1",
          pipeline_id: "pipeline-1",
        },
      ],
    };
    createPipeline.mockResolvedValue({ data: pipelineData, error: null });
    executePipeline.mockResolvedValue({
      data: { ...pipelineData, status: "completed" },
      error: null,
    });
    synthesizeResults.mockResolvedValue({
      data: {
        pipeline_id: "pipeline-1",
        total_tasks: 1,
        completed_tasks: 1,
        failed_tasks: 0,
        artifacts: [],
        tasks: [
          {
            id: "t1",
            name: "Task A",
            status: "completed",
            agent_role_id: "r1",
          },
        ],
      },
      error: null,
    });

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Run audit" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /alignment check/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Approve plan"));

    await waitFor(() => {
      expect(createPipeline).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/pipeline complete/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("region", { name: /task board/i }),
    ).toBeInTheDocument();
  });

  it("renders ArtifactViewer when artifacts are produced", async () => {
    classifyIntent.mockResolvedValue({ data: "audit", error: null });
    decomposeRequest.mockResolvedValue({
      data: [
        {
          name: "Audit task",
          agent_role_id: "r1",
          depends_on: [],
          input_data: {},
        },
      ],
      error: null,
    });
    getActiveRoles.mockResolvedValue([{ id: "r1", name: "Audit" }]);
    formatAlignmentCheck.mockReturnValue("Plan");

    createPipeline.mockResolvedValue({
      data: {
        id: "p1",
        status: "pending",
        tasks: [
          {
            id: "t1",
            name: "Audit task",
            status: "pending",
            agent_role_id: "r1",
            pipeline_id: "p1",
          },
        ],
      },
      error: null,
    });
    executePipeline.mockResolvedValue({
      data: { id: "p1", status: "completed" },
      error: null,
    });
    synthesizeResults.mockResolvedValue({
      data: {
        pipeline_id: "p1",
        total_tasks: 1,
        completed_tasks: 1,
        failed_tasks: 0,
        artifacts: [
          {
            task_id: "t1",
            task_name: "Audit task",
            agent_role_id: "r1",
            artifact_type: "audit_report",
            content: { executive_summary: "Good results", categories: [] },
          },
        ],
        tasks: [
          {
            id: "t1",
            name: "Audit task",
            status: "completed",
            agent_role_id: "r1",
          },
        ],
      },
      error: null,
    });

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Audit my business" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /alignment check/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Approve plan"));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /artifact viewer/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/1 artifact\(s\) produced/i)).toBeInTheDocument();
  });

  it("handles revision feedback and clears alignment", async () => {
    classifyIntent.mockResolvedValue({ data: "plan", error: null });
    decomposeRequest.mockResolvedValue({
      data: [
        {
          name: "Plan task",
          agent_role_id: "r1",
          depends_on: [],
          input_data: {},
        },
      ],
      error: null,
    });
    getActiveRoles.mockResolvedValue([{ id: "r1", name: "Planner" }]);
    formatAlignmentCheck.mockReturnValue("Plan text");

    render(<AgentChatPage />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Make a plan" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /alignment check/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Revise plan"));
    const feedbackInput = screen.getByLabelText("Revision feedback");
    fireEvent.change(feedbackInput, { target: { value: "Add more detail" } });
    fireEvent.click(screen.getByLabelText("Submit feedback"));

    await waitFor(() => {
      expect(screen.getByText(/revise the plan/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: /alignment check/i }),
    ).not.toBeInTheDocument();
  });
});
