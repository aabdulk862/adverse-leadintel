import { PACKAGE_TEMPLATES, VERTICAL_TO_SLUG } from "../lib/packageTemplates.js";
import { validatePackageConfig } from "../lib/packageSchema.js";

/**
 * Generates a demo Package_Config for a qualified opportunity.
 * Clones the matching template and personalizes with business data.
 * @param {object} opportunity - Qualified opportunity record
 * @returns {{ data: object|null, error: object|null }}
 */
export function buildDemoConfig(opportunity) {
  try {
    const slug = VERTICAL_TO_SLUG[opportunity.vertical];
    if (!slug) {
      return { data: null, error: { message: `No template for vertical: ${opportunity.vertical}`, code: "NO_TEMPLATE" } };
    }

    const template = PACKAGE_TEMPLATES[slug];
    if (!template) {
      return { data: null, error: { message: `Template not found: ${slug}`, code: "NO_TEMPLATE" } };
    }

    const name = opportunity.business_name;
    const config = {
      slug: `demo-${slugify(name)}`,
      name: `${name} — Demo`,
      category: template.category,
      description: `Custom demo website for ${name}`,
      packageType: "static",
      sections: personalize(template.sections, opportunity),
      sectionOrder: Object.keys(template.sections),
      metadata: {
        phone: opportunity.phone || "",
        email: opportunity.email || "",
        address: opportunity.address || "",
      },
    };

    const validation = validatePackageConfig(config);
    if (!validation.valid) {
      return { data: null, error: { message: "Config validation failed", details: validation.errors, code: "VALIDATION_ERROR" } };
    }

    return { data: { config, slug }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "CONFIG_BUILD_ERROR" } };
  }
}

function personalize(sections, opp) {
  const result = {};
  for (const [key, value] of Object.entries(sections)) {
    result[key] = { ...value };
    if (key === "hero") {
      result[key].headline = `Welcome to ${opp.business_name}`;
      result[key].subheadline = opp.specialties?.[0] || `Quality ${opp.vertical} in ${opp.metro}`;
      result[key].ctaText = "Get in Touch";
    }
    if (key === "cta") {
      result[key].heading = "Ready to Get Started?";
      result[key].body = `Contact ${opp.business_name} today.`;
      result[key].buttonText = "Contact Us";
    }
    if (key === "services" && opp.specialties?.length) {
      result[key].heading = "What We Offer";
      result[key].items = opp.specialties.map((s) => ({ name: s, description: "" }));
    }
  }
  return result;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
