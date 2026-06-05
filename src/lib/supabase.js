import { createClient } from "@supabase/supabase-js";

let _client = null;

/**
 * Returns a Supabase client using the service role key (bypasses RLS).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabase() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables."
    );
  }

  _client = createClient(url, key);
  return _client;
}
