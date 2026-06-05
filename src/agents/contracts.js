import Ajv from "ajv";
import { supabaseAdmin } from "../orchestrator/db.js";

const ajv = new Ajv({ allErrors: true });

// ---------------------------------------------------------------------------
// Subjective qualifiers list
// ---------------------------------------------------------------------------

const SUBJECTIVE_QUALIFIERS = [
  "amazing",
  "terrible",
  "best",
  "worst",
  "incredible",
  "awful",
  "fantastic",
  "horrible",
  "outstanding",
  "dreadful",
  "superb",
  "atrocious",
  "magnificent",
  "disgusting",
  "brilliant",
  "pathetic",
  "exceptional",
  "abysmal",
  "phenomenal",
  "appalling",
  "marvelous",
  "horrendous",
  "spectacular",
  "catastrophic",
  "wonderful",
  "miserable",
  "perfect",
  "useless",
  "excellent",
  "lousy",
];

/**
 * Builds a regex that matches any of the subjective qualifiers as whole words.
 * The regex is case-insensitive.
 */
const qualifierPattern = new RegExp(
  `\\b(${SUBJECTIVE_QUALIFIERS.join("|")})\\b`,
  "gi",
);

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/**
 * Validates data against a JSON Schema using ajv.
 * @param {object} data - The data to validate
 * @param {object} schema - A JSON Schema object
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateAgainstSchema(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true };
  }

  const errors = validate.errors.map((err) => {
    const path = err.instancePath || "/";
    return `${path} ${err.message}`;
  });

  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Inter-agent transfer validation
// ---------------------------------------------------------------------------

/**
 * Validates data against both the source agent role's output_schema and the
 * target agent role's input_schema.
 *
 * @param {object} data - The data being transferred
 * @param {object} sourceRole - Source agent role (must have output_schema)
 * @param {object} targetRole - Target agent role (must have input_schema)
 * @returns {{ valid: boolean, sourceErrors?: string[], targetErrors?: string[] }}
 */
export function validateTransfer(data, sourceRole, targetRole) {
  const sourceResult = validateAgainstSchema(data, sourceRole.output_schema);
  const targetResult = validateAgainstSchema(data, targetRole.input_schema);

  if (sourceResult.valid && targetResult.valid) {
    return { valid: true };
  }

  const result = { valid: false };
  if (!sourceResult.valid) {
    result.sourceErrors = sourceResult.errors;
  }
  if (!targetResult.valid) {
    result.targetErrors = targetResult.errors;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Data transformation
// ---------------------------------------------------------------------------

/**
 * Attempts to reshape data to match a target JSON Schema.
 *
 * Strategy:
 * 1. Pick only the keys that the target schema expects (from `properties`).
 * 2. Coerce primitive types where possible (string ↔ number, etc.).
 * 3. Apply defaults from the schema when a required key is missing.
 *
 * @param {object} data - The source data object
 * @param {object} targetSchema - The target JSON Schema
 * @returns {object} The transformed data
 */
export function transformData(data, targetSchema) {
  if (!targetSchema || !targetSchema.properties) {
    return data;
  }

  const result = {};
  const properties = targetSchema.properties;

  for (const [key, propSchema] of Object.entries(properties)) {
    if (key in data) {
      result[key] = coerceValue(data[key], propSchema);
    } else if (propSchema.default !== undefined) {
      result[key] = propSchema.default;
    } else if (propSchema.type === "string") {
      result[key] = "";
    } else if (propSchema.type === "number" || propSchema.type === "integer") {
      result[key] = 0;
    } else if (propSchema.type === "boolean") {
      result[key] = false;
    } else if (propSchema.type === "array") {
      result[key] = [];
    } else if (propSchema.type === "object") {
      result[key] = {};
    }
  }

  return result;
}

/**
 * Coerces a value to match the expected JSON Schema type.
 * @param {*} value
 * @param {object} propSchema
 * @returns {*}
 */
function coerceValue(value, propSchema) {
  if (!propSchema || !propSchema.type) {
    return value;
  }

  const targetType = propSchema.type;

  if (targetType === "string") {
    return typeof value === "string" ? value : String(value);
  }
  if (targetType === "number" || targetType === "integer") {
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (targetType === "boolean") {
    if (typeof value === "boolean") return value;
    return Boolean(value);
  }
  if (targetType === "array") {
    return Array.isArray(value) ? value : [value];
  }
  if (targetType === "object") {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    return {};
  }

  return value;
}

// ---------------------------------------------------------------------------
// Subjective qualifier stripping
// ---------------------------------------------------------------------------

/**
 * Recursively removes opinion-laden qualifiers from string fields in a
 * structured data object while preserving the object structure.
 *
 * @param {*} data - The data to strip qualifiers from
 * @returns {*} A new object with qualifiers removed from string fields
 */
export function stripSubjectiveQualifiers(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return data
      .replace(qualifierPattern, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripSubjectiveQualifiers(item));
  }

  if (typeof data === "object") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = stripSubjectiveQualifiers(value);
    }
    return result;
  }

  // Primitives (number, boolean) pass through unchanged
  return data;
}

// ---------------------------------------------------------------------------
// Transfer logging
// ---------------------------------------------------------------------------

/**
 * Creates a simple hash of a string using a basic djb2-style algorithm.
 * @param {string} str
 * @returns {string} Hex hash string
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Logs an inter-agent data transfer to the transfer_logs table.
 *
 * @param {string} sourceRole - Source agent role ID (UUID)
 * @param {string} targetRole - Target agent role ID (UUID)
 * @param {object} data - The data being transferred
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function logTransfer(sourceRole, targetRole, data) {
  const dataHash = simpleHash(JSON.stringify(data));

  try {
    const client = supabaseAdmin();
    if (!client) {
      // Supabase not configured — skip logging
      return {
        data: {
          source_role_id: sourceRole,
          target_role_id: targetRole,
          data_hash: dataHash,
        },
        error: null,
      };
    }

    const { data: logEntry, error } = await client
      .from("transfer_logs")
      .insert({
        source_role_id: sourceRole,
        target_role_id: targetRole,
        data_hash: dataHash,
      })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
    return { data: logEntry, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err.message, code: "UNEXPECTED_ERROR" },
    };
  }
}
