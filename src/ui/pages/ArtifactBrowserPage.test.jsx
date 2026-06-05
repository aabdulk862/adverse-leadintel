import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../orchestrator/db.js", () => ({
  getArtifacts: vi.fn(),
}));

import ArtifactBrowserPage from "./ArtifactBrowserPage";
import { getArtifacts } from "../../orchestrator/db.js";

const makeArtifact = (overrides = {}) => ({
  id: "art-1",
  task_id: "task-1",
  agent_role_id: "role-1",
  artifact_type: "audit_report",
  content: { executive_summary: "Test summary", categories: [] },
  created_at: "2025-06-01T12:00:00Z",
  ...overrides,
});

describe("ArtifactBrowserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    getArtifacts.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ArtifactBrowserPage />);
    expect(
      screen.getByRole("status", { name: /loading/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/loading artifacts/i)).toBeInTheDocument();
  });

  it("renders a list of artifacts when fetched successfully", async () => {
    const artifacts = [
      makeArtifact({ id: "a1", artifact_type: "audit_report" }),
      makeArtifact({
        id: "a2",
        artifact_type: "outreach_draft",
        content: { email_draft: "Hi" },
      }),
    ];
    getArtifacts.mockResolvedValue({ data: artifacts, error: null });

    render(<ArtifactBrowserPage />);

    const list = await screen.findByRole("list", { name: /artifacts/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Audit Report")).toBeInTheDocument();
    expect(within(items[1]).getByText("Outreach Draft")).toBeInTheDocument();
  });

  it("shows empty state when no artifacts exist", async () => {
    getArtifacts.mockResolvedValue({ data: [], error: null });

    render(<ArtifactBrowserPage />);

    await waitFor(() => {
      expect(screen.getByText(/no artifacts match/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", { name: /no artifacts found/i }),
    ).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    getArtifacts.mockResolvedValue({
      data: null,
      error: { message: "Connection refused" },
    });

    render(<ArtifactBrowserPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
  });

  it("filters artifacts by type when a filter checkbox is toggled", async () => {
    const allArtifacts = [
      makeArtifact({ id: "a1", artifact_type: "audit_report" }),
      makeArtifact({
        id: "a2",
        artifact_type: "plan",
        content: { text: "A plan" },
      }),
    ];

    // First call returns all, second call returns filtered
    getArtifacts
      .mockResolvedValueOnce({ data: allArtifacts, error: null })
      .mockResolvedValueOnce({ data: [allArtifacts[0]], error: null });

    render(<ArtifactBrowserPage />);

    // Wait for list to appear
    await screen.findByRole("list", { name: /artifacts/i });

    // Toggle the audit_report filter
    const auditCheckbox = screen.getByLabelText("Filter by Audit Report");
    fireEvent.click(auditCheckbox);

    await waitFor(() => {
      expect(getArtifacts).toHaveBeenCalledWith({
        artifact_type: "audit_report",
      });
    });
  });

  it("shows empty state when filters match no artifacts", async () => {
    getArtifacts
      .mockResolvedValueOnce({ data: [makeArtifact()], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    render(<ArtifactBrowserPage />);

    // Wait for initial list to render
    await screen.findByRole("list", { name: /artifacts/i });

    // Toggle a filter that returns no results
    const codeCheckbox = screen.getByLabelText("Filter by Code Snippet");
    fireEvent.click(codeCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/no artifacts match/i)).toBeInTheDocument();
    });
  });

  it("shows ArtifactViewer when an artifact is clicked", async () => {
    const artifact = makeArtifact({
      id: "a1",
      artifact_type: "audit_report",
      content: { executive_summary: "Great results", categories: [] },
    });
    getArtifacts.mockResolvedValue({ data: [artifact], error: null });

    render(<ArtifactBrowserPage />);

    const list = await screen.findByRole("list", { name: /artifacts/i });
    const item = within(list).getByRole("listitem");

    fireEvent.click(item);

    expect(
      screen.getByRole("region", { name: /artifact viewer/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Great results")).toBeInTheDocument();
  });

  it("toggles ArtifactViewer off when clicking the same artifact again", async () => {
    const artifact = makeArtifact({ id: "a1" });
    getArtifacts.mockResolvedValue({ data: [artifact], error: null });

    render(<ArtifactBrowserPage />);

    const list = await screen.findByRole("list", { name: /artifacts/i });
    const item = within(list).getByRole("listitem");

    // Open
    fireEvent.click(item);
    expect(
      screen.getByRole("region", { name: /artifact viewer/i }),
    ).toBeInTheDocument();

    // Close
    fireEvent.click(item);
    expect(
      screen.queryByRole("region", { name: /artifact viewer/i }),
    ).not.toBeInTheDocument();
  });

  it("uses client-side filtering when multiple types are selected", async () => {
    const allArtifacts = [
      makeArtifact({ id: "a1", artifact_type: "audit_report" }),
      makeArtifact({
        id: "a2",
        artifact_type: "plan",
        content: { text: "Plan" },
      }),
      makeArtifact({
        id: "a3",
        artifact_type: "code_snippet",
        content: { code: "..." },
      }),
    ];

    // Initial load, then single-filter fetch, then multi-filter fetch (all)
    getArtifacts
      .mockResolvedValueOnce({ data: allArtifacts, error: null })
      .mockResolvedValueOnce({ data: [allArtifacts[0]], error: null })
      .mockResolvedValueOnce({ data: allArtifacts, error: null });

    render(<ArtifactBrowserPage />);

    const list = await screen.findByRole("list", { name: /artifacts/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    // Select first type
    fireEvent.click(screen.getByLabelText("Filter by Audit Report"));

    await waitFor(() => {
      expect(getArtifacts).toHaveBeenCalledWith({
        artifact_type: "audit_report",
      });
    });

    // Select second type — triggers multi-type client-side filter
    fireEvent.click(screen.getByLabelText("Filter by Plan"));

    await waitFor(() => {
      // With multiple types, it fetches all and filters client-side
      expect(getArtifacts).toHaveBeenLastCalledWith();
    });
  });

  it("renders filter controls for all six artifact types", async () => {
    getArtifacts.mockResolvedValue({ data: [], error: null });

    render(<ArtifactBrowserPage />);

    await waitFor(() => {
      expect(screen.getByText(/no artifacts match/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Filter by Audit Report")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filter by Outreach Draft"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filter by Workflow Definition"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Code Snippet")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Plan")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filter by Research Summary"),
    ).toBeInTheDocument();
  });

  it("handles null data gracefully", async () => {
    getArtifacts.mockResolvedValue({ data: null, error: null });

    render(<ArtifactBrowserPage />);

    await waitFor(() => {
      expect(screen.getByText(/no artifacts match/i)).toBeInTheDocument();
    });
  });
});
