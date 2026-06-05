import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../orchestrator/db.js", () => ({
  getActiveAgentRoles: vi.fn(),
}));

import AgentRegistryPage from "./AgentRegistryPage";
import { getActiveAgentRoles } from "../../orchestrator/db.js";

const makeRole = (overrides = {}) => ({
  id: "role-1",
  name: "Planner",
  description: "Decomposes goals into structured plans",
  role_type: "planner",
  system_prompt: "You are a planner agent.",
  input_schema: { type: "object", properties: { goal: { type: "string" } } },
  output_schema: { type: "object", properties: { plan: { type: "string" } } },
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("AgentRegistryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    getActiveAgentRoles.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AgentRegistryPage />);
    expect(
      screen.getByRole("status", { name: /loading/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/loading agent roles/i)).toBeInTheDocument();
  });

  it("renders a grid of AgentCards when roles are fetched", async () => {
    const roles = [
      makeRole({ id: "r1", name: "Planner", role_type: "planner" }),
      makeRole({
        id: "r2",
        name: "Research",
        role_type: "research",
        description: "Gathers information",
      }),
    ];
    getActiveAgentRoles.mockResolvedValue({ data: roles, error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText("Planner")).toBeInTheDocument();
    });

    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /agent roles/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no active roles exist", async () => {
    getActiveAgentRoles.mockResolvedValue({ data: [], error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no active agent roles/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", { name: /empty agent registry/i }),
    ).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    getActiveAgentRoles.mockResolvedValue({
      data: null,
      error: { message: "Connection refused" },
    });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
  });

  it("shows detail panel with full config when a card is clicked", async () => {
    const role = makeRole({
      id: "r1",
      name: "Audit",
      system_prompt: "You are an audit agent.",
      input_schema: {
        type: "object",
        properties: { target: { type: "string" } },
      },
      output_schema: {
        type: "object",
        properties: { report: { type: "string" } },
      },
    });
    getActiveAgentRoles.mockResolvedValue({ data: [role], error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText("Audit")).toBeInTheDocument();
    });

    // Click the agent card
    fireEvent.click(screen.getByRole("button", { name: /audit agent card/i }));

    // Detail panel should appear
    const detail = screen.getByRole("region", { name: /agent role detail/i });
    expect(detail).toBeInTheDocument();

    // System prompt displayed
    expect(screen.getByText("You are an audit agent.")).toBeInTheDocument();

    // Schemas displayed as formatted JSON
    expect(screen.getByText(/"target"/)).toBeInTheDocument();
    expect(screen.getByText(/"report"/)).toBeInTheDocument();
  });

  it("closes detail panel when close button is clicked", async () => {
    const role = makeRole({ id: "r1", name: "Builder" });
    getActiveAgentRoles.mockResolvedValue({ data: [role], error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText("Builder")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /builder agent card/i }),
    );
    expect(
      screen.getByRole("region", { name: /agent role detail/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close detail panel"));
    expect(
      screen.queryByRole("region", { name: /agent role detail/i }),
    ).not.toBeInTheDocument();
  });

  it("toggles detail panel when clicking the same card again", async () => {
    const role = makeRole({ id: "r1", name: "Planner" });
    getActiveAgentRoles.mockResolvedValue({ data: [role], error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText("Planner")).toBeInTheDocument();
    });

    const card = screen.getByRole("button", { name: /planner agent card/i });

    // Open
    fireEvent.click(card);
    expect(
      screen.getByRole("region", { name: /agent role detail/i }),
    ).toBeInTheDocument();

    // Close by clicking same card
    fireEvent.click(card);
    expect(
      screen.queryByRole("region", { name: /agent role detail/i }),
    ).not.toBeInTheDocument();
  });

  it("switches detail panel when clicking a different card", async () => {
    const roles = [
      makeRole({ id: "r1", name: "Planner", system_prompt: "Planner prompt" }),
      makeRole({
        id: "r2",
        name: "Research",
        system_prompt: "Research prompt",
      }),
    ];
    getActiveAgentRoles.mockResolvedValue({ data: roles, error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText("Planner")).toBeInTheDocument();
    });

    // Click first card
    fireEvent.click(
      screen.getByRole("button", { name: /planner agent card/i }),
    );
    expect(screen.getByText("Planner prompt")).toBeInTheDocument();

    // Click second card
    fireEvent.click(
      screen.getByRole("button", { name: /research agent card/i }),
    );
    expect(screen.getByText("Research prompt")).toBeInTheDocument();
    expect(screen.queryByText("Planner prompt")).not.toBeInTheDocument();
  });

  it("handles null data gracefully", async () => {
    getActiveAgentRoles.mockResolvedValue({ data: null, error: null });

    render(<AgentRegistryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no active agent roles/i)).toBeInTheDocument();
    });
  });
});
