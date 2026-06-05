import { useState } from "react";

const PASSPHRASE = import.meta.env.VITE_AGENT_PASSPHRASE || "adverse2025";
const STORAGE_KEY = "agent_auth";

function isAuthenticated() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function BasicAuthGate({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === PASSPHRASE) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect passphrase");
    }
  };

  if (authed) return children;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>AI Agent Console</h2>
        <p style={{ color: "#888", fontSize: "0.875rem", margin: 0 }}>
          Enter the passphrase to continue.
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Passphrase"
          aria-label="Passphrase"
          autoFocus
          style={{
            padding: "0.625rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: "0.875rem",
          }}
        />
        {error && (
          <p style={{ color: "#e74c3c", fontSize: "0.8125rem", margin: 0 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          style={{
            padding: "0.625rem",
            borderRadius: 6,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
