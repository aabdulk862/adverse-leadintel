import { useState } from "react";
import styles from "./ArtifactViewer.module.css";

const OUTREACH_TABS = [
  { key: "email_draft", label: "Email Draft" },
  { key: "linkedin_message", label: "LinkedIn Message" },
  { key: "proposal_outline", label: "Proposal Outline" },
];

function typeLabel(artifactType) {
  const labels = {
    audit_report: "Audit Report",
    outreach_draft: "Outreach Draft",
    workflow_definition: "Workflow Definition",
    code_snippet: "Code Snippet",
    plan: "Plan",
    research_summary: "Research Summary",
  };
  return labels[artifactType] || artifactType;
}

function typeIcon(artifactType) {
  const icons = {
    audit_report: "fa-solid fa-chart-bar",
    outreach_draft: "fa-solid fa-envelope",
    workflow_definition: "fa-solid fa-diagram-project",
    code_snippet: "fa-solid fa-code",
    plan: "fa-solid fa-list-check",
    research_summary: "fa-solid fa-magnifying-glass",
  };
  return icons[artifactType] || "fa-solid fa-file";
}

function priorityClass(priority) {
  if (priority === "high") return styles.priorityHigh;
  if (priority === "medium") return styles.priorityMedium;
  return styles.priorityLow;
}

function contentToString(content) {
  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content, null, 2);
}

/* ── Audit Report Renderer ── */
function AuditReportContent({ content }) {
  const summary = content?.executive_summary;
  const categories = Array.isArray(content?.categories)
    ? content.categories
    : [];

  return (
    <div className={styles.content}>
      {summary && <p className={styles.summary}>{summary}</p>}
      {categories.map((cat, idx) => (
        <div key={cat.name || idx} className={styles.category}>
          <div className={styles.categoryHeader}>
            <h4 className={styles.categoryName}>{cat.name}</h4>
            <span className={styles.score}>
              {cat.score}/10
              <span
                className={styles.scoreBar}
                role="meter"
                aria-valuenow={cat.score}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-label={`${cat.name} score`}
              >
                <span
                  className={styles.scoreFill}
                  style={{ width: `${(cat.score / 10) * 100}%` }}
                />
              </span>
            </span>
          </div>

          {Array.isArray(cat.findings) && cat.findings.length > 0 && (
            <>
              <p className={styles.subHeading}>Findings</p>
              <ul className={styles.list}>
                {cat.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {Array.isArray(cat.recommendations) &&
            cat.recommendations.length > 0 && (
              <>
                <p className={styles.subHeading}>Recommendations</p>
                {cat.recommendations.map((rec, i) => (
                  <div key={i} className={styles.recommendation}>
                    <p className={styles.recText}>{rec.text}</p>
                    <div className={styles.recMeta}>
                      {rec.priority && (
                        <span className={priorityClass(rec.priority)}>
                          {rec.priority}
                        </span>
                      )}
                      {rec.estimated_effort && (
                        <span>Effort: {rec.estimated_effort}</span>
                      )}
                      {rec.expected_impact && (
                        <span>Impact: {rec.expected_impact}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
        </div>
      ))}
    </div>
  );
}

/* ── Outreach Draft Renderer ── */
function OutreachDraftContent({ content }) {
  const [activeTab, setActiveTab] = useState("email_draft");
  const placeholders = Array.isArray(content?.placeholders)
    ? content.placeholders
    : [];

  return (
    <div className={styles.content}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Outreach content tabs"
      >
        {OUTREACH_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-label={OUTREACH_TABS.find((t) => t.key === activeTab)?.label}
        className={styles.tabContent}
      >
        {contentToString(content?.[activeTab])}
      </div>

      {placeholders.length > 0 && (
        <div className={styles.placeholders}>
          {placeholders.map((ph, i) => (
            <span key={i} className={styles.placeholder}>
              {ph}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Code / JSON Renderer ── */
function CodeContent({ content }) {
  return (
    <pre className={styles.codeBlock}>
      <code>{contentToString(content)}</code>
    </pre>
  );
}

/* ── Formatted Text Renderer ── */
function FormattedTextContent({ content }) {
  return <div className={styles.formattedText}>{contentToString(content)}</div>;
}

/* ── Main Component ── */
export default function ArtifactViewer({ artifact }) {
  if (!artifact) return null;

  const { artifact_type, content, id } = artifact;

  const handleDownload = () => {
    const json = JSON.stringify(content, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artifact-${id || "export"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  let renderedContent;
  switch (artifact_type) {
    case "audit_report":
      renderedContent = <AuditReportContent content={content} />;
      break;
    case "outreach_draft":
      renderedContent = <OutreachDraftContent content={content} />;
      break;
    case "workflow_definition":
      renderedContent = <CodeContent content={content} />;
      break;
    case "code_snippet":
      renderedContent = <CodeContent content={content} />;
      break;
    default:
      renderedContent = <FormattedTextContent content={content} />;
      break;
  }

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Artifact viewer"
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <i className={typeIcon(artifact_type)} aria-hidden="true" />
          <h3 className={styles.title}>{typeLabel(artifact_type)}</h3>
          <span className={styles.typeBadge}>{artifact_type}</span>
        </div>
        <button
          type="button"
          className={styles.downloadBtn}
          onClick={handleDownload}
          aria-label="Download artifact as JSON"
        >
          <i className="fa-solid fa-download" aria-hidden="true" />
          Download
        </button>
      </div>

      {renderedContent}
    </div>
  );
}
