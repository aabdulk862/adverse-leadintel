import { useState, useEffect } from "react";
import AgentCard from "../components/agents/AgentCard";
import { getActiveAgentRoles } from "../../orchestrator/db.js";
import styles from "./AgentRegistryPage.module.css";

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
      <div className={styles.loadingState} role="status" aria-label="Loading agent roles">
        <p>Loading agent roles…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState} role="alert">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Agent Registry</h2>

      {roles.length === 0 ? (
        <div className={styles.emptyState} role="status" aria-label="Empty agent registry">
          <p>No active agent roles are configured.</p>
        </div>
      ) : (
        <div className={styles.grid} role="list" aria-label="Agent roles">
          {roles.map((role) => (
            <div key={role.id} role="listitem">
              <AgentCard role={role} onClick={handleCardClick} />
            </div>
          ))}
        </div>
      )}

      {selectedRole && (
        <div className={styles.detailPanel} role="region" aria-label="Agent role detail">
          <div className={styles.detailHeader}>
            <h3>{selectedRole.name}</h3>
            <button onClick={handleCloseDetail} aria-label="Close detail panel" className={styles.closeBtn}>
              ✕
            </button>
          </div>

          <section className={styles.section}>
            <h4>System Prompt</h4>
            <pre>{selectedRole.system_prompt}</pre>
          </section>

          <section className={styles.section}>
            <h4>Input Schema</h4>
            <pre>{JSON.stringify(selectedRole.input_schema, null, 2)}</pre>
          </section>

          <section className={styles.section}>
            <h4>Output Schema</h4>
            <pre>{JSON.stringify(selectedRole.output_schema, null, 2)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
