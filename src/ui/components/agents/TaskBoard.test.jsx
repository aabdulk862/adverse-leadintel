import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";

// Hoist mock fns so they're available inside vi.mock factory
const {
  mockSubscribe,
  mockOn,
  mockRemoveChannel,
  mockChannel,
  mockGetTasksByPipeline,
} = vi.hoisted(() => {
  const mockSubscribe = vi.fn().mockReturnThis();
  const mockOn = vi.fn().mockReturnThis();
  const mockRemoveChannel = vi.fn();
  const mockChannel = vi.fn(() => ({
    on: mockOn,
    subscribe: mockSubscribe,
  }));
  const mockGetTasksByPipeline = vi
    .fn()
    .mockResolvedValue({ data: null, error: null });
  return {
    mockSubscribe,
    mockOn,
    mockRemoveChannel,
    mockChannel,
    mockGetTasksByPipeline,
  };
});

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock("../../../orchestrator/db.js", () => ({
  getTasksByPipeline: mockGetTasksByPipeline,
}));

import TaskBoard from "./TaskBoard";

const makeTasks = (overrides = []) => {
  const defaults = [
    {
      id: "t1",
      pipeline_id: "p1",
      name: "Define audit scope",
      agent_role_name: "Planner",
      agent_role_id: "r1",
      status: "completed",
    },
    {
      id: "t2",
      pipeline_id: "p1",
      name: "Gather business data",
      agent_role_name: "Research",
      agent_role_id: "r2",
      status: "in_progress",
    },
    {
      id: "t3",
      pipeline_id: "p1",
      name: "Evaluate operations",
      agent_role_name: "Audit",
      agent_role_id: "r3",
      status: "pending",
    },
    {
      id: "t4",
      pipeline_id: "p1",
      name: "Synthesize report",
      agent_role_name: "Planner",
      agent_role_id: "r1",
      status: "failed",
    },
  ];
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }));
};

