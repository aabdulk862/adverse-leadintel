/**
 * JSON Schema for raw records produced by source connectors.
 * Every source must output records matching this shape.
 */
export const RAW_RECORD_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Lead Intelligence Raw Record",
  type: "object",
  required: ["business_name", "source_name", "vertical", "metro"],
  additionalProperties: false,
  properties: {
    business_name: { type: "string", minLength: 1, maxLength: 256 },
    owner_name: { type: ["string", "null"], maxLength: 256 },
    phone: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    address: { type: ["string", "null"], maxLength: 512 },
    license_number: { type: ["string", "null"] },
    license_status: {
      type: ["string", "null"],
      enum: ["active", "expired", "suspended", null],
    },
    specialties: { type: "array", items: { type: "string" }, default: [] },
    source_name: { type: "string", minLength: 1 },
    source_url: { type: ["string", "null"] },
    vertical: { type: "string", minLength: 1 },
    metro: { type: "string", minLength: 1 },
  },
};
