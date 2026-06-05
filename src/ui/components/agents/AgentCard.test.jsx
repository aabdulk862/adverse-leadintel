import { render, screen, fireEvent } from "@testing-library/react";
import AgentCard from "./AgentCard";

const makeRole = (overrides = {}) => ({
  id: "role-1",
  name: "Planner",
  description:
    "Decomposes goals into structured plans and synthesizes findings into reports",
  role_type: "planner",
  system_prompt: "You are a planner agent.",
  input_schema: {},
  output_schema: {},
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("AgentCard", () => {
  it("renders the role name", () => {
    render(<AgentCard role={makeRole()} onClick={() => {}} />);
    expect(screen.getByText("Planner")).toBeInTheDocument();
  });

  it("renders the role description", () => {
    render(<AgentCard role={makeRole()} onClick={() => {}} />);
    expect(
      screen.getByText(/Decomposes goals into structured plans/),
    ).toBeInTheDocument();
  });

  it("renders the role_type badge", () => {
    render(
      <AgentCard
        role={makeRole({ role_type: "research" })}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("research")).toBeInTheDocument();
  });

  it("renders a status indicator for active roles", () => {
    render(
      <AgentCard role={makeRole({ status: "active" })} onClick={() => {}} />,
    );
    expect(
      screen.getByRole("img", { name: /status: active/i }),
    ).toBeInTheDocument();
  });

  it("renders a status indicator for inactive roles", () => {
    render(
      <AgentCard role={makeRole({ status: "inactive" })} onClick={() => {}} />,
    );
    expect(
      screen.getByRole("img", { name: /status: inactive/i }),
    ).toBeInTheDocument();
  });

  it("renders a status indicator for draft roles", () => {
    render(
      <AgentCard role={makeRole({ status: "draft" })} onClick={() => {}} />,
    );
    expect(
      screen.getByRole("img", { name: /status: draft/i }),
    ).toBeInTheDocument();
  });

  it("calls onClick with the role when clicked", () => {
    const role = makeRole();
    const onClick = vi.fn();
    render(<AgentCard role={role} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(role);
  });

  it("calls onClick when Enter key is pressed", () => {
    const role = makeRole();
    const onClick = vi.fn();
    render(<AgentCard role={role} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(role);
  });

  it("calls onClick when Space key is pressed", () => {
    const role = makeRole();
    const onClick = vi.fn();
    render(<AgentCard role={role} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(role);
  });

  it("does not crash when onClick is not provided", () => {
    render(<AgentCard role={makeRole()} />);
    expect(() => {
      fireEvent.click(screen.getByRole("button"));
    }).not.toThrow();
  });

  it("renders nothing when role is null", () => {
    const { container } = render(<AgentCard role={null} onClick={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when role is undefined", () => {
    const { container } = render(<AgentCard onClick={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("has button role for accessibility", () => {
    render(<AgentCard role={makeRole()} onClick={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has an accessible label including the role name", () => {
    render(<AgentCard role={makeRole({ name: "Audit" })} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /audit agent card/i }),
    ).toBeInTheDocument();
  });

  it("renders distinct badge for each role_type", () => {
    const types = ["planner", "research", "builder", "audit", "automation"];
    types.forEach((type) => {
      const { unmount } = render(
        <AgentCard role={makeRole({ role_type: type })} onClick={() => {}} />,
      );
      expect(screen.getByText(type)).toBeInTheDocument();
      unmount();
    });
  });
});
