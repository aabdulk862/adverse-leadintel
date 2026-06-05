---
inclusion: auto
---

# Adverse Lead Intelligence — Compliance & Scraping Rules

## Data Collection Rules

1. **Public data only.** Only scrape publicly published directories and listings. Never bypass paywalls, login walls, or CAPTCHAs that block public access.
2. **Respect robots.txt.** Check and honor robots.txt before scraping any domain.
3. **Rate limiting.** Minimum 2-second delay between requests to the same domain. No parallel requests to the same host.
4. **ToS review required.** Every new source must have `tos_reviewed: true` in the `lead_sources` table before activation. Review the site's Terms of Service manually before enabling.
5. **No PII hoarding.** Only store data needed for outreach: business name, contact info, website, specialties. Do not store personal details (SSN, DOB, home addresses of individuals).

## Outreach Compliance (CAN-SPAM)

This repo does NOT send emails — adamsverse handles sending. But the data we produce must support compliance:

- Every opportunity record must have a reachable contact method (email or phone)
- Disqualified/unsubscribed records must never appear in outreach queues
- `outreach_status = 'unsubscribed'` is permanent — never reset

## Data Hygiene

- Disqualified records: purge after 90 days
- Unsubscribed contacts: retain only `email` + `outreach_status` flag, delete all other fields
- Stale records (no update in 180 days): mark for re-discovery or purge

## Source Activation Checklist

Before enabling a new source connector:

1. ☐ Read the site's Terms of Service
2. ☐ Confirm data is publicly accessible (no login required)
3. ☐ Check robots.txt for disallow rules
4. ☐ Set `tos_reviewed: true` in `lead_sources` table
5. ☐ Configure rate limiting appropriate to the source
6. ☐ Test scraper with < 10 records before full run
