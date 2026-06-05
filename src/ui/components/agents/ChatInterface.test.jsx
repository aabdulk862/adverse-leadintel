import { render, screen, fireEvent } from "@testing-library/react";
import ChatInterface from "./ChatInterface";

describe("ChatInterface", () => {
  const sampleMessages = [
    {
      id: "1",
      role: "user",
      content: "Run an audit",
      timestamp: new Date().toISOString(),
    },
    {
      id: "2",
      role: "assistant",
      content: "Starting audit pipeline…",
      timestamp: new Date().toISOString(),
    },
  ];

  it("renders empty state when no messages", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} />);
    expect(screen.getByText(/send a message to start/i)).toBeInTheDocument();
  });

  it("renders user messages right-aligned and assistant messages left-aligned", () => {
    const { container } = render(
      <ChatInterface messages={sampleMessages} onSendMessage={() => {}} />,
    );
    const rows = container.querySelectorAll('[class*="messageRow"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toMatch(/messageRowUser/);
    expect(rows[1].className).toMatch(/messageRowAssistant/);
  });

  it("displays message content", () => {
    render(
      <ChatInterface messages={sampleMessages} onSendMessage={() => {}} />,
    );
    expect(screen.getByText("Run an audit")).toBeInTheDocument();
    expect(screen.getByText("Starting audit pipeline…")).toBeInTheDocument();
  });

  it("calls onSendMessage when form is submitted", () => {
    const onSend = vi.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form"));
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("clears input after sending", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} />);
    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.submit(input.closest("form"));
    expect(input.value).toBe("");
  });

  it("does not send empty messages", () => {
    const onSend = vi.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    fireEvent.submit(screen.getByLabelText("Message input").closest("form"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send whitespace-only messages", () => {
    const onSend = vi.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends message on Enter key", () => {
    const onSend = vi.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Enter test" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Enter test");
  });

  it("shows typing indicator when isLoading is true", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} isLoading />);
    expect(screen.getByRole("status", { name: /typing/i })).toBeInTheDocument();
  });

  it("hides typing indicator when isLoading is false", () => {
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={() => {}}
        isLoading={false}
      />,
    );
    expect(
      screen.queryByRole("status", { name: /typing/i }),
    ).not.toBeInTheDocument();
  });

  it("disables input and send button when isLoading", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} isLoading />);
    expect(screen.getByLabelText("Message input")).toBeDisabled();
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("disables send button when input is empty", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} />);
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("shows assistant avatar for assistant messages", () => {
    const { container } = render(
      <ChatInterface
        messages={[
          {
            id: "1",
            role: "assistant",
            content: "Hi",
            timestamp: new Date().toISOString(),
          },
        ]}
        onSendMessage={() => {}}
      />,
    );
    const avatars = container.querySelectorAll('[class*="avatar"]');
    expect(avatars.length).toBeGreaterThanOrEqual(1);
  });

  it("has proper ARIA attributes", () => {
    render(<ChatInterface messages={[]} onSendMessage={() => {}} />);
    expect(
      screen.getByRole("region", { name: /chat interface/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("log", { name: /messages/i })).toBeInTheDocument();
  });
});
