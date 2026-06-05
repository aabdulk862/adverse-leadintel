import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const IMPORT_DIR = "data/imports";

/**
 * Column mapping: Outscraper CSV column name → our record field.
 * Adjust if your export uses different headers.
 */
const COLUMN_MAP = {
  // Outscraper Google Maps columns
  name: "business_name",
  full_address: "address",
  phone: "phone",
  site: "website",
  type: "_category",
  city: "_city",
  state: "_state",
  // Alternative column names (some exports differ)
  business_name: "business_name",
  address: "address",
  website: "website",
  category: "_category",
};

/**
 * Parses a CSV string into an array of objects using the header row.
 * Handles quoted fields with commas inside them.
 */
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || "").trim(); });
    return obj;
  });
}

function parseLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { result.push(current); current = ""; continue; }
    current += char;
  }
  result.push(current);
  return result;
}

/**
 * Imports all CSV files from data/imports/ directory.
 * Each file should be an Outscraper (or similar) export.
 *
 * @param {{ vertical?: string, metro?: string }} options
 * @returns {Promise<{ data: object[], error: object|null }>}
 */
export async function run({ vertical = "restaurant", metro = "charlotte, nc" } = {}) {
  try {
    let files;
    try {
      files = readdirSync(IMPORT_DIR).filter((f) => f.endsWith(".csv"));
    } catch {
      return { data: [], error: null }; // No import directory yet — not an error
    }

    if (files.length === 0) return { data: [], error: null };

    const records = [];

    for (const file of files) {
      const content = readFileSync(join(IMPORT_DIR, file), "utf-8");
      const rows = parseCSV(content);
      const sourceName = `csv-import-${file.replace(".csv", "")}`;

      for (const row of rows) {
        // Map columns
        const mapped = {};
        for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
          if (row[csvCol] && !mapped[field]) {
            mapped[field] = row[csvCol];
          }
        }

        if (!mapped.business_name) continue;

        // Clean website
        let website = mapped.website || null;
        if (website) {
          website = website.replace(/^https?:\/\//, "").replace(/\/$/, "");
          if (website === "null" || website === "N/A" || !website.includes(".")) website = null;
        }

        records.push({
          business_name: mapped.business_name,
          phone: mapped.phone || null,
          address: mapped.address || null,
          website,
          email: null,
          owner_name: null,
          license_number: null,
          license_status: null,
          specialties: mapped._category ? [mapped._category] : [],
          source_name: sourceName,
          source_url: null,
          vertical,
          metro: mapped._city ? `${mapped._city}, ${mapped._state || "nc"}`.toLowerCase() : metro,
        });
      }
    }

    return { data: records, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "CSV_IMPORT_ERROR" } };
  }
}
