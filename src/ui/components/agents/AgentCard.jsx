import styles from "./AgentCard.module.css";

const BADGE_CLASS = {
  planner: styles.badgePlanner,
  research: styles.badgeResearch,
  builder: styles.badgeBuilder,
  audit: styles.badgeAudit,
  automation: styles.badgeAutomation,
};

const STATUS_CLASS = {
  active: styles.statusActive,
  inactive: styles.statusInactive,
  draft: styles.statusDraft,
};

const STATUS_LABEL = {
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
};

export default function AgentCard({ role, onClick }) {
  if (!role) return null;

  const badgeCls = BADGE_CLASS[role.role_type] || "";
  const statusCls = STATUS_CLASS[role.status] || styles.statusDraft;
  const statusLabel = STATUS_LABEL[role.status] || role.status;

  const handleClick = () => {
    if (typeof onClick === "function") {
      onClick(role);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${role.name} agent card`}
    >
      <div className={styles.header}>
        <div className={styles.nameRow}>
          <span
            className={`${styles.statusDot} ${statusCls}`}
            aria-label={`Status: ${statusLabel}`}
            role="img"
          />
          <h3 className={styles.name}>{role.name}</h3>
        </div>
        <span className={`${styles.badge} ${badgeCls}`}>{role.role_type}</span>
      </div>

      <p className={styles.description}>{role.description}</p>
    </div>
  );
}
