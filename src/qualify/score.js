/**
 * Scoring rules for qualification.
 * Returns score (0-100), qualified flag, opportunity_type, and reasons.
 */

const DISQUALIFY_REASONS = ["unreachable", "inactive_license", "closed", "existing_client", "unsubscribed"];

/**
 * Computes opportunity score from signals.
 * @param {object} signals - Output from gatherSignals()
 * @param {object} opportunity - The opportunity record
 * @returns {{ data: { score: number, qualified: boolean, opportunity_type: string|null, reasons: string[], disqualify_reason: string|null }, error: null }}
 */
export function score(signals, opportunity) {
  // Disqualification checks
  if (opportunity.outreach_status === "unsubscribed") {
    return disqualified("unsubscribed");
  }
  if (opportunity.license_status === "expired" || opportunity.license_status === "suspended") {
    return disqualified("inactive_license");
  }

  let points = 0;
  const reasons = [];

  // Strong business, weak website (+30)
  if (signals.google_review_count > 50 && (!signals.has_website || !signals.has_mobile || !signals.has_https)) {
    points += 30;
    reasons.push("strong_business_weak_website");
  }

  // No website at all (+20)
  if (!signals.has_website) {
    points += 20;
    reasons.push("no_website");
  }

  // Website outdated (+15)
  if (signals.has_website && signals.domain_age_years > 5 && !signals.has_mobile) {
    points += 15;
    reasons.push("outdated_website");
  }

  // High review count (+15)
  if (signals.google_review_count > 100) {
    points += 15;
    reasons.push("high_reviews");
  }

  // Active business signals (+10)
  if (signals.social_active) {
    points += 10;
    reasons.push("active_business");
  }

  // No booking/scheduling (+5)
  if (!signals.has_booking) {
    points += 5;
    reasons.push("no_booking");
  }

  // No contact form (+5)
  if (!signals.has_contact_form) {
    points += 5;
    reasons.push("no_contact_form");
  }

  const finalScore = Math.min(points, 100);
  const qualified = finalScore >= 60;
  const opportunity_type = qualified ? determineType(signals) : null;

  return {
    data: { score: finalScore, qualified, opportunity_type, reasons, disqualify_reason: null },
    error: null,
  };
}

function determineType(signals) {
  if (!signals.has_website) return "full_rebuild";
  if (!signals.has_mobile && !signals.has_https) return "website";
  if (!signals.has_booking) return "automation";
  return "seo";
}

function disqualified(reason) {
  return {
    data: { score: 0, qualified: false, opportunity_type: null, reasons: [], disqualify_reason: reason },
    error: null,
  };
}
