# How to Use This System

This is your lead machine. It finds businesses, figures out which ones need a website, builds a personalized demo for them, and gives you everything you need to send outreach.

---

## Setup (One Time)

### 1. Install

```bash
git clone <your-repo-url> adverse-leadintel
cd adverse-leadintel
npm install
```

### 2. Add your Supabase credentials

Edit `.env.local`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Where to find them: Supabase → Settings → API. The service_role key is the secret one (click reveal). The anon key is the public one.

### 3. Create the database tables

Go to Supabase → SQL Editor. Paste the entire contents of `supabase/migration.sql` and click Run.

### 4. Verify

```bash
npm test
```

All tests should pass. You're ready.

---

## Daily Workflow

This is what you do every time you want to find new leads:

### Step 1: Run the pipeline

```bash
npm run pipeline
```

This does three things automatically:
1. **Discovers** restaurants (stores them in your database)
2. **Qualifies** each one (checks their website, scores them)
3. **Generates demos** for qualified leads (personalized site config)

You'll see output like:
```
Discovery complete: { discovered: 20, stored: { inserted: 20 } }
Qualification complete: { qualified: 13, total: 20 }
Demo generation complete: { generated: 13 }
```

### Step 2: Open Supabase and look at your leads

Go to Supabase → Table Editor → `opportunities`

Filter by:
- `status` = `demo_ready` (these are ready for outreach)
- Sort by `opportunity_score` descending (best leads first)

### Step 3: Pick a lead and read their data

Each lead has:

| Column | What It Tells You |
|--------|-------------------|
| `business_name` | Who they are |
| `phone` | Their phone number |
| `website` | Their current site (or null = they don't have one) |
| `address` | Where they're located |
| `specialties` | What they serve / do |
| `opportunity_score` | How much they need your service (higher = better) |
| `score_reasons` | Exactly WHY they need you |
| `opportunity_type` | What to sell them: `full_rebuild`, `website`, `seo`, or `automation` |
| `demo_config` | A ready-made site config personalized to their business |

### Step 4: Send them a message from Outlook

Use the `score_reasons` to craft your opener. Examples:

**If score_reasons includes "no_website":**
> "Hey, I came across [business_name] on a local directory — looks like you don't have a website yet. I actually mocked up what one could look like for you. Want me to send it over?"

**If score_reasons includes "no_booking":**
> "Hey, I noticed [business_name] doesn't have online reservations set up. I built a quick demo showing how that could work on your site. 2 min to look at it?"

**If score_reasons includes "outdated_website":**
> "Hey, I was looking at [business_name]'s website — it's not showing up great on mobile. I put together a quick modern mockup. Worth a look?"

### Step 5: Track what you sent

After you send an email, update the row in Supabase:
- Set `outreach_status` to `sent`
- Set `last_contacted_at` to today's date

This keeps you from double-contacting anyone.

---

## Understanding Scores

| Score | Meaning |
|-------|---------|
| 30 | No website at all — prime target for a full rebuild |
| 25-29 | Has a website but it's broken or outdated |
| 5-10 | Has a decent website — probably not worth reaching out |

A lead qualifies (gets a demo generated) if their score is **25 or higher**.

### What adds points:

| Signal | Points |
|--------|--------|
| Strong business but weak/no website | +30 |
| No website at all | +20 |
| Website exists but outdated (no mobile) | +15 |
| Lots of reviews (popular business) | +15 |
| Active on social media | +10 |
| No online booking | +5 |
| No contact form | +5 |

---

## The Demo Config

Each qualified lead gets a `demo_config` — this is a JSON object that represents a personalized website layout for their business. It includes:

- Their business name in headlines
- Their specialties as services
- Their contact info
- Section layout (hero, services, gallery, testimonials, CTA)

This is the same format that the WeBuilder renders. When you close a deal, this config becomes their actual website.

---

## Running Individual Stages

You don't have to run the full pipeline every time:

```bash
npm run discover    # Just find new businesses
npm run qualify     # Just score existing unscored leads
npm run demo        # Just generate demos for qualified leads
npm run pipeline    # All three in sequence
```

---

## The Agent Console (UI)

```bash
npm run dev
```

Opens at http://localhost:5173. Passphrase: `adverse2025`

**Dashboard** — See how many leads are at each pipeline stage  
**Chat** — Talk to the AI orchestrator to run pipelines interactively  
**Agents** — View configured agent roles  
**Artifacts** — Browse generated content (emails, proposals)

The UI is mainly for monitoring. Your actual workflow is: terminal → pipeline → Supabase → Outlook.

---

## Adding More Leads

The seed data gives you 20 Charlotte restaurants to start. To add more:

1. Edit `src/sources/charlotteRestaurants.js`
2. Add more entries to the `SEED_DATA` array
3. Run `npm run pipeline` again (it deduplicates, so existing records won't double up)

Later you can swap in a real scraper when you find a directory that allows it.

---

## Adding a New City or Vertical

1. Create a new file in `src/sources/` (e.g. `raleighSalons.js`)
2. Export a `run()` function that returns `{ data: records[], error: null }`
3. Each record needs: `business_name`, `source_name`, `vertical`, `metro` (required) + phone, website, address, specialties (optional)
4. Register it in `src/sources/index.js`
5. Add the vertical to `VERTICAL_TO_SLUG` in `src/lib/packageTemplates.js` if it's new

---

## FAQ

**Q: Do I need to run this every day?**  
A: No. Run it whenever you want new leads. The seed data is static so it'll give you the same 20 until you add more.

**Q: What if I run pipeline twice?**  
A: It deduplicates. Same business won't be inserted twice. Safe to re-run.

**Q: How do I know who I already contacted?**  
A: Check the `outreach_status` column. Update it to `sent` after you email someone.

**Q: What if someone says "don't contact me"?**  
A: Set their `outreach_status` to `unsubscribed`. The system will never qualify them again.

**Q: Can I change what counts as "qualified"?**  
A: Yes. Edit `src/qualify/score.js`. The threshold is on the line `qualified = finalScore >= 25`.
