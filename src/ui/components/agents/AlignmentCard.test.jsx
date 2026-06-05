import { render, screen, fireEvent } from "@testing-library/react";
import AlignmentCard from "./AlignmentCard";

const sampleText = `Pipeline Plan
=============
1. Planner → Define audit scope
2. Research → Gather business data
3. Audit → Evaluate operations
4. Planner → Synthesize report`;

describe("AlignmentCard", () => {
  it("renders alignment text with pre-wrap formatting", () => {
    const { container } = render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre.textContent).toBe(sampleText);
  });

  it("renders approve and revise buttons", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /approve plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /revise plan/i }),
    ).toBeInTheDocument();
  });

  it("calls onApprove when approve button is clicked", () => {
    const onApprove = vi.fn();
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={onApprove}
        onRevise={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /approve plan/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("does not show feedback input initially", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    expect(
      screen.queryByLabelText(/revision feedback/i),
    ).not.toBeInTheDocument();
  });

  it("shows feedback input when revise button is clicked", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    expect(screen.getByLabelText(/revision feedback/i)).toBeInTheDocument();
  });

  it("hides feedback input when revise button is clicked again", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    const reviseBtn = screen.getByRole("button", { name: /revise plan/i });
    fireEvent.click(reviseBtn);
    expect(screen.getByLabelText(/revision feedback/i)).toBeInTheDocument();
    fireEvent.click(reviseBtn);
    expect(
      screen.queryByLabelText(/revision feedback/i),
    ).not.toBeInTheDocument();
  });

  it("calls onRevise with feedback text when feedback is submitted", () => {
    const onRevise = vi.fn();
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={onRevise}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    const textarea = screen.getByLabelText(/revision feedback/i);
    fireEvent.change(textarea, {
      target: { value: "Add a security review step" },
    });
    fireEvent.submit(textarea.closest("form"));
    expect(onRevise).toHaveBeenCalledWith("Add a security review step");
  });

  it("clears feedback input and hides form after submission", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    const textarea = screen.getByLabelText(/revision feedback/i);
    fireEvent.change(textarea, { target: { value: "Change order" } });
    fireEvent.submit(textarea.closest("form"));
    expect(
      screen.queryByLabelText(/revision feedback/i),
    ).not.toBeInTheDocument();
  });

  it("does not call onRevise when feedback is empty", () => {
    const onRevise = vi.fn();
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={onRevise}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    const textarea = screen.getByLabelText(/revision feedback/i);
    fireEvent.submit(textarea.closest("form"));
    expect(onRevise).not.toHaveBeenCalled();
  });

  it("does not call onRevise when feedback is whitespace-only", () => {
    const onRevise = vi.fn();
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={onRevise}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    const textarea = screen.getByLabelText(/revision feedback/i);
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.submit(textarea.closest("form"));
    expect(onRevise).not.toHaveBeenCalled();
  });

  it("disables submit button when feedback is empty", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    expect(
      screen.getByRole("button", { name: /submit feedback/i }),
    ).toBeDisabled();
  });

  it("enables submit button when feedback has content", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revise plan/i }));
    const textarea = screen.getByLabelText(/revision feedback/i);
    fireEvent.change(textarea, { target: { value: "Some feedback" } });
    expect(
      screen.getByRole("button", { name: /submit feedback/i }),
    ).not.toBeDisabled();
  });

  it("has proper ARIA region label", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    expect(
      screen.getByRole("region", { name: /alignment check/i }),
    ).toBeInTheDocument();
  });

  it("sets aria-expanded on revise button", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    const reviseBtn = screen.getByRole("button", { name: /revise plan/i });
    expect(reviseBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(reviseBtn);
    expect(reviseBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("renders with empty alignment text", () => {
    render(
      <AlignmentCard
        alignmentText=""
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    const pre = screen
      .getByRole("region", { name: /alignment check/i })
      .querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre.textContent).toBe("");
  });

  it("renders header with title", () => {
    render(
      <AlignmentCard
        alignmentText={sampleText}
        onApprove={() => {}}
        onRevise={() => {}}
      />,
    );
    expect(screen.getByText("Alignment Check")).toBeInTheDocument();
  });
});
