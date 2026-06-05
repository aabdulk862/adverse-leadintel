import Ajv from "ajv";
import { RAW_RECORD_SCHEMA } from "./schemas/rawRecord.js";

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validate = ajv.compile(RAW_RECORD_SCHEMA);

/**
 * Generates a deterministic dedup key from business identity fields.
 * @param {{ business_name: string, metro: string, vertical: string }} record
 * @returns {string}
 */
export function dedupKey(record) {
  const name = (record.business_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const metro = (record.metro || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const vertical = (record.vertical || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${name}::${metro}::${vertical}`;
}

/**
 * Normalizes a raw record: trims strings, lowercases vertical/metro, validates schema.
 * @param {object} raw
 * @returns {{ data: object|null, error: object|null }}
 */
export function normalize(raw) {
  try {
    const record = {
      ...raw,
      business_name: (raw.business_name || "").trim(),
      vertical: (raw.vertical || "").toLowerCase().trim(),
      metro: (raw.metro || "").toLowerCase().trim(),
      phone: raw.phone?.trim() || null,
      email: raw.email?.trim().toLowerCase() || null,
      website: raw.website?.trim().toLowerCase() || null,
      address: raw.address?.trim() || null,
      owner_name: raw.owner_name?.trim() || null,
      source_name: (raw.source_name || "").trim(),
      source_url: raw.source_url?.trim() || null,
      specialties: Array.isArray(raw.specialties) ? raw.specialties.map((s) => s.trim()) : [],
    };

    const valid = validate(record);
    if (!valid) {
      return { data: null, error: { message: "Validation failed", details: validate.errors } };
    }

    return { data: record, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "NORMALIZE_ERROR" } };
  }
}

/**
 * Deduplicates an array of normalized records by dedup key.
 * @param {object[]} records
 * @returns {object[]}
 */
export function dedup(records) {
  const seen = new Map();
  for (const record of records) {
    const key = dedupKey(record);
    if (!seen.has(key)) seen.set(key, record);
  }
  return [...seen.values()];
}
