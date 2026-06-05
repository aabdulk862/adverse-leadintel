import { useState, useEffect, useCallback } from "react";
import ArtifactViewer from "../components/agents/ArtifactViewer";
import { getArtifacts } from "../../orchestrator/db.js";
import styles from "./ArtifactBrowserPage.module.css";

const ARTIFACT_TYPES = [
  { key: "audit_report", label: "Audit Report" },
  { key: "outreach_draft", label: "Outreach Draft" },
  { key: "workflow_definition", label: "Workflow Definition" },
  { key: "code_snippet", label: "Code Snippet" },
  { key: "plan", label: "Plan" },
  { key: "research_summary", label: "Research Summary" },
];

const TYPE_ICONS = {
  audit_report: "fa-solid fa-chart-bar",
  outreach_draft: "fa-solid fa-envelope",
  workflow_definition: "fa-solid fa-diagram-project",
  code_snippet: "fa-solid fa-code",
  plan: "fa-solid fa-list-check",
  research_summary: "fa-solid fa-magnifying-glass",
};

function typeLabel(artifactType) {
  const entry = ARTIFACT_TYPES.find((t) => t.key === artifactType);
  return entry ? entry.label : artifactType;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function ArtifactBrowserPage() {
  const [artifacts, setArtifacts] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchArtifacts = useCallback(async (typeFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeFilters.length === 0) {
        // No filter — fetch all artifacts
        const { data, error: fetchError } = await getArtifacts();
        if (fetchError) {
          setError(fetchError.message || "Failed to load artifacts");
          setArtifacts([]);
        } else {
          setArtifacts(data || []);
        }
      } else if (typeFilters.length === 1) {
        // Single type — use the API filter directly
        const { data, error: fetchError } = await getArtifacts({
          artifact_type: typeFilters[0],
        });
        if (fetchError) {
          setError(fetchError.message || "Failed to load artifacts");
          setArtifacts([]);
        } else {
          setArtifacts(data || []);
        }
      } else {
        // Multiple types — fetch all and filter client-side
        const { data, error: fetchError } = await getArtifacts();
        if (fetchError) {
          setError(fetchError.message || "Failed to load artifacts");
          setArtifacts([]);
        } else {
          const filtered = (data || []).filter((a) =>
            typeFilters.includes(a.artifact_type),
          );
          setArtifacts(filtered);
        }
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setArtifacts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtifacts(selectedTypes);
  }, [selectedTypes, fetchArtifacts]);

  const handleTypeToggle = (typeKey) => {
    setSelectedTypes((prev) =>
      prev.includes(typeKey)
        ? prev.filter((t) => t !== typeKey)
        : [...prev, typeKey],
    );
  };

  const handleArtifactClick = (artifact) => {
    setSelectedArtifact((prev) => (prev?.id === artifact.id ? null : artifact));
  };

  if (isLoading) {
    return (
      <div
        className={styles.loadingState}
        role="status"
        aria-label="Loading artifacts"
      >
        <p>Loading artifacts…</p>
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
    <div className={styles.container}>
      <h2 className={styles.heading}>Artifact Browser</h2>

      {/* Filter controls */}
      <div
        className={styles.filterBar}
        role="group"
        aria-label="Artifact type filters"
      >
        {ARTIFACT_TYPES.map((type) => {
          const isActive = selectedTypes.includes(type.key);
          return (
            <label
              key={type.key}
              className={`${styles.filterLabel} ${isActive ? styles.filterLabelActive : ""}`}
            >
              <input
                type="checkbox"
                className={styles.filterCheckbox}
                checked={isActive}
                onChange={() => handleTypeToggle(type.key)}
                aria-label={`Filter by ${type.label}`}
              />
              {type.label}
            </label>
          );
        })}
      </div>

      {/* Artifact list */}
      {artifacts.length === 0 ? (
        <div
          className={styles.emptyState}
          role="status"
          aria-label="No artifacts found"
        >
          <p>No artifacts match the selected filters.</p>
        </div>
      ) : (
        <div className={styles.list} role="list" aria-label="Artifacts">
          {artifacts.map((artifact) => {
            const isSelected = selectedArtifact?.id === artifact.id;
            return (
              <button
                key={artifact.id}
                type="button"
                role="listitem"
                className={`${styles.artifactItem} ${isSelected ? styles.artifactItemSelected : ""}`}
                onClick={() => handleArtifactClick(artifact)}
                aria-label={`${typeLabel(artifact.artifact_type)} artifact`}
              >
                <i
                  className={`${TYPE_ICONS[artifact.artifact_type] || "fa-solid fa-file"} ${styles.artifactIcon}`}
                  aria-hidden="true"
                />
                <div className={styles.artifactInfo}>
                  <div className={styles.artifactType}>
                    {typeLabel(artifact.artifact_type)}
                  </div>
                  <div className={styles.artifactDate}>
                    {formatDate(artifact.created_at)}
                  </div>
                </div>
                <span className={styles.artifactBadge}>
                  {artifact.artifact_type}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedArtifact && (
        <div className={styles.detailPanel}>
          <ArtifactViewer artifact={selectedArtifact} />
        </div>
      )}
    </div>
  );
}
