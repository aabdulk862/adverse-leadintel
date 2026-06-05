import { normalize, dedup } from "../lib/normalize.js";
import { upsertOpportunities } from "../lib/store.js";
import { run as charlotteRestaurants } from "./charlotteRestaurants.js";
import { run as csvImport } from "./csvImport.js";

/** Registry of all active source connectors */
const SOURCES = [
  { name: "charlotteRestaurants", run: charlotteRestaurants },
  { name: "csvImport", run: csvImport },
];

/**
 * Runs all source connectors, normalizes, deduplicates, and stores results.
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function runDiscovery() {
  try {
    const allRecords = [];
    const errors = [];

    for (const source of SOURCES) {
      console.log(`[discover] Running ${source.name}...`);
      const result = await source.run();
      if (result.error) {
        errors.push({ source: source.name, ...result.error });
        continue;
      }

      const normalized = result.data
        .map((r) => normalize(r))
        .filter((r) => r.data)
        .map((r) => r.data);

      allRecords.push(...normalized);
    }

    const unique = dedup(allRecords);
    const storeResult = await upsertOpportunities(unique);

    if (storeResult.error) {
      return { data: null, error: storeResult.error };
    }

    return {
      data: { discovered: unique.length, stored: storeResult.data, errors },
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "DISCOVERY_ERROR" } };
  }
}