describe("TaskBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no tasks provided", () => {
    render(<TaskBoard tasks={[]} pipelineStatus="pending" />);
    expect(screen.getByText(/no tasks in this pipeline/i)).toBeInTheDocument();
  });

  it("renders each task card with name and role", () => {
    const tasks = makeTasks();
    render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

    expect(screen.getByText("Define audit scope")).toBeInTheDocument();
    expect(screen.getByText("Gather business data")).toBeInTheDocument();
    expect(screen.getByText("Evaluate operations")).toBeInTheDocument();
    expect(screen.getByText("Synthesize report")).toBeInTheDocument();

    expect(screen.getAllByText("Planner")).toHaveLength(2);
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
  });

  it("renders status badges for all four statuses", () => {
    const tasks = makeTasks();
    render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows correct progress count", () => {
    const tasks = makeTasks();
    render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);
    expect(screen.getByText("1 / 4 completed")).toBeInTheDocument();
  });

  it("renders progress bar with correct aria attributes", () => {
    const tasks = makeTasks();
    render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "4");
  });

  it("shows 0 / 0 progress when tasks array is empty and renders empty state", () => {
    render(<TaskBoard tasks={[]} pipelineStatus="pending" />);
    // Empty state is shown instead of progress
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("falls back to agent_role_id when agent_role_name is missing", () => {
    const tasks = [
      {
        id: "t1",
        pipeline_id: "p1",
        name: "Some task",
        agent_role_id: "role-uuid-123",
        status: "pending",
      },
    ];
    render(<TaskBoard tasks={tasks} pipelineStatus="pending" />);
    expect(screen.getByText("role-uuid-123")).toBeInTheDocument();
  });

  it("subscribes to supabase realtime on mount when tasks have a pipeline_id", () => {
    const tasks = makeTasks();
    render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

    expect(mockChannel).toHaveBeenCalledWith("tasks-p1");
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        schema: "public",
        table: "tasks",
        filter: "pipeline_id=eq.p1",
      }),
      expect.any(Function),
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("cleans up realtime subscription on unmount", () => {
    const tasks = makeTasks();
    const { unmount } = render(
      <TaskBoard tasks={tasks} pipelineStatus="in_progress" />,
    );
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it("does not subscribe when there are no tasks", () => {
    render(<TaskBoard tasks={[]} pipelineStatus="pending" />);
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("has proper ARIA region label", () => {
    render(<TaskBoard tasks={[]} pipelineStatus="pending" />);
    expect(
      screen.getByRole("region", { name: /task board/i }),
    ).toBeInTheDocument();
  });

  it("shows all tasks completed in progress when all are completed", () => {
    const tasks = [
      {
        id: "t1",
        pipeline_id: "p1",
        name: "Task A",
        agent_role_name: "Planner",
        agent_role_id: "r1",
        status: "completed",
      },
      {
        id: "t2",
        pipeline_id: "p1",
        name: "Task B",
        agent_role_name: "Research",
        agent_role_id: "r2",
        status: "completed",
      },
    ];
    render(<TaskBoard tasks={tasks} pipelineStatus="completed" />);
    expect(screen.getByText("2 / 2 completed")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "2");
    expect(progressbar).toHaveAttribute("aria-valuemax", "2");
  });

  describe("polling fallback", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts polling when channel reports CHANNEL_ERROR", () => {
      // Make subscribe invoke the callback with the status
      mockSubscribe.mockImplementation(function (cb) {
        if (cb) cb("CHANNEL_ERROR");
        return this;
      });

      const tasks = makeTasks();
      render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

      // Advance timers by 5 seconds to trigger one poll
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockGetTasksByPipeline).toHaveBeenCalledWith("p1");
    });

    it("starts polling when channel reports TIMED_OUT", () => {
      mockSubscribe.mockImplementation(function (cb) {
        if (cb) cb("TIMED_OUT");
        return this;
      });

      const tasks = makeTasks();
      render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockGetTasksByPipeline).toHaveBeenCalledWith("p1");
    });

    it("starts polling when channel reports CLOSED", () => {
      mockSubscribe.mockImplementation(function (cb) {
        if (cb) cb("CLOSED");
        return this;
      });

      const tasks = makeTasks();
      render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockGetTasksByPipeline).toHaveBeenCalledWith("p1");
    });

    it("does not poll when channel is SUBSCRIBED", () => {
      mockSubscribe.mockImplementation(function (cb) {
        if (cb) cb("SUBSCRIBED");
        return this;
      });

      const tasks = makeTasks();
      render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockGetTasksByPipeline).not.toHaveBeenCalled();
    });

    it("stops polling when channel reconnects with SUBSCRIBED", () => {
      let statusCallback;
      mockSubscribe.mockImplementation(function (cb) {
        statusCallback = cb;
        return this;
      });

      const tasks = makeTasks();
      render(<TaskBoard tasks={tasks} pipelineStatus="in_progress" />);

      // Simulate disconnect
      act(() => {
        statusCallback("CHANNEL_ERROR");
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockGetTasksByPipeline).toHaveBeenCalledTimes(1);

      // Simulate reconnect
      act(() => {
        statusCallback("SUBSCRIBED");
      });
      mockGetTasksByPipeline.mockClear();

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(mockGetTasksByPipeline).not.toHaveBeenCalled();
    });

    it("cleans up polling interval on unmount", () => {
      mockSubscribe.mockImplementation(function (cb) {
        if (cb) cb("CHANNEL_ERROR");
        return this;
      });

      const tasks = makeTasks();
      const { unmount } = render(
        <TaskBoard tasks={tasks} pipelineStatus="in_progress" />,
      );

      // Verify polling started
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockGetTasksByPipeline).toHaveBeenCalledTimes(1);

      unmount();
      mockGetTasksByPipeline.mockClear();

      // After unmount, no more polling should happen
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(mockGetTasksByPipeline).not.toHaveBeenCalled();
    });
  });
});
