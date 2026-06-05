import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";
import { getTasksByPipeline } from "../../../orchestrator/db.js";
import styles from "./TaskBoard.module.css";

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_BADGE = {
  pending: styles.badgePending,
  in_progress: styles.badgeInProgress,
  completed: styles.badgeCompleted,
  failed: styles.badgeFailed,
};

export default function TaskBoard({
  tasks: initialTasks = [],
  pipelineStatus,
}) {
  const [tasks, setTasks] = useState(initialTasks);

  // Sync local state when parent passes new tasks
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Derive the pipeline_id from the first task (all tasks share the same pipeline)
  const pipelineId = tasks.length > 0 ? tasks[0].pipeline_id : null;

  // Handle realtime update payload
  const handleRealtimeUpdate = useCallback((payload) => {
    const updated = payload.new;
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
    );
  }, []);

  // Ref to hold the polling interval so we can start/stop it from callbacks
  const pollingRef = useRef(null);

  // Start polling: fetch tasks every 5 seconds as a fallback
  const startPolling = useCallback(() => {
    if (pollingRef.current || !pipelineId) return;
    pollingRef.current = setInterval(async () => {
      const { data } = await getTasksByPipeline(pipelineId);
      if (data) {
        setTasks(data);
      }
    }, 5000);
  }, [pipelineId]);

  // Stop polling when realtime reconnects
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Subscribe to Supabase realtime for live task status updates
  // Falls back to polling every 5 seconds if the channel disconnects
  useEffect(() => {
    if (!pipelineId) return;

    const channel = supabase
      .channel(`tasks-${pipelineId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        handleRealtimeUpdate,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopPolling();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startPolling();
        }
      });

    return () => {
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [pipelineId, handleRealtimeUpdate, startPolling, stopPolling]);

  // Progress calculation
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (tasks.length === 0) {
    return (
      <div className={styles.board} role="region" aria-label="Task board">
        <div className={styles.empty}>
          <i className="fa-solid fa-list-check" />
          <p>No tasks in this pipeline yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board} role="region" aria-label="Task board">
      {/* Header with title and progress label */}
      <div className={styles.header}>
        <h3 className={styles.title}>Task Pipeline</h3>
        <span className={styles.progressLabel}>
          {completedCount} / {totalCount} completed
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label={`${completedCount} of ${totalCount} tasks completed`}
      >
        <div
          className={styles.progressFill}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Task cards */}
      <ul className={styles.taskList}>
        {tasks.map((task) => {
          const badgeClass = STATUS_BADGE[task.status] || STATUS_BADGE.pending;
          const label = STATUS_LABELS[task.status] || task.status;

          return (
            <li key={task.id} className={styles.taskCard}>
              <div className={styles.taskInfo}>
                <p className={styles.taskName}>{task.name}</p>
                <p className={styles.taskRole}>
                  {task.agent_role_name || task.agent_role_id}
                </p>
              </div>
              <span className={`${styles.badge} ${badgeClass}`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
