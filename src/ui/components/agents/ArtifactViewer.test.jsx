import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ArtifactViewer from "./ArtifactViewer";

/* ── Helpers ── */
function makeArtifact(overrides = {}) {
  return {
    id: "art-001",
    task_id: "task-001",
    agent_role_id: "role-001",
    artifact_type: "plan",
    content: { text: "Sample plan content" },
    created_at: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

const auditContent = {
  executive_summary:
    "The business shows strong operations but has automation gaps.",
  categories: [
    {
      name: "operations_efficiency",
      score: 8,
      findings: ["Streamlined onboarding", "Manual invoicing detected"],
      recommendations: [
        {
          text: "Automate invoicing",
          priority: "high",
          estimated_effort: "2 weeks",
          expected_impact: "Save 10 hours/week",
        },
        {
          text: "Add monitoring dashboard",
          priority: "medium",
          estimated_effort: "1 week",
          expected_impact: "Faster issue detection",
        },
      ],
    },
    {
      name: "ux_quality",
      score: 6,
      findings: ["Slow page load times"],
      recommendations: [
        {
          text: "Optimize images",
          priority: "low",
          estimated_effort: "3 days",
          expected_impact: "Improved load speed",
        },
      ],
    },
  ],
};

const outreachContent = {
  email_draft: "Dear [company_name], we noticed your [pain_point]...",
  linkedin_message: "Hi there, I saw your company is growing...",
  proposal_outline: "1. Introduction\n2. Problem Statement\n3. Solution",
  placeholders: ["[company_name]", "[pain_point]"],
};

/* ── Mock URL.createObjectURL / revokeObjectURL ── */
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
beforeAll(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

describe("ArtifactViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when artifact is not provided", () => {
    const { container } = render(<ArtifactViewer artifact={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders with proper ARIA region label", () => {
    render(<ArtifactViewer artifact={makeArtifact()} />);
    expect(
      screen.getByRole("region", { name: /artifact viewer/i }),
    ).toBeInTheDocument();
  });

  it("renders the artifact type label and badge", () => {
    render(
      <ArtifactViewer
        artifact={makeArtifact({ artifact_type: "audit_report" })}
      />,
    );
    expect(screen.getByText("Audit Report")).toBeInTheDocument();
    expect(screen.getByText("audit_report")).toBeInTheDocument();
  });

  it("renders download button", () => {
    render(<ArtifactViewer artifact={makeArtifact()} />);
    expect(
      screen.getByRole("button", { name: /download artifact as json/i }),
    ).toBeInTheDocument();
  });

  /* ── Download ── */
  it("triggers JSON download when download button is clicked", () => {
    const artifact = makeArtifact({ content: { hello: "world" } });
    render(<ArtifactViewer artifact={artifact} />);

    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => {});
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => {});

    fireEvent.click(
      screen.getByRole("button", { name: /download artifact as json/i }),
    );

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = mockCreateObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/json");

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  /* ── Audit Report ── */
  describe("audit_report", () => {
    it("renders executive summary", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: auditContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(
        screen.getByText(auditContent.executive_summary),
      ).toBeInTheDocument();
    });

    it("renders category names and scores", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: auditContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText("operations_efficiency")).toBeInTheDocument();
      expect(screen.getByText("ux_quality")).toBeInTheDocument();
      expect(screen.getByText("8/10")).toBeInTheDocument();
      expect(screen.getByText("6/10")).toBeInTheDocument();
    });

    it("renders score bars with correct aria attributes", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: auditContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      const meters = screen.getAllByRole("meter");
      expect(meters).toHaveLength(2);
      expect(meters[0]).toHaveAttribute("aria-valuenow", "8");
      expect(meters[0]).toHaveAttribute("aria-valuemax", "10");
    });

    it("renders findings as list items", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: auditContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText("Streamlined onboarding")).toBeInTheDocument();
      expect(screen.getByText("Manual invoicing detected")).toBeInTheDocument();
      expect(screen.getByText("Slow page load times")).toBeInTheDocument();
    });

    it("renders recommendations with priority, effort, and impact", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: auditContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText("Automate invoicing")).toBeInTheDocument();
      expect(screen.getByText("high")).toBeInTheDocument();
      expect(screen.getByText("Effort: 2 weeks")).toBeInTheDocument();
      expect(
        screen.getByText("Impact: Save 10 hours/week"),
      ).toBeInTheDocument();
    });

    it("handles audit report with empty categories", () => {
      const artifact = makeArtifact({
        artifact_type: "audit_report",
        content: { executive_summary: "Summary only", categories: [] },
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText("Summary only")).toBeInTheDocument();
    });
  });

  /* ── Outreach Draft ── */
  describe("outreach_draft", () => {
    it("renders tabs for email, linkedin, and proposal", () => {
      const artifact = makeArtifact({
        artifact_type: "outreach_draft",
        content: outreachContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(
        screen.getByRole("tab", { name: /email draft/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /linkedin message/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /proposal outline/i }),
      ).toBeInTheDocument();
    });

    it("shows email draft content by default", () => {
      const artifact = makeArtifact({
        artifact_type: "outreach_draft",
        content: outreachContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByRole("tabpanel")).toHaveTextContent(
        outreachContent.email_draft,
      );
    });

    it("switches tab content when a different tab is clicked", () => {
      const artifact = makeArtifact({
        artifact_type: "outreach_draft",
        content: outreachContent,
      });
      render(<ArtifactViewer artifact={artifact} />);

      fireEvent.click(screen.getByRole("tab", { name: /linkedin message/i }));
      expect(screen.getByRole("tabpanel")).toHaveTextContent(
        outreachContent.linkedin_message,
      );

      fireEvent.click(screen.getByRole("tab", { name: /proposal outline/i }));
      expect(screen.getByRole("tabpanel")).toHaveTextContent(
        /1\. Introduction/,
      );
    });

    it("marks the active tab with aria-selected", () => {
      const artifact = makeArtifact({
        artifact_type: "outreach_draft",
        content: outreachContent,
      });
      render(<ArtifactViewer artifact={artifact} />);

      const emailTab = screen.getByRole("tab", { name: /email draft/i });
      const linkedinTab = screen.getByRole("tab", {
        name: /linkedin message/i,
      });

      expect(emailTab).toHaveAttribute("aria-selected", "true");
      expect(linkedinTab).toHaveAttribute("aria-selected", "false");

      fireEvent.click(linkedinTab);
      expect(emailTab).toHaveAttribute("aria-selected", "false");
      expect(linkedinTab).toHaveAttribute("aria-selected", "true");
    });

    it("renders placeholders", () => {
      const artifact = makeArtifact({
        artifact_type: "outreach_draft",
        content: outreachContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText("[company_name]")).toBeInTheDocument();
      expect(screen.getByText("[pain_point]")).toBeInTheDocument();
    });
  });

  /* ── Workflow Definition ── */
  describe("workflow_definition", () => {
    it("renders content as formatted JSON in a code block", () => {
      const wfContent = { name: "My Workflow", nodes: [], connections: {} };
      const artifact = makeArtifact({
        artifact_type: "workflow_definition",
        content: wfContent,
      });
      const { container } = render(<ArtifactViewer artifact={artifact} />);
      const codeEl = container.querySelector("code");
      expect(codeEl).toBeInTheDocument();
      expect(codeEl.textContent).toContain('"My Workflow"');
    });
  });

  /* ── Code Snippet ── */
  describe("code_snippet", () => {
    it("renders content as a code block", () => {
      const codeContent = 'function hello() { return "world"; }';
      const artifact = makeArtifact({
        artifact_type: "code_snippet",
        content: codeContent,
      });
      const { container } = render(<ArtifactViewer artifact={artifact} />);
      const codeEl = container.querySelector("code");
      expect(codeEl).toBeInTheDocument();
      expect(codeEl.textContent).toContain("hello");
    });
  });

  /* ── Plan / Research Summary (formatted text) ── */
  describe("plan", () => {
    it("renders content as formatted text", () => {
      const planContent = { summary: "Step 1: Research\nStep 2: Build" };
      const artifact = makeArtifact({
        artifact_type: "plan",
        content: planContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText(/Step 1: Research/)).toBeInTheDocument();
    });
  });

  describe("research_summary", () => {
    it("renders content as formatted text", () => {
      const researchContent = { findings: "Market is growing at 15% YoY" };
      const artifact = makeArtifact({
        artifact_type: "research_summary",
        content: researchContent,
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText(/Market is growing/)).toBeInTheDocument();
    });
  });

  /* ── Unknown type fallback ── */
  describe("unknown artifact type", () => {
    it("renders content as formatted text for unknown types", () => {
      const artifact = makeArtifact({
        artifact_type: "custom_type",
        content: { data: "test" },
      });
      render(<ArtifactViewer artifact={artifact} />);
      expect(screen.getByText(/test/)).toBeInTheDocument();
    });
  });

  /* ── Edge cases ── */
  it("handles null content gracefully", () => {
    const artifact = makeArtifact({ content: null });
    const { container } = render(<ArtifactViewer artifact={artifact} />);
    expect(container.querySelector('[class*="container"]')).toBeInTheDocument();
  });

  it("uses artifact id in download filename", () => {
    const artifact = makeArtifact({ id: "my-special-id", content: {} });
    render(<ArtifactViewer artifact={artifact} />);

    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((el) => {
        expect(el.download).toBe("artifact-my-special-id.json");
      });
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => {});

    fireEvent.click(
      screen.getByRole("button", { name: /download artifact as json/i }),
    );

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
