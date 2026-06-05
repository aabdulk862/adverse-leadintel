import { getSupabase } from "../lib/supabase.js";

/**
 * Marks demo_ready opportunities as ready_for_outreach.
 * The adamsverse orchestrator picks them up from there.
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function queueForOutreach() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("opportunities")
      .update({ status: "ready_for_outreach" })
      .eq("status", "demo_ready")
      .select("id");

    if (error) return { data: null, error: { message: error.message, code: "QUEUE_ERROR" } };

    return { data: { queued: data.length }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "OUTREACH_ERROR" } };
  }
}
