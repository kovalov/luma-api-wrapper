# Luma API Wrapper — Design Spec

**Date:** 2026-03-30
**Purpose:** Lead generation platform that scrapes Luma events, stores them in Postgres, and exposes a REST API for querying events and hosts (with LinkedIn profiles).

---

## Overview

A Node.js + Express API wrapper around Luma's public discovery API. Scrapes all events from 85 cities, 8 categories, and 9 featured calendars on a 6-hour cron schedule. Stores everything in PostgreSQL. Provides lead-gen optimized endpoints for discovering hosts with LinkedIn profiles.

Deployed on Railway (Postgres addon + web service), code hosted on GitHub.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL (Railway managed)
- **HTTP client:** axios
- **Cron:** node-cron
- **DB driver:** pg (raw SQL, no ORM)
- **Deployment:** Railway (auto-deploy from GitHub)

---

## Database Schema

### cities
| Column | Type | Notes |
|--------|------|-------|
| api_id | text PK | `discplace-...` |
| name | text | |
| slug | text | |
| continent | text | |
| timezone | text | |
| latitude | float | |
| longitude | float | |
| event_count | int | From Luma |
| tint_color | text | |
| icon_url | text | |

### categories
| Column | Type | Notes |
|--------|------|-------|
| api_id | text PK | `cat-...` |
| name | text | |
| slug | text | |
| description | text | |
| event_count | int | |
| subscriber_count | int | |
| tint_color | text | |

### calendars
| Column | Type | Notes |
|--------|------|-------|
| api_id | text PK | `cal-...` |
| name | text | |
| slug | text | |
| description_short | text | |
| avatar_url | text | |
| website | text | |
| twitter_handle | text | |
| linkedin_handle | text | |
| instagram_handle | text | |
| luma_plan | text | "free" / "plus" |
| verified_at | timestamptz | |
| tint_color | text | |

### hosts
| Column | Type | Notes |
|--------|------|-------|
| api_id | text PK | `usr-...` |
| name | text | |
| first_name | text | |
| last_name | text | |
| avatar_url | text | |
| username | text | |
| bio_short | text | |
| website | text | |
| linkedin_handle | text | Key for lead gen |
| twitter_handle | text | |
| instagram_handle | text | |
| tiktok_handle | text | |
| youtube_handle | text | |
| timezone | text | |
| is_verified | boolean | |
| last_online_at | timestamptz | |
| created_at | timestamptz | When we first saw them |

### events
| Column | Type | Notes |
|--------|------|-------|
| api_id | text PK | `evt-...` |
| name | text | |
| start_at | timestamptz | |
| end_at | timestamptz | |
| timezone | text | |
| url_slug | text | Full URL = `lu.ma/{slug}` |
| cover_url | text | |
| calendar_api_id | text FK -> calendars | |
| event_type | text | |
| location_type | text | "offline" / "online" |
| visibility | text | |
| city | text | From geo_address_info |
| city_state | text | |
| address | text | When mode=shown |
| full_address | text | |
| country | text | |
| country_code | text | |
| latitude | float | |
| longitude | float | |
| geo_address_mode | text | "shown" / "obfuscated" |
| hide_rsvp | boolean | |
| show_guest_list | boolean | |
| waitlist_enabled | boolean | |
| is_free | boolean | |
| price_cents | int | |
| price_currency | text | |
| is_sold_out | boolean | |
| spots_remaining | int | |
| require_approval | boolean | |
| guest_count | int | |
| score | float | |
| featured_city_api_id | text FK -> cities | |
| scraped_at | timestamptz | When we first stored it |

### event_hosts
| Column | Type |
|--------|------|
| event_api_id | text FK -> events |
| host_api_id | text FK -> hosts |
| PK | (event_api_id, host_api_id) |

### scrape_runs
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| started_at | timestamptz | |
| finished_at | timestamptz | |
| source_type | text | "cities" / "categories" / "calendars" |
| new_events_count | int | |
| total_events_seen | int | |
| status | text | "running" / "completed" / "failed" |
| error | text | |

---

## Scraper Design

### Schedule
Every 6 hours via node-cron (`0 */6 * * *`). On first startup, if the `events` table is empty, runs immediately.

