import { getSupabase } from "../lib/supabase.js";
import { gatherSignals } from "./signals.js";
import { score } from "./score.js";

/**
 * Runs qualification on all 'discovered' opportunities.
 * Gathers signals, scores, and updates status to 'qualified' or 'disqualified'.
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function runQualification() {
  try {
    const supabase = getSupabase();
    const { data: opportunities, error: fetchErr } = await supabase
      .from("opportunities")
      .select("*")
      .eq("status", "discovered");

    if (fetchErr) return { data: null, error: { message: fetchErr.message, code: "FETCH_ERROR" } };
    if (!opportunities?.length) return { data: { qualified: 0, disqualified: 0 }, error: null };

    let qualified = 0;
    let disqualified = 0;

    for (const opp of opportunities) {
      const { data: signals } = await gatherSignals(opp);
      const { data: result } = score(signals, opp);

      const update = {
        signals,
        opportunity_score: result.score,
        opportunity_type: result.opportunity_type,
        score_reasons: result.reasons,
        qualified: result.qualified,
        status: result.disqualify_reason ? "disqualified" : result.qualified ? "qualified" : "discovered",
        disqualify_reason: result.disqualify_reason,
      };

      await supabase.from("opportunities").update(update).eq("id", opp.id);

      if (result.qualified) qualified++;
      if (result.disqualify_reason) disqualified++;
    }

    return { data: { qualified, disqualified, total: opportunities.length }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "QUALIFICATION_ERROR" } };
  }
}
