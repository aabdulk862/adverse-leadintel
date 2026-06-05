import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import styles from "./DashboardPage.module.css";

const PIPELINE_STEPS = [
  { icon: "fa-solid fa-magnifying-glass", label: "Discover" },
  { icon: "fa-solid fa-filter", label: "Qualify" },
  { icon: "fa-solid fa-wand-magic-sparkles", label: "Demo" },
  { icon: "fa-solid fa-paper-plane", label: "Outreach" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ discovered: 0, qualified: 0, demo_ready: 0, ready_for_outreach: 0 });
  const location = useLocation();

  const fetchStats = useCallback(async () => {
    try {
      const counts = {};
      for (const status of ["discovered", "qualified", "demo_ready", "ready_for_outreach"]) {
        const { count } = await supabase
          .from("opportunities")
          .select("*", { count: "exact", head: true })
          .eq("status", status);
        counts[status] = count || 0;
      }
      setStats(counts);
    } catch {
      // Stats are best-effort
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, location.key]);

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <h2 className={styles.heading}>Dashboard</h2>
        <button onClick={fetchStats} aria-label="Refresh stats" style={{ background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.375rem 0.625rem", color: "var(--color-text-muted)", cursor: "pointer" }}>
          <i className="fa-solid fa-arrows-rotate" />
        </button>
      </div>
      <p className={styles.subtitle}>Adverse Growth Engine — pipeline overview</p>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Discovered</span>
          <span className={`${styles.statValue} ${styles.statAccent}`}>{stats.discovered}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Qualified</span>
          <span className={`${styles.statValue} ${styles.statSuccess}`}>{stats.qualified}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Demo Ready</span>
          <span className={`${styles.statValue} ${styles.statWarning}`}>{stats.demo_ready}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Ready for Outreach</span>
          <span className={styles.statValue}>{stats.ready_for_outreach}</span>
        </div>
      </div>

      {/* Pipeline flow */}
      <section className={styles.pipelineSection}>
        <h3 className={styles.sectionTitle}>Pipeline Flow</h3>
        <div className={styles.pipelineFlow}>
          {PIPELINE_STEPS.map((step, i) => (
            <span key={step.label} style={{ display: "contents" }}>
              <div className={styles.pipelineStep}>
                <i className={step.icon} />
                {step.label}
              </div>
              {i < PIPELINE_STEPS.length - 1 && <span className={styles.arrow}>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h3 className={styles.sectionTitle}>Quick Actions</h3>
        <div className={styles.actionsGrid}>
          <Link to="/agents" className={styles.actionCard}>
            <div className={styles.actionIcon}><i className="fa-solid fa-comments" /></div>
            <div className={styles.actionInfo}>
              <div className={styles.actionTitle}>Agent Chat</div>
              <div className={styles.actionDesc}>Run pipelines via the orchestrator</div>
            </div>
          </Link>
          <Link to="/agents/registry" className={styles.actionCard}>
            <div className={styles.actionIcon}><i className="fa-solid fa-robot" /></div>
            <div className={styles.actionInfo}>
              <div className={styles.actionTitle}>Agent Registry</div>
              <div className={styles.actionDesc}>View and manage agent roles</div>
            </div>
          </Link>
          <Link to="/agents/artifacts" className={styles.actionCard}>
            <div className={styles.actionIcon}><i className="fa-solid fa-box-archive" /></div>
            <div className={styles.actionInfo}>
              <div className={styles.actionTitle}>Artifacts</div>
              <div className={styles.actionDesc}>Browse generated content</div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
