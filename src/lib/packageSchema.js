import Ajv from "ajv";

/**
 * JSON Schema for Package_Config objects.
 * Copied from adamsverse/src/schemas/packageSchema.js — keep in sync.
 * Used by demoGen to validate generated configs before writing to Supabase.
 */
export const packageSchema = {
  title: "Adverse WeBuilder Package_Config",
  type: "object",
  required: ["slug", "name", "category", "description", "sections"],
  additionalProperties: false,
  properties: {
    slug: {
      type: "string",
      pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
      minLength: 1,
      maxLength: 128,
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: 256,
    },
    category: {
      type: "string",
      minLength: 1,
      maxLength: 128,
    },
    description: {
      type: "string",
      minLength: 0,
      maxLength: 1024,
    },
    packageType: {
      type: "string",
      enum: ["static", "semi-dynamic", "dynamic"],
      default: "static",
    },
    themeRef: { type: "string" },
    sections: {
      type: "object",
      minProperties: 1,
      additionalProperties: { type: "object" },
    },
    sectionOrder: {
      type: "array",
      items: { type: "string" },
    },
    _themeState: { type: "object" },
    metadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        phone: { type: "string", maxLength: 512 },
        email: { type: "string", maxLength: 512 },
        address: { type: "string", maxLength: 512 },
        hours: { type: "string", maxLength: 512 },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true, useDefaults: true, validateSchema: false });
const validate = ajv.compile(packageSchema);

/**
 * Validates a Package_Config object.
 * @param {object} config
 * @returns {{ valid: boolean, errors?: Array<{ path: string, message: string }> }}
 */
export function validatePackageConfig(config) {
  const valid = validate(config);
  if (valid) return { valid: true };
  return {
    valid: false,
    errors: validate.errors.map((err) => ({
      path: err.instancePath || "/",
      message: err.message || "Unknown error",
    })),
  };
}
