# Marketing Metrics Dashboard

Next.js 14 + Supabase (Postgres) dashboard. **MVP: Traffic & Engagement**
(Google Analytics 4 + Google Search Console). Leads/MQLs and e-comm (Wix)
plug into the same normalized schema later.

## Architecture

```
GA4 Data API ─┐   Supabase Edge Functions        Postgres            Next.js
GSC API ──────┤─▶ ingest-ga4 / ingest-gsc ─────▶ metric_values ────▶ server components
              │   (pg_cron daily + manual)       + metric_wow view    → KPI cards / charts
```

- Every source normalizes into one table: `metric_values(metric_key, segment, period_start, value, ...)`.
- `metric_definitions` is the config-driven KPI catalog (drives the cards + a future "View Trend" toggle).
- `metric_wow` view computes week-over-week % change so the frontend never does math.

---

## Setup

### 1. Install & run locally
```bash
npm install
cp .env.example .env.local     # fill in Supabase URL + keys
npm run dev                    # http://localhost:3000
```

### 2. Create the Supabase schema
In the Supabase dashboard → **SQL Editor**, run `supabase/migrations/0001_init.sql`.
(Or with the CLI: `supabase db push`.)

### 3. Google Cloud — service account (one time)
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Enable APIs**: enable **Google Analytics Data API** and **Google Search Console API**.
3. **IAM & Admin → Service Accounts → Create**. Name it e.g. `dashboard`. No roles needed.
4. Open the account → **Keys → Add key → JSON**. A file downloads — keep it safe.
5. Grant it read access to your data:
   - **GA4**: Admin → Property Access Management → add the service-account email (`...@...iam.gserviceaccount.com`) as **Viewer**.
   - **Search Console**: Settings → Users and permissions → add the same email as **Full** (or Restricted) user.

### 4. Set Edge Function secrets
From the downloaded JSON you need `client_email` and `private_key`.
```bash
supabase secrets set \
  GA4_PROPERTY_ID=123456789 \
  GSC_SITE_URL="sc-domain:yourdomain.com" \
  GOOGLE_SA_EMAIL="dashboard@your-project.iam.gserviceaccount.com" \
  GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
> `GA4_PROPERTY_ID` = the numeric ID (Admin → Property Settings).
> `GSC_SITE_URL` = `sc-domain:example.com` for a domain property, or the full
> `https://www.example.com/` URL for a URL-prefix property.
> Keep the `\n` sequences in the private key literal — the code converts them.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions automatically.

### 5. Deploy & backfill
```bash
supabase functions deploy ingest-ga4
supabase functions deploy ingest-gsc

# backfill ~12 weeks of history
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/ingest-ga4" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -d '{"weeks":12}'
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/ingest-gsc" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -d '{"weeks":12}'
```

### 6. Schedule daily refresh
Fill in `supabase/migrations/0002_schedule.sql.template`, rename to `.sql`, and run it
in the SQL editor. It uses `pg_cron` + `pg_net` to hit the functions each morning.

---

## KPIs in this MVP

| Card | Source | Notes |
|---|---|---|
| Site Traffic | GA4 | weekly sessions, WoW |
| Engaged Sessions | GA4 | |
| Engagement Rate | GA4 | |
| Bounce Rate | GA4 | `100 − engagementRate` (GA4 definition) |
| Traffic Source | GA4 | by default channel group, vertical bar |
| Organic Traffic | GSC | clicks; ~2–3 day data lag |
| Avg Keyword Position | GSC | lower is better |

## Adding the next clusters
1. `insert into metric_definitions ...` with `cluster = 'leads'` or `'ecomm'`.
2. Add an Edge Function (e.g. `ingest-wix`) that upserts into `metric_values`.
   Wix supports **webhooks** — prefer them for orders/form submissions (real-time
   MQL generation) over polling.
3. Render a new cluster section by calling `getScalarKpis('leads')`.

## Data-source reality check
- **GA4, GSC, Wix** = proper APIs → automate fully.
- **SEMrush** = paid API units (separate from a UI seat); use for competitor/keyword view.
- **Microsoft Clarity** = limited export (~3 calls/day, aggregate); friction signals only.
- **Ubersuggest** = no real public API → manual CSV upload only.
