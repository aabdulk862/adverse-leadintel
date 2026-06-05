import { getSupabase } from "./supabase.js";

/**
 * Upserts an array of normalized records into the opportunities table.
 * Uses the dedup index (business_name, metro, vertical) for conflict resolution.
 * @param {object[]} records - Normalized records from normalize()
 * @returns {Promise<{ data: { inserted: number, updated: number }, error: object|null }>}
 */
export async function upsertOpportunities(records) {
  try {
    if (!records.length) return { data: { inserted: 0, updated: 0 }, error: null };

    const supabase = getSupabase();
    const rows = records.map((r) => ({
      business_name: r.business_name,
      owner_name: r.owner_name,
      phone: r.phone,
      email: r.email,
      website: r.website,
      address: r.address,
      license_number: r.license_number || null,
      license_status: r.license_status || null,
      specialties: r.specialties,
      source_name: r.source_name,
      source_url: r.source_url,
      vertical: r.vertical,
      metro: r.metro,
      status: "discovered",
    }));

    const { data, error } = await supabase
      .from("opportunities")
      .upsert(rows, { onConflict: "business_name,metro,vertical", ignoreDuplicates: false })
      .select("id");

    if (error) return { data: null, error: { message: error.message, code: "UPSERT_ERROR" } };

    return { data: { inserted: data.length, updated: 0 }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "STORE_ERROR" } };
  }
}
