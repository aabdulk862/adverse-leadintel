# Lead Intelligence System — Specification v2

## 1. What This Is

An **opportunity factory** that turns publicly available business data into qualified, demo-ready prospects for Adverse's existing services.

This is NOT a lead database. This is NOT an Apollo competitor. This is NOT a standalone product.

This is the **Adverse Growth Engine** — a feeder system that discovers businesses, qualifies them, generates personalized demos using the existing WeBuilder, and queues them for outreach.

```
Source → Opportunity → Demo → Outreach → Close
```

---

## 2. Architecture Principle: Feeder, Not Orchestrator

The Lead Intelligence System is **decoupled** from the orchestrator. It runs independently as an ongoing discovery process and pushes qualified opportunities into a queue. The orchestrator (in the adamsverse repo) pulls from that queue on-demand.

```
┌──────────────────────────────────┐
│    LEAD INTELLIGENCE LAYER       │     (this repo, Node.js service)
│                                  │
│  Sources → Qualify → Demo → Queue│
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│       OPPORTUNITY QUEUE          │     (Supabase — shared)
│  status: 'ready_for_outreach'    │
└──────────────┬───────────────────┘
               │
               ▼  (on-demand, triggered from adamsverse)
┌──────────────────────────────────┐
│     ADAMSVERSE ORCHESTRATOR      │
│  Outreach Pipeline               │
│  Research → Planner → Builder    │
│  → n8n Send                      │
└──────────────────────────────────┘
```

**Repo boundary:**
- `adverse-leadintel` — Discovery, qualification, scoring, demo config generation. Runs server-side (VPS/Railway/cron).
- `adamsverse` — Outreach approval UI, demo rendering, orchestrator, WeBuilder. Runs client-side (Netlify SPA).
- **Shared:** Supabase `opportunities` table (both repos read/write).

---

## 3. Integration with adamsverse

| adamsverse System | How LIS Connects |
|-------------------|-----------------|
| **WeBuilder** (packages.js) | LIS clones package configs as templates for demo generation |
| **Package Library** (12 packages) | Vertical → slug mapping determines which template to use |
| **Orchestrator outreach pipeline** | adamsverse reads `ready_for_outreach` opportunities, generates email content |
| **n8n Connector** | adamsverse sends approved outreach via n8n |
| **Supabase** | Shared persistence layer — this repo writes, adamsverse reads |

**Existing packages available for demo generation:**

| Slug | Category | Vertical Match |
|------|----------|----------------|
| restaurant | Food & Hospitality | Restaurants, bars, catering |
| cafe-coffee-shop | Food & Hospitality | Cafes, bakeries |
| hotel-bnb | Food & Hospitality | Hotels, B&Bs, vacation rentals |
| lash-studio | Beauty & Wellness | Lash techs, estheticians |
| hair-salon | Beauty & Wellness | Salons, barbers |
| auto-repair | Home Services | Auto shops, mechanics |
| cleaning-service | Home Services | Cleaning companies, janitorial |
| landscaping | Home Services | Landscapers, lawn care |
| gym-trainer | Professional | Personal trainers, gyms |
| real-estate-agent | Professional | Realtors, brokers |
| photographer | Professional | Photographers, videographers |
| attorney | Professional | Law firms, solo attorneys |

---

## 4. Data Model

### 4.1 `opportunities` Table

```sql
CREATE TABLE opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_name     TEXT NOT NULL,
  source_url      TEXT,
  vertical        TEXT NOT NULL,
  metro           TEXT NOT NULL,

  -- Business identity
  business_name   TEXT NOT NULL,
  owner_name      TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  address         TEXT,
  license_number  TEXT,
  license_status  TEXT,
  specialties     JSONB DEFAULT '[]',

  -- Qualification signals
  signals         JSONB NOT NULL DEFAULT '{}',

  -- Qualification
  opportunity_score   INTEGER,
  opportunity_type    TEXT,
  score_reasons       JSONB DEFAULT '[]',
  qualified           BOOLEAN DEFAULT false,

  -- Demo
  demo_package_slug   TEXT,
  demo_config         JSONB,
  demo_generated_at   TIMESTAMPTZ,

  -- Outreach (written by adamsverse orchestrator)
  outreach_status     TEXT DEFAULT 'pending',
  outreach_content    JSONB,
  last_contacted_at   TIMESTAMPTZ,

  -- Pipeline state
  status              TEXT DEFAULT 'discovered',
  disqualify_reason   TEXT,

  -- Meta
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_opp_vertical_metro ON opportunities(vertical, metro);
CREATE INDEX idx_opp_status ON opportunities(status);
CREATE INDEX idx_opp_score ON opportunities(opportunity_score DESC) WHERE qualified = true;
CREATE UNIQUE INDEX idx_opp_dedup ON opportunities(business_name, metro, vertical);
```

