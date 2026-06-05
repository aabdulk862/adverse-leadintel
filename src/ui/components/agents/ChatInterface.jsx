import { useState, useRef, useEffect } from "react";
import styles from "./ChatInterface.module.css";

function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday ${time}`;

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function ChatInterface({
  messages = [],
  onSendMessage,
  isLoading = false,
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.container} role="region" aria-label="Chat interface">
      <div
        className={styles.messageList}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {messages.length === 0 && !isLoading && (
          <div className={styles.empty}>
            <i className="fa-solid fa-robot" />
            <p>
              Send a message to start a conversation with the AI orchestrator.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageRow} ${msg.role === "user" ? styles.messageRowUser : styles.messageRowAssistant}`}
          >
            {msg.role === "assistant" && (
              <div className={styles.avatar} aria-hidden="true">
                <i className="fa-solid fa-robot" />
              </div>
            )}
            <div
              className={`${styles.bubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}`}
            >
              <p className={styles.bubbleContent}>{msg.content}</p>
              {msg.timestamp && (
                <span className={styles.timestamp}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.messageRow} ${styles.messageRowAssistant}`}>
            <div className={styles.avatar} aria-hidden="true">
              <i className="fa-solid fa-robot" />
            </div>
            <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
              <div
                className={styles.typing}
                role="status"
                aria-label="Assistant is typing"
              >
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className={styles.textInput}
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Message input"
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          {isLoading ? (
            <i className="fa-solid fa-spinner fa-spin" />
          ) : (
            <i className="fa-solid fa-paper-plane" />
          )}
        </button>
      </form>
    </div>
  );
}
