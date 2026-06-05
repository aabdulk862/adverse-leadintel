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

/**
 * Browser-side Supabase client (uses VITE_ env vars, respects RLS).
 * Used by UI components.
 */
let _browserClient = null;

export function getSupabaseBrowser() {
  if (_browserClient) return _browserClient;
  const url = import.meta.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || "http://localhost:54321";
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_SERVICE_KEY || "placeholder";
  _browserClient = createClient(url, key);
  return _browserClient;
}

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = getSupabaseBrowser();
