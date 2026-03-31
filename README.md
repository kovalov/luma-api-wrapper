# Luma API Wrapper

Scrapes events from [Luma](https://lu.ma) and exposes a REST API for lead generation — find event hosts with LinkedIn profiles across 85 cities worldwide.

## Features

- Scrapes events from all Luma cities, categories, and featured calendars
- Stores events, hosts, and organizers in PostgreSQL
- Incremental scraping — only new events are added on each run
- Full event descriptions fetched and stored (raw ProseMirror JSON + plain text)
- Host directory with LinkedIn URLs, event counts, and active cities
- Paginated, filterable API endpoints
- Cron-based auto-scraping (default: every 6 hours)
- API key authentication

## Quick Start

```bash
# Install
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and API_KEY

# Run
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PORT` | `3000` | HTTP port |
| `CRON_SCHEDULE` | `0 */6 * * *` | Scrape frequency (cron syntax) |
| `API_KEY` | — | API key for authentication (optional for local dev) |

## API Endpoints

All `/api/*` routes require authentication via `x-api-key` header or `?api_key=` query parameter.

### Hosts (Lead Gen)

```
GET /api/hosts/with-linkedin         # Hosts with LinkedIn — event count, cities, latest event
GET /api/hosts/with-linkedin?city=Amsterdam
GET /api/hosts?search=John&has_linkedin=true
GET /api/hosts/:id                   # Host detail with all their events
```

### Events

```
GET /api/events                      # Paginated event list
GET /api/events?city=Amsterdam&is_free=true&has_linkedin_hosts=true
GET /api/events?start_after=2026-04-01&sort=scraped_at
GET /api/events/new?since=2026-03-31T00:00:00Z   # New events since timestamp
GET /api/events/:id                  # Event detail with hosts, calendar, and full description
```

### Reference Data

```
GET /api/cities?continent=europe
GET /api/categories
GET /api/calendars
```

### Scrape Status

```
GET /api/scrape/status               # Latest run + summary counts
GET /api/scrape/history              # Last 20 scrape runs
```

### Health Check

```
GET /health                          # No auth required
```

## Deployment (Railway)

```bash
# Install Railway CLI: https://docs.railway.com/guides/cli
railway login
railway init --name luma-api-wrapper
railway add -d postgres
railway service <your-service-name>
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}' CRON_SCHEDULE='0 */6 * * *' API_KEY='your-key'
railway domain
railway up
```

## Data Stats

After first scrape:

| Metric | Count |
|--------|-------|
| Events | 1,075 |
| Hosts | 1,971 |
| Hosts with LinkedIn | 1,192 (60.5%) |
| Hosts with Twitter | 516 (26.2%) |
| Cities | 78 |
| Calendars | 919 |
