import axios from "axios";

const TIMEOUT = 8000;

/**
 * Gathers qualification signals for a business by checking its website.
 * @param {{ website: string|null, business_name: string }} opportunity
 * @returns {Promise<{ data: object, error: object|null }>}
 */
export async function gatherSignals(opportunity) {
  const signals = {
    has_website: false,
    has_https: false,
    has_mobile: false,
    has_booking: false,
    has_contact_form: false,
    domain_age_years: null,
    social_active: false,
    google_review_count: 0,
  };

  if (!opportunity.website) {
    return { data: signals, error: null };
  }

  try {
    const url = opportunity.website.startsWith("http")
      ? opportunity.website
      : `https://${opportunity.website}`;

    const res = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdverseBot/1.0)" },
      maxRedirects: 3,
      validateStatus: (s) => s < 500,
    });

    signals.has_website = true;
    signals.has_https = url.startsWith("https");

    const html = (res.data || "").toString().toLowerCase();
    signals.has_mobile = html.includes("viewport") && html.includes("width=device-width");
    signals.has_booking = /book|reserv|schedul|appointm/i.test(html);
    signals.has_contact_form = /<form[\s\S]*?(contact|email|message)/i.test(html);
  } catch (err) {
    // Website unreachable — signals stay at defaults
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      signals.has_website = false;
    }
  }

  return { data: signals, error: null };
}