### Scrape Sequence

1. **Bootstrap sync** — `GET /discover/bootstrap-page`. Upsert all cities, categories, calendars.
2. **Cities** — Iterate all 85 cities. For each, paginate `/discover/get-paginated-events`. Insert new events, upsert hosts, link event_hosts. 300ms delay between pages, 200ms between cities.
3. **Categories** — Iterate all 8 category slugs. Same endpoint, same dedup. Most events already exist from city scrape.
4. **Featured calendars** — Iterate all 9 calendars via `/calendar/get-items?period=future`. Same dedup.
5. **Log** — Record scrape run in `scrape_runs`.

### Dedup
- Events: `INSERT ... ON CONFLICT (api_id) DO NOTHING`
- Hosts: `INSERT ... ON CONFLICT (api_id) DO UPDATE` (captures profile changes like new LinkedIn)
- event_hosts: `INSERT ... ON CONFLICT DO NOTHING`

### Error Handling
Individual city/category/calendar failures are logged and skipped. Scrape continues. Status is "failed" only if the entire process crashes.

---

## API Endpoints

### Reference Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cities` | All cities. Optional `?continent=` filter |
| GET | `/api/categories` | All categories |
| GET | `/api/calendars` | All calendars |

### Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events` | Paginated event list |
| GET | `/api/events/new` | Events scraped since a timestamp |
| GET | `/api/events/:id` | Single event with hosts and calendar |

> **Route order:** Register `/api/events/new` before `/api/events/:id` to avoid Express matching "new" as an `:id` param.

**`/api/events` query params:**
- `city` — filter by city name
- `location_type` — "online" / "offline"
- `is_free` — true / false
- `start_after` / `start_before` — date range (ISO timestamps)
- `has_linkedin_hosts` — true: only events with LinkedIn-having hosts
- `page` / `limit` — pagination (default 25, max 100)
- `sort` — `start_at` (default), `scraped_at`, `score`

**`/api/events/new` query params:**
- `since` — ISO timestamp (required). Returns events with `scraped_at > since`
- Same filters as `/api/events`

### Hosts (Lead Gen Core)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hosts` | Paginated host directory |
| GET | `/api/hosts/with-linkedin` | Hosts with LinkedIn handles |
| GET | `/api/hosts/:id` | Single host with their events |

**`/api/hosts` query params:**
- `city` — hosts active in this city
- `has_linkedin` — true / false
- `search` — text search on name
- `page` / `limit` — pagination

**`/api/hosts/with-linkedin` response includes:**
- Host name, LinkedIn URL (`https://linkedin.com{handle}`)
- Event count
- Active cities
- Most recent event

### Scrape Status
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scrape/status` | Latest scrape run |
| GET | `/api/scrape/history` | Last 20 scrape runs |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: "ok" }` |

---

## Project Structure

```
luma-analysis/
├── src/
│   ├── index.js              # Express app, starts cron
│   ├── config.js             # Env vars
│   ├── db/
│   │   ├── connection.js     # pg Pool
│   │   └── schema.sql        # CREATE TABLE IF NOT EXISTS
│   ├── scraper/
│   │   ├── bootstrap.js      # Sync reference data
│   │   ├── events.js         # Scrape events from all sources
│   │   └── scheduler.js      # node-cron orchestration
│   ├── routes/
│   │   ├── events.js         # Event endpoints
│   │   ├── hosts.js          # Host endpoints
│   │   ├── reference.js      # Cities, categories, calendars
│   │   └── scrape.js         # Scrape status
│   └── utils/
│       └── luma-client.js    # Luma API HTTP client with rate limiting
├── package.json
├── .gitignore
├── .env.example
├── Procfile
└── railway.json
```

---

## Deployment

### Railway
- **Postgres** — managed addon, provides `DATABASE_URL`
- **Web service** — Node.js, auto-deploys from GitHub on push
- **Procfile:** `web: node src/index.js`
- **Health check:** `/health`

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | (from Railway) | Postgres connection string |
| PORT | 3000 | HTTP port |
| CRON_SCHEDULE | `0 */6 * * *` | Scrape frequency |

### GitHub
- Init git repo, create GitHub repo via `gh` CLI, push, link to Railway
