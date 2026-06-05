import { useState } from "react";
import styles from "./AlignmentCard.module.css";

export default function AlignmentCard({
  alignmentText = "",
  onApprove,
  onRevise,
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleApprove = () => {
    if (typeof onApprove === "function") {
      onApprove();
    }
  };

  const handleReviseToggle = () => {
    setShowFeedback((prev) => !prev);
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    const text = feedback.trim();
    if (!text) return;
    if (typeof onRevise === "function") {
      onRevise(text);
    }
    setFeedback("");
    setShowFeedback(false);
  };

  return (
    <div className={styles.card} role="region" aria-label="Alignment check">
      <div className={styles.header}>
        <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
        <h3 className={styles.title}>Alignment Check</h3>
      </div>

      <pre className={styles.content}>{alignmentText}</pre>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnApprove}`}
          onClick={handleApprove}
          aria-label="Approve plan"
        >
          <i className="fa-solid fa-check" aria-hidden="true" />
          Approve
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnRevise}`}
          onClick={handleReviseToggle}
          aria-label="Revise plan"
          aria-expanded={showFeedback}
        >
          <i className="fa-solid fa-pen" aria-hidden="true" />
          Revise
        </button>
      </div>

      {showFeedback && (
        <form className={styles.feedbackForm} onSubmit={handleFeedbackSubmit}>
          <label htmlFor="alignment-feedback" className={styles.feedbackLabel}>
            Feedback
          </label>
          <textarea
            id="alignment-feedback"
            className={styles.feedbackInput}
            placeholder="Describe what should change…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            aria-label="Revision feedback"
          />
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnSubmit}`}
            disabled={!feedback.trim()}
            aria-label="Submit feedback"
          >
            Submit Feedback
          </button>
        </form>
      )}
    </div>
  );
}
