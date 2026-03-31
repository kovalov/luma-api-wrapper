# Luma API Wrapper

## Project Overview

Node.js/Express API wrapper around Luma's public discovery API for lead generation. Scrapes events from 85 cities, 8 categories, and 9 featured calendars on a cron schedule. Stores everything in PostgreSQL. Exposes REST endpoints optimized for discovering event hosts with LinkedIn profiles.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** PostgreSQL (Railway managed, raw SQL via `pg`)
- **HTTP client:** axios
- **Cron:** node-cron
- **Deployment:** Railway (auto-deploy), GitHub

## Project Structure

```
src/
  index.js              — Express app, mounts routes, starts cron, health check, API key auth
  config.js             — Env vars (DATABASE_URL, PORT, CRON_SCHEDULE, API_KEY, LUMA_BASE_URL)
  db/
    connection.js       — pg Pool singleton (SSL for Railway)
    schema.sql          — DDL for 7 tables + indexes
    init.js             — Reads and executes schema.sql on startup
  scraper/
    bootstrap.js        — Syncs cities/categories/calendars from /discover/bootstrap-page
    events.js           — Scrapes events from all sources, upserts hosts, links event_hosts
    scheduler.js        — node-cron orchestration, initial-run detection
  routes/
    reference.js        — GET /api/cities, /api/categories, /api/calendars
    events.js           — GET /api/events, /api/events/new, /api/events/:id
    hosts.js            — GET /api/hosts, /api/hosts/with-linkedin, /api/hosts/:id
    scrape.js           — GET /api/scrape/status, /api/scrape/history
  utils/
    luma-client.js      — axios wrapper with cursor pagination and rate limiting
```

## Database

7 tables: `cities`, `categories`, `calendars`, `hosts`, `events`, `event_hosts`, `scrape_runs`. Schema auto-created on startup via `CREATE TABLE IF NOT EXISTS`. No ORM, no migration tool.

## Key Design Decisions

- Events deduped by `api_id` using `ON CONFLICT DO NOTHING`
- Hosts use `ON CONFLICT DO UPDATE` to capture profile changes (new LinkedIn, etc.)
- Event-host linking runs unconditionally (not just for new events) to catch co-hosts from secondary sources
- `/health` is unauthenticated (Railway health checks); all `/api/*` routes require API key
- Express 5 handles async error propagation — no try/catch in route handlers
- Scraper runs sequentially (cities -> categories -> calendars) with 200-300ms delays

## Environment Variables

- `DATABASE_URL` — Postgres connection string (from Railway)
- `PORT` — defaults to 3000
- `CRON_SCHEDULE` — defaults to `0 */6 * * *`
- `API_KEY` — required for `/api/*` routes (via `x-api-key` header or `?api_key=` param)

## Luma API Reference

See `luma-api.md` for the full reverse-engineered API documentation.

## Common Tasks

- **Deploy:** `railway up` or push to GitHub main
- **Check logs:** `railway logs`
- **Query DB:** Use public Postgres URL from `railway variables --service Postgres`
- **Change scrape frequency:** Update `CRON_SCHEDULE` env var on Railway