### 4.2 `lead_sources` Table

```sql
CREATE TABLE lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  vertical      TEXT NOT NULL,
  metro         TEXT,
  base_url      TEXT NOT NULL,
  scraper_key   TEXT NOT NULL,
  last_run_at   TIMESTAMPTZ,
  record_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active',
  tos_reviewed  BOOLEAN DEFAULT false,
  config        JSONB DEFAULT '{}'
);
```

---

## 5. Module Specifications

### 5.1 Source Connectors

**Location:** `src/sources/`

Each connector is a single file. No abstraction. No plugin system.

**Interface — every connector exports one function:**

```javascript
/**
 * @returns {Promise<{ data: RawRecord[], error: object|null }>}
 */
export async function run() { }
```

**RawRecord shape:**
```javascript
{
  business_name: "string (required)",
  owner_name: "string|null",
  phone: "string|null",
  email: "string|null",
  website: "string|null",
  address: "string|null",
  license_number: "string|null",
  license_status: "string|null",
  specialties: ["string"],
  source_name: "string (required)",
  source_url: "string|null",
  vertical: "string (required)",
  metro: "string (required)"
}
```

---

### 5.2 Qualification Engine

**Location:** `src/qualify/`

Determines **who is worth contacting**, not just who exists.

**Scoring Rules:**

| Signal | Points | Logic |
|--------|--------|-------|
| Strong business, weak website | +30 | `google_review_count > 50 && (!has_website \|\| !has_mobile \|\| !has_https)` |
| No website at all | +20 | `!has_website` |
| Website exists but outdated | +15 | `has_website && domain_age_years > 5 && !has_mobile` |
| High review count | +15 | `google_review_count > 100` |
| Active business signals | +10 | `social_active \|\| years_operating > 3` |
| No booking/scheduling | +5 | `!has_booking` |
| No contact form | +5 | `!has_contact_form` |

**Opportunity Types:** `full_rebuild`, `website`, `seo`, `automation`

**Disqualification:** unreachable, inactive_license, closed, existing_client, unsubscribed

`qualified = true` when `score >= 60`.

---

### 5.3 Demo Generation

**Location:** `src/demoGen/`

1. Match vertical → existing package slug
2. Clone package section structure
3. Personalize: headline, services, contact info, CTA
4. Validate against package schema
5. Store as `demo_config` JSON (rendered by adamsverse WeBuilder)

---

### 5.4 Outreach Queue

**Location:** `src/outreach/`

Marks qualified + demo-ready opportunities as `ready_for_outreach`. The adamsverse orchestrator picks them up from there.

---

## 6. Pipeline Flow

```
BATCH (this repo, scheduled):
  1. Source connector runs → status: 'discovered'
  2. Qualification → status: 'qualified' or 'disqualified'
  3. Demo generation → status: 'demo_ready'
  4. Queue → status: 'ready_for_outreach'

ON-DEMAND (adamsverse, admin approval):
  5. Orchestrator generates outreach content
  6. n8n sends → status: 'outreach_sent'
  7. Track: open / reply / convert
```

---

## 7. Compliance

| Rule | How |
|------|-----|
| CAN-SPAM | Unsubscribe link + physical address + honest subject |
| Unsubscribe | Never contact again, checked before every send |
| Public data only | No paywall/login bypass |
| Rate limiting | 2s minimum between requests, respect robots.txt |
| ToS | Each source requires `tos_reviewed: true` |
| No auto-send | V1 requires manual approval |
| Data hygiene | Disqualified records purged after 90 days |

---

## 8. V1 Scope

| Decision | V1 Choice |
|----------|-----------|
| Vertical | Restaurant |
| Metro | Charlotte, NC |
| Source | Yelp/Google Business listings |
| Qualification | Full scoring rubric |
| Demo | Clone `restaurant` package, personalize |
| Outreach | Email only, manual approval |

---

## 9. Implementation Order

| Phase | What | Ships Independently? |
|-------|------|---------------------|
| 1 | Supabase migration | ✅ |
| 2 | `normalize.js` + `store.js` + schemas | ✅ |
| 3 | `charlotteRestaurants.js` source connector | ✅ |
| 4 | `qualify/signals.js` — website checks | ✅ |
| 5 | `qualify/score.js` — scoring + types | ✅ |
| 6 | `demoGen/configBuilder.js` — generate configs | ✅ |
| 7 | `outreach/index.js` — queue management | ✅ |
| 8 | Tests | ✅ |

---

## 10. Success Metrics (V1, 60 days)

| Metric | Target |
|--------|--------|
| Restaurants discovered | 500+ |
| Qualified (score >= 60) | 30-40% |
| Demos generated | 100% of qualified |
| Outreach sent | First 25 |
| Reply rate | 5%+ |
| Package sold | 1 (proves the loop) |
