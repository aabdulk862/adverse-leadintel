import { getSupabase } from "../lib/supabase.js";
import { buildDemoConfig } from "./configBuilder.js";

/**
 * Generates demo configs for all 'qualified' opportunities.
 * Updates each with demo_config, demo_package_slug, and sets status to 'demo_ready'.
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function runDemoGeneration() {
  try {
    const supabase = getSupabase();
    const { data: opportunities, error: fetchErr } = await supabase
      .from("opportunities")
      .select("*")
      .eq("status", "qualified");

    if (fetchErr) return { data: null, error: { message: fetchErr.message, code: "FETCH_ERROR" } };
    if (!opportunities?.length) return { data: { generated: 0, failed: 0 }, error: null };

    let generated = 0;
    let failed = 0;

    for (const opp of opportunities) {
      const result = buildDemoConfig(opp);
      if (result.error) {
        failed++;
        continue;
      }

      await supabase
        .from("opportunities")
        .update({
          demo_config: result.data.config,
          demo_package_slug: result.data.slug,
          demo_generated_at: new Date().toISOString(),
          status: "demo_ready",
        })
        .eq("id", opp.id);

      generated++;
    }

    return { data: { generated, failed, total: opportunities.length }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "DEMOGEN_ERROR" } };
  }
}
