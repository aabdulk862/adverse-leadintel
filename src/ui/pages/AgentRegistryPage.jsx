import { useState, useEffect } from "react";
import AgentCard from "../components/agents/AgentCard";
import { getActiveAgentRoles } from "../../orchestrator/db.js";

export default function AgentRegistryPage() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRoles() {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await getActiveAgentRoles();
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message || "Failed to load agent roles");
        } else {
          setRoles(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "An unexpected error occurred");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = (role) => {
    setSelectedRole((prev) => (prev?.id === role.id ? null : role));
  };

  const handleCloseDetail = () => {
    setSelectedRole(null);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading agent roles"
        style={{ padding: "2rem", textAlign: "center" }}
      >
        <p>Loading agent roles…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{ padding: "2rem", textAlign: "center", color: "#e74c3c" }}
      >
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Agent Registry</h2>

      {roles.length === 0 ? (
        <div
          role="status"
          aria-label="Empty agent registry"
          style={{ padding: "2rem", textAlign: "center", color: "#888" }}
        >
          <p>No active agent roles are configured.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
          role="list"
          aria-label="Agent roles"
        >
          {roles.map((role) => (
            <div key={role.id} role="listitem">
              <AgentCard role={role} onClick={handleCardClick} />
            </div>
          ))}
        </div>
      )}

      {selectedRole && (
        <div
          role="region"
          aria-label="Agent role detail"
          style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3 style={{ margin: 0 }}>{selectedRole.name}</h3>
            <button
              onClick={handleCloseDetail}
              aria-label="Close detail panel"
              style={{
                background: "none",
                border: "none",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
              }}
            >
              ✕
            </button>
          </div>

          <section style={{ marginBottom: "1rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>System Prompt</h4>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f0f0f0",
                padding: "0.75rem",
                borderRadius: "4px",
                fontSize: "0.875rem",
              }}
            >
              {selectedRole.system_prompt}
            </pre>
          </section>

          <section style={{ marginBottom: "1rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Input Schema</h4>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f0f0f0",
                padding: "0.75rem",
                borderRadius: "4px",
                fontSize: "0.875rem",
              }}
            >
              {JSON.stringify(selectedRole.input_schema, null, 2)}
            </pre>
          </section>

          <section>
            <h4 style={{ marginBottom: "0.5rem" }}>Output Schema</h4>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f0f0f0",
                padding: "0.75rem",
                borderRadius: "4px",
                fontSize: "0.875rem",
              }}
            >
              {JSON.stringify(selectedRole.output_schema, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
