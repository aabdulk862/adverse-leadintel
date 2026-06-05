import { NavLink, Outlet } from "react-router-dom";
import styles from "./AgentLayout.module.css";

const navItems = [
  { to: "/agents", label: "Chat", icon: "fa-solid fa-comments", end: true },
  { to: "/agents/registry", label: "Agents", icon: "fa-solid fa-robot" },
  {
    to: "/agents/artifacts",
    label: "Artifacts",
    icon: "fa-solid fa-box-archive",
  },
];

export default function AgentLayout() {
  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <i className="fa-solid fa-brain" />
          <span>Agent Console</span>
        </div>
        <nav className={styles.nav} aria-label="Agent console navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || false}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              <i className={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <a href="/" className={styles.backLink}>
          <i className="fa-solid fa-arrow-left" />
          Back to site
        </a>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
