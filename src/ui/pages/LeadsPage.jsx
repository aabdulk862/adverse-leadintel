import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import styles from "./LeadsPage.module.css";

const STATUS_OPTIONS = ["demo_ready", "ready_for_outreach", "sent", "replied", "converted", "unsubscribed"];
const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "demo_ready", label: "Demo Ready" },
  { key: "sent", label: "Sent" },
  { key: "replied", label: "Replied" },
];

function scoreClass(score) {
  if (score >= 30) return styles.scoreHigh;
  if (score >= 20) return styles.scoreMed;
  return styles.scoreLow;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("opportunities")
      .select("*")
      .eq("qualified", true)
      .order("opportunity_score", { ascending: false });

    if (filter !== "all") {
      if (filter === "sent" || filter === "replied") {
        query = query.eq("outreach_status", filter);
      } else {
        query = query.eq("status", filter);
      }
    }

    const { data, error } = await query;
    if (error) console.error("[LeadsPage] fetch error:", error.message);
    setLeads(data || []);
    setIsLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, location.key]);

  const updateStatus = async (id, field, value) => {
    const update = { [field]: value };
    if (field === "outreach_status" && value === "sent") {
      update.last_contacted_at = new Date().toISOString();
    }
    await supabase.from("opportunities").update(update).eq("id", id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...update } : l)));
  };

  if (isLoading) {
    return <div className={styles.loadingState}>Loading leads…</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Leads</h2>
        <div className={styles.controls}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          <button className={styles.refreshBtn} onClick={fetchLeads}>
            <i className="fa-solid fa-arrows-rotate" /> Refresh
          </button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No leads match this filter. Run <code>npm run pipeline</code> to discover leads.</p>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Score</th>
              <th>Business</th>
              <th>Contact</th>
              <th>Why They Need You</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <span className={`${styles.score} ${scoreClass(lead.opportunity_score)}`}>
                    {lead.opportunity_score}
                  </span>
                </td>
                <td>
                  <div className={styles.name}>{lead.business_name}</div>
                  <div className={styles.meta}>
                    {lead.address || lead.metro}
                    {lead.website && (
                      <> · <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer">{lead.website}</a></>
                    )}
                  </div>
                </td>
                <td>
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className={styles.phoneLink}>{lead.phone}</a>
                  ) : (
                    <span className={styles.meta}>—</span>
                  )}
                </td>
                <td>
                  <div className={styles.reasons}>
                    {(lead.score_reasons || []).map((r) => (
                      <span key={r} className={styles.reason}>{r.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={styles.reason}>{lead.opportunity_type || "—"}</span>
                </td>
                <td>
                  <select
                    className={styles.statusSelect}
                    value={lead.outreach_status || "pending"}
                    onChange={(e) => updateStatus(lead.id, "outreach_status", e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
