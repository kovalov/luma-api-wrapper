# Luma API Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js/Express API that scrapes Luma events on a cron schedule, stores them in Postgres, and exposes lead-gen optimized endpoints for discovering hosts with LinkedIn profiles.

**Architecture:** Single Express process runs both the HTTP API and a node-cron scheduler. The scraper fetches events from all 85 cities, 8 categories, and 9 featured calendars every 6 hours. Events and hosts are deduped by `api_id` on insert. The API exposes paginated endpoints with filters optimized for lead generation.

**Tech Stack:** Node.js, Express, pg (raw SQL), axios, node-cron, PostgreSQL (Railway managed)

**Spec:** `docs/superpowers/specs/2026-03-30-luma-api-wrapper-design.md`
**API Reference:** `luma-api.md`

---

## File Structure

```
src/
  index.js              — Express app, mounts routes, starts cron, health check
  config.js             — Reads env vars with defaults
  db/
    connection.js       — pg Pool singleton
    schema.sql          — All CREATE TABLE + indexes
    init.js             — Reads schema.sql and executes it
  scraper/
    bootstrap.js        — Fetches /discover/bootstrap-page, upserts cities/categories/calendars
    events.js           — Scrapes events from cities, categories, calendars; inserts events/hosts/event_hosts
    scheduler.js        — node-cron job, orchestrates full scrape run, logs to scrape_runs
  routes/
    reference.js        — GET /api/cities, /api/categories, /api/calendars
    events.js           — GET /api/events, /api/events/new, /api/events/:id
    hosts.js            — GET /api/hosts, /api/hosts/with-linkedin, /api/hosts/:id
    scrape.js           — GET /api/scrape/status, /api/scrape/history
  utils/
    luma-client.js      — axios instance + paginate() helper with rate limiting
package.json
.gitignore
.env.example
Procfile
railway.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `Procfile`
- Create: `railway.json`
- Create: `src/config.js`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/kovalov/Documents/Claude/luma-analysis
npm init -y
```

Then update `package.json`:

```json
{
  "name": "luma-api-wrapper",
  "version": "1.0.0",
  "description": "Luma events scraper and lead-gen API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "keywords": [],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express pg axios node-cron
```

- [ ] **Step 3: Create .gitignore**

```gitignore
node_modules/
.env
*.log
all_events.json
events_with_guests.json
.playwright-mcp/
```

- [ ] **Step 4: Create .env.example**

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/luma
PORT=3000
CRON_SCHEDULE=0 */6 * * *
```

- [ ] **Step 5: Create Procfile**

```
web: node src/index.js
```

- [ ] **Step 6: Create railway.json**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 7: Create src/config.js**

```js
module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: parseInt(process.env.PORT, 10) || 3000,
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 */6 * * *',
  LUMA_BASE_URL: 'https://api2.luma.com',
};
```

- [ ] **Step 8: Commit**

```bash
git init
git add package.json package-lock.json .gitignore .env.example Procfile railway.json src/config.js
git commit -m "chore: project scaffolding with Express, pg, axios, node-cron"
```

---

### Task 2: Database Schema & Connection

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/connection.js`
- Create: `src/db/init.js`

- [ ] **Step 1: Create src/db/connection.js**

```js
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_URL && config.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = { pool };
```

- [ ] **Step 2: Create src/db/schema.sql**

```sql
CREATE TABLE IF NOT EXISTS cities (
  api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  continent TEXT,
  timezone TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  event_count INTEGER DEFAULT 0,
  tint_color TEXT,
  icon_url TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  event_count INTEGER DEFAULT 0,
  subscriber_count INTEGER DEFAULT 0,
  tint_color TEXT
);

CREATE TABLE IF NOT EXISTS calendars (
  api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description_short TEXT,
  avatar_url TEXT,
  website TEXT,
  twitter_handle TEXT,
  linkedin_handle TEXT,
  instagram_handle TEXT,
  luma_plan TEXT,
  verified_at TIMESTAMPTZ,
  tint_color TEXT
);

CREATE TABLE IF NOT EXISTS hosts (
  api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  username TEXT,
  bio_short TEXT,
  website TEXT,
  linkedin_handle TEXT,
  twitter_handle TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  youtube_handle TEXT,
  timezone TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  last_online_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  timezone TEXT,
  url_slug TEXT,
  cover_url TEXT,
  calendar_api_id TEXT,
  event_type TEXT,
  location_type TEXT,
  visibility TEXT,
  city TEXT,
  city_state TEXT,
  address TEXT,
  full_address TEXT,
  country TEXT,
  country_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geo_address_mode TEXT,
  hide_rsvp BOOLEAN DEFAULT FALSE,
  show_guest_list BOOLEAN DEFAULT FALSE,
  waitlist_enabled BOOLEAN DEFAULT FALSE,
  is_free BOOLEAN DEFAULT TRUE,
  price_cents INTEGER,
  price_currency TEXT,
  is_sold_out BOOLEAN DEFAULT FALSE,
  spots_remaining INTEGER,
  require_approval BOOLEAN DEFAULT FALSE,
  guest_count INTEGER DEFAULT 0,
  score DOUBLE PRECISION,
  featured_city_api_id TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_hosts (
  event_api_id TEXT REFERENCES events(api_id) ON DELETE CASCADE,
  host_api_id TEXT REFERENCES hosts(api_id) ON DELETE CASCADE,
  PRIMARY KEY (event_api_id, host_api_id)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  source_type TEXT,
  new_events_count INTEGER DEFAULT 0,
  total_events_seen INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error TEXT
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON events(location_type);
CREATE INDEX IF NOT EXISTS idx_events_is_free ON events(is_free);
CREATE INDEX IF NOT EXISTS idx_events_calendar_api_id ON events(calendar_api_id);
CREATE INDEX IF NOT EXISTS idx_hosts_linkedin ON hosts(linkedin_handle) WHERE linkedin_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hosts_name ON hosts(name);
CREATE INDEX IF NOT EXISTS idx_event_hosts_host ON event_hosts(host_api_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs(started_at DESC);
```

- [ ] **Step 3: Create src/db/init.js**

```js
const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Database schema initialized');
}

module.exports = { initDatabase };
```

- [ ] **Step 4: Commit**

```bash
git add src/db/
git commit -m "feat: database schema with tables for events, hosts, cities, categories, calendars"
```

---

### Task 3: Luma API Client

**Files:**
- Create: `src/utils/luma-client.js`

- [ ] **Step 1: Create src/utils/luma-client.js**

```js
const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.LUMA_BASE_URL,
  timeout: 15000,
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBootstrap() {
  const { data } = await client.get('/discover/bootstrap-page');
  return data;
}

async function paginateEvents(params, pageDelay = 300) {
  const allEntries = [];
  let cursor = null;

  while (true) {
    const queryParams = { ...params, pagination_limit: 25 };
    if (cursor) {
      queryParams.pagination_cursor = cursor;
    }

    const { data } = await client.get('/discover/get-paginated-events', {
      params: queryParams,
    });

    allEntries.push(...(data.entries || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await delay(pageDelay);
  }

  return allEntries;
}

async function paginateCalendarEvents(calendarApiId, pageDelay = 300) {
  const allEntries = [];
  let cursor = null;

  while (true) {
    const params = {
      calendar_api_id: calendarApiId,
      pagination_limit: 20,
      period: 'future',
    };
    if (cursor) {
      params.pagination_cursor = cursor;
    }

    const { data } = await client.get('/calendar/get-items', { params });

    allEntries.push(...(data.entries || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await delay(pageDelay);
  }

  return allEntries;
}

module.exports = { fetchBootstrap, paginateEvents, paginateCalendarEvents, delay };
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/luma-client.js
git commit -m "feat: Luma API client with pagination and rate limiting"
```

---

### Task 4: Bootstrap Scraper

**Files:**
- Create: `src/scraper/bootstrap.js`

- [ ] **Step 1: Create src/scraper/bootstrap.js**

```js
const { pool } = require('../db/connection');
const { fetchBootstrap } = require('../utils/luma-client');

async function syncBootstrap() {
  console.log('Syncing bootstrap data...');
  const data = await fetchBootstrap();

  await syncCities(data.places || []);
  await syncCategories(data.categories || []);
  await syncCalendars(data.calendars || []);

  console.log('Bootstrap sync complete');
}

async function syncCities(places) {
  let count = 0;
  for (const entry of places) {
    const p = entry.place;
    await pool.query(
      `INSERT INTO cities (api_id, name, slug, continent, timezone, latitude, longitude, event_count, tint_color, icon_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (api_id) DO UPDATE SET
         name = EXCLUDED.name,
         event_count = EXCLUDED.event_count,
         tint_color = EXCLUDED.tint_color`,
      [
        p.api_id, p.name, p.slug, p.geo_continent, p.timezone,
        p.coordinate?.latitude, p.coordinate?.longitude,
        p.event_count, p.tint_color, p.icon_url,
      ]
    );
    count++;
  }
  console.log(`  Synced ${count} cities`);
}

async function syncCategories(categories) {
  let count = 0;
  for (const entry of categories) {
    const c = entry.category || entry;
    await pool.query(
      `INSERT INTO categories (api_id, name, slug, description, event_count, subscriber_count, tint_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (api_id) DO UPDATE SET
         name = EXCLUDED.name,
         event_count = EXCLUDED.event_count,
         subscriber_count = EXCLUDED.subscriber_count`,
      [
        c.api_id, c.name, c.slug, c.description,
        c.event_count || entry.event_count, c.subscriber_count || entry.subscriber_count,
        c.tint_color,
      ]
    );
    count++;
  }
  console.log(`  Synced ${count} categories`);
}

async function syncCalendars(calendars) {
  let count = 0;
  for (const entry of calendars) {
    const cal = entry.calendar || entry;
    await upsertCalendar(cal);
    count++;
  }
  console.log(`  Synced ${count} featured calendars`);
}

async function upsertCalendar(cal) {
  await pool.query(
    `INSERT INTO calendars (api_id, name, slug, description_short, avatar_url, website,
       twitter_handle, linkedin_handle, instagram_handle, luma_plan, verified_at, tint_color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (api_id) DO UPDATE SET
       name = EXCLUDED.name,
       slug = EXCLUDED.slug,
       description_short = EXCLUDED.description_short,
       avatar_url = EXCLUDED.avatar_url,
       website = EXCLUDED.website,
       twitter_handle = EXCLUDED.twitter_handle,
       linkedin_handle = EXCLUDED.linkedin_handle,
       instagram_handle = EXCLUDED.instagram_handle,
       luma_plan = EXCLUDED.luma_plan,
       verified_at = EXCLUDED.verified_at,
       tint_color = EXCLUDED.tint_color`,
    [
      cal.api_id, cal.name, cal.slug, cal.description_short, cal.avatar_url,
      cal.website, cal.twitter_handle, cal.linkedin_handle, cal.instagram_handle,
      cal.luma_plan, cal.verified_at, cal.tint_color,
    ]
  );
}

module.exports = { syncBootstrap, upsertCalendar };
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/bootstrap.js
git commit -m "feat: bootstrap scraper syncs cities, categories, and calendars"
```

---

### Task 5: Events Scraper

**Files:**
- Create: `src/scraper/events.js`

- [ ] **Step 1: Create src/scraper/events.js**

```js
const { pool } = require('../db/connection');
const { paginateEvents, paginateCalendarEvents, delay } = require('../utils/luma-client');
const { upsertCalendar } = require('./bootstrap');

async function scrapeBySource(sourceType, fetchFn) {
  const run = await startRun(sourceType);
  let newCount = 0;
  let totalSeen = 0;

  try {
    const result = await fetchFn((seen, added) => {
      totalSeen += seen;
      newCount += added;
    });
    await finishRun(run.id, newCount, totalSeen, 'completed');
  } catch (err) {
    await finishRun(run.id, newCount, totalSeen, 'failed', err.message);
    console.error(`Scrape ${sourceType} failed:`, err.message);
  }

  return { newCount, totalSeen };
}

async function scrapeCities(cities) {
  return scrapeBySource('cities', async (report) => {
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      console.log(`  [${i + 1}/${cities.length}] Scraping city ${city.api_id}...`);
      try {
        const entries = await paginateEvents({ discover_place_api_id: city.api_id });
        const added = await insertEntries(entries);
        report(entries.length, added);
        console.log(`    ${entries.length} events (${added} new)`);
      } catch (err) {
        console.error(`    Error scraping city ${city.api_id}: ${err.message}`);
      }
      await delay(200);
    }
  });
}

async function scrapeCategories(categories) {
  return scrapeBySource('categories', async (report) => {
    for (const cat of categories) {
      console.log(`  Scraping category ${cat.slug}...`);
      try {
        const entries = await paginateEvents({ slug: cat.slug });
        const added = await insertEntries(entries);
        report(entries.length, added);
        console.log(`    ${entries.length} events (${added} new)`);
      } catch (err) {
        console.error(`    Error scraping category ${cat.slug}: ${err.message}`);
      }
      await delay(200);
    }
  });
}

async function scrapeCalendars(calendars) {
  return scrapeBySource('calendars', async (report) => {
    for (const cal of calendars) {
      console.log(`  Scraping calendar ${cal.api_id}...`);
      try {
        const entries = await paginateCalendarEvents(cal.api_id);
        const added = await insertEntries(entries);
        report(entries.length, added);
        console.log(`    ${entries.length} events (${added} new)`);
      } catch (err) {
        console.error(`    Error scraping calendar ${cal.api_id}: ${err.message}`);
      }
      await delay(200);
    }
  });
}

async function insertEntries(entries) {
  let newCount = 0;

  for (const entry of entries) {
    const ev = entry.event;
    if (!ev || !ev.api_id) continue;

    // Upsert calendar if present
    if (entry.calendar) {
      await upsertCalendar(entry.calendar);
    }

    // Upsert hosts
    const hosts = entry.hosts || [];
    for (const host of hosts) {
      await upsertHost(host);
    }

    // Insert event (skip if exists)
    const inserted = await insertEvent(ev, entry);
    if (inserted) {
      newCount++;
      // Link hosts
      for (const host of hosts) {
        await linkEventHost(ev.api_id, host.api_id);
      }
    }
  }

  return newCount;
}

async function insertEvent(ev, entry) {
  const geo = ev.geo_address_info || {};
  const ticket = entry.ticket_info || {};
  const price = ticket.price || {};
  const coord = ev.coordinate || {};
  const featuredCity = entry.featured_city || {};

  const result = await pool.query(
    `INSERT INTO events (
       api_id, name, start_at, end_at, timezone, url_slug, cover_url,
       calendar_api_id, event_type, location_type, visibility,
       city, city_state, address, full_address, country, country_code,
       latitude, longitude, geo_address_mode,
       hide_rsvp, show_guest_list, waitlist_enabled,
       is_free, price_cents, price_currency, is_sold_out, spots_remaining,
       require_approval, guest_count, score, featured_city_api_id
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
     ) ON CONFLICT (api_id) DO NOTHING
     RETURNING api_id`,
    [
      ev.api_id, ev.name, ev.start_at, ev.end_at, ev.timezone,
      ev.url, ev.cover_url, ev.calendar_api_id, ev.event_type,
      ev.location_type, ev.visibility,
      geo.city, geo.city_state, geo.address, geo.full_address,
      geo.country, geo.country_code,
      coord.latitude, coord.longitude, geo.mode,
      ev.hide_rsvp || false, ev.show_guest_list || false, ev.waitlist_enabled || false,
      ticket.is_free ?? true, price.cents || null, price.currency || null,
      ticket.is_sold_out || false, ticket.spots_remaining ?? null,
      ticket.require_approval || false, entry.guest_count || 0,
      entry.score || null, featuredCity.api_id || null,
    ]
  );

  return result.rowCount > 0;
}

async function upsertHost(host) {
  await pool.query(
    `INSERT INTO hosts (
       api_id, name, first_name, last_name, avatar_url, username,
       bio_short, website, linkedin_handle, twitter_handle,
       instagram_handle, tiktok_handle, youtube_handle,
       timezone, is_verified, last_online_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (api_id) DO UPDATE SET
       name = EXCLUDED.name,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       avatar_url = EXCLUDED.avatar_url,
       bio_short = EXCLUDED.bio_short,
       website = EXCLUDED.website,
       linkedin_handle = EXCLUDED.linkedin_handle,
       twitter_handle = EXCLUDED.twitter_handle,
       instagram_handle = EXCLUDED.instagram_handle,
       tiktok_handle = EXCLUDED.tiktok_handle,
       youtube_handle = EXCLUDED.youtube_handle,
       last_online_at = EXCLUDED.last_online_at`,
    [
      host.api_id, host.name, host.first_name, host.last_name,
      host.avatar_url, host.username, host.bio_short, host.website,
      host.linkedin_handle, host.twitter_handle, host.instagram_handle,
      host.tiktok_handle, host.youtube_handle, host.timezone,
      host.is_verified || false, host.last_online_at,
    ]
  );
}

async function linkEventHost(eventApiId, hostApiId) {
  await pool.query(
    `INSERT INTO event_hosts (event_api_id, host_api_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [eventApiId, hostApiId]
  );
}

async function startRun(sourceType) {
  const result = await pool.query(
    `INSERT INTO scrape_runs (source_type, status) VALUES ($1, 'running') RETURNING id`,
    [sourceType]
  );
  return result.rows[0];
}

async function finishRun(id, newCount, totalSeen, status, error = null) {
  await pool.query(
    `UPDATE scrape_runs SET finished_at = NOW(), new_events_count = $1,
       total_events_seen = $2, status = $3, error = $4 WHERE id = $5`,
    [newCount, totalSeen, status, error, id]
  );
}

module.exports = { scrapeCities, scrapeCategories, scrapeCalendars };
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/events.js
git commit -m "feat: events scraper with dedup, host upsert, and scrape run logging"
```

---

### Task 6: Scraper Scheduler

**Files:**
- Create: `src/scraper/scheduler.js`

- [ ] **Step 1: Create src/scraper/scheduler.js**

```js
const cron = require('node-cron');
const config = require('../config');
const { pool } = require('../db/connection');
const { syncBootstrap } = require('./bootstrap');
const { scrapeCities, scrapeCategories, scrapeCalendars } = require('./events');

let isRunning = false;

async function runFullScrape() {
  if (isRunning) {
    console.log('Scrape already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log(`\n=== Full scrape started at ${new Date().toISOString()} ===`);

  try {
    // Step 1: Sync reference data
    await syncBootstrap();

    // Step 2: Get reference data for iteration
    const cities = (await pool.query('SELECT api_id FROM cities')).rows;
    const categories = (await pool.query('SELECT slug FROM categories')).rows;
    const calendars = (await pool.query('SELECT api_id FROM calendars')).rows;

    // Step 3: Scrape all sources
    const cityResult = await scrapeCities(cities);
    console.log(`Cities done: ${cityResult.newCount} new / ${cityResult.totalSeen} seen`);

    const catResult = await scrapeCategories(categories);
    console.log(`Categories done: ${catResult.newCount} new / ${catResult.totalSeen} seen`);

    const calResult = await scrapeCalendars(calendars);
    console.log(`Calendars done: ${calResult.newCount} new / ${calResult.totalSeen} seen`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalNew = cityResult.newCount + catResult.newCount + calResult.newCount;
    console.log(`=== Full scrape complete in ${elapsed}s. ${totalNew} total new events ===\n`);
  } catch (err) {
    console.error('Full scrape crashed:', err);
  } finally {
    isRunning = false;
  }
}

async function startScheduler() {
  // Check if this is the first run (empty events table)
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM events');
  if (parseInt(rows[0].count, 10) === 0) {
    console.log('No events in database, triggering initial scrape...');
    runFullScrape();
  }

  // Schedule recurring scrape
  cron.schedule(config.CRON_SCHEDULE, () => {
    console.log('Cron triggered scrape');
    runFullScrape();
  });

  console.log(`Scraper scheduled: ${config.CRON_SCHEDULE}`);
}

module.exports = { startScheduler, runFullScrape };
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/scheduler.js
git commit -m "feat: cron scheduler with initial-run detection and full scrape orchestration"
```

---

### Task 7: Reference Data Routes

**Files:**
- Create: `src/routes/reference.js`

- [ ] **Step 1: Create src/routes/reference.js**

```js
const { Router } = require('express');
const { pool } = require('../db/connection');

const router = Router();

router.get('/cities', async (req, res) => {
  const { continent } = req.query;
  let query = 'SELECT * FROM cities';
  const params = [];

  if (continent) {
    query += ' WHERE continent = $1';
    params.push(continent);
  }

  query += ' ORDER BY name';

  const { rows } = await pool.query(query, params);
  res.json({ cities: rows, count: rows.length });
});

router.get('/categories', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY event_count DESC');
  res.json({ categories: rows, count: rows.length });
});

router.get('/calendars', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM calendars ORDER BY name');
  res.json({ calendars: rows, count: rows.length });
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/reference.js
git commit -m "feat: reference data routes for cities, categories, calendars"
```

---

### Task 8: Events Routes

**Files:**
- Create: `src/routes/events.js`

- [ ] **Step 1: Create src/routes/events.js**

```js
const { Router } = require('express');
const { pool } = require('../db/connection');

const router = Router();

// Register /new before /:id to avoid "new" being matched as an id param
router.get('/new', async (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ error: 'since parameter is required (ISO timestamp)' });
  }

  const filters = buildFilters(req.query);
  filters.conditions.push(`e.scraped_at > $${filters.params.length + 1}`);
  filters.params.push(since);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;

  const where = filters.conditions.length ? 'WHERE ' + filters.conditions.join(' AND ') : '';

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT e.api_id) FROM events e ${filters.joins} ${where}`,
    filters.params
  );

  filters.params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT DISTINCT e.* FROM events e ${filters.joins} ${where}
     ORDER BY e.scraped_at DESC
     LIMIT $${filters.params.length - 1} OFFSET $${filters.params.length}`,
    filters.params
  );

  res.json({
    events: rows.map(formatEvent),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const eventResult = await pool.query('SELECT * FROM events WHERE api_id = $1', [id]);
  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const event = eventResult.rows[0];

  const hostsResult = await pool.query(
    `SELECT h.* FROM hosts h
     JOIN event_hosts eh ON eh.host_api_id = h.api_id
     WHERE eh.event_api_id = $1`,
    [id]
  );

  const calendarResult = await pool.query(
    'SELECT * FROM calendars WHERE api_id = $1',
    [event.calendar_api_id]
  );

  res.json({
    event: formatEvent(event),
    hosts: hostsResult.rows.map(formatHost),
    calendar: calendarResult.rows[0] || null,
  });
});

router.get('/', async (req, res) => {
  const filters = buildFilters(req.query);
  const sort = { start_at: 'e.start_at', scraped_at: 'e.scraped_at', score: 'e.score' }[req.query.sort] || 'e.start_at';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;

  const where = filters.conditions.length ? 'WHERE ' + filters.conditions.join(' AND ') : '';

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT e.api_id) FROM events e ${filters.joins} ${where}`,
    filters.params
  );

  filters.params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT DISTINCT e.* FROM events e ${filters.joins} ${where}
     ORDER BY ${sort} ASC
     LIMIT $${filters.params.length - 1} OFFSET $${filters.params.length}`,
    filters.params
  );

  res.json({
    events: rows.map(formatEvent),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  });
});

function buildFilters(query) {
  const conditions = [];
  const params = [];
  let joins = '';

  if (query.city) {
    params.push(query.city);
    conditions.push(`e.city ILIKE $${params.length}`);
  }
  if (query.location_type) {
    params.push(query.location_type);
    conditions.push(`e.location_type = $${params.length}`);
  }
  if (query.is_free !== undefined) {
    params.push(query.is_free === 'true');
    conditions.push(`e.is_free = $${params.length}`);
  }
  if (query.start_after) {
    params.push(query.start_after);
    conditions.push(`e.start_at >= $${params.length}`);
  }
  if (query.start_before) {
    params.push(query.start_before);
    conditions.push(`e.start_at <= $${params.length}`);
  }
  if (query.has_linkedin_hosts === 'true') {
    joins = `JOIN event_hosts eh_li ON eh_li.event_api_id = e.api_id
             JOIN hosts h_li ON h_li.api_id = eh_li.host_api_id AND h_li.linkedin_handle IS NOT NULL`;
    conditions.push('TRUE'); // placeholder so join is used
  }

  return { conditions, params, joins };
}

function formatEvent(row) {
  return {
    ...row,
    url: `https://lu.ma/${row.url_slug}`,
  };
}

function formatHost(row) {
  return {
    ...row,
    linkedin_url: row.linkedin_handle ? `https://linkedin.com${row.linkedin_handle}` : null,
  };
}

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/events.js
git commit -m "feat: events routes with filtering, pagination, and linkedin-host filter"
```

---

### Task 9: Hosts Routes

**Files:**
- Create: `src/routes/hosts.js`

- [ ] **Step 1: Create src/routes/hosts.js**

```js
const { Router } = require('express');
const { pool } = require('../db/connection');

const router = Router();

router.get('/with-linkedin', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const conditions = ['h.linkedin_handle IS NOT NULL'];
  const params = [];

  if (req.query.city) {
    params.push(req.query.city);
    conditions.push(`EXISTS (
      SELECT 1 FROM event_hosts eh
      JOIN events ev ON ev.api_id = eh.event_api_id
      WHERE eh.host_api_id = h.api_id AND ev.city ILIKE $${params.length}
    )`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM hosts h ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT
       h.api_id, h.name, h.first_name, h.last_name, h.linkedin_handle,
       h.avatar_url, h.bio_short, h.website, h.is_verified,
       COUNT(eh.event_api_id) AS event_count,
       ARRAY_AGG(DISTINCT ev.city) FILTER (WHERE ev.city IS NOT NULL) AS cities,
       MAX(ev.start_at) AS latest_event_date,
       (SELECT evl.name FROM events evl
        JOIN event_hosts ehl ON ehl.event_api_id = evl.api_id
        WHERE ehl.host_api_id = h.api_id
        ORDER BY evl.start_at DESC LIMIT 1) AS latest_event_name
     FROM hosts h
     LEFT JOIN event_hosts eh ON eh.host_api_id = h.api_id
     LEFT JOIN events ev ON ev.api_id = eh.event_api_id
     ${where}
     GROUP BY h.api_id
     ORDER BY event_count DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    hosts: rows.map(row => ({
      ...row,
      linkedin_url: `https://linkedin.com${row.linkedin_handle}`,
      event_count: parseInt(row.event_count, 10),
    })),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const hostResult = await pool.query('SELECT * FROM hosts WHERE api_id = $1', [id]);
  if (hostResult.rows.length === 0) {
    return res.status(404).json({ error: 'Host not found' });
  }

  const host = hostResult.rows[0];

  const eventsResult = await pool.query(
    `SELECT e.api_id, e.name, e.start_at, e.end_at, e.city, e.location_type,
            e.is_free, e.url_slug
     FROM events e
     JOIN event_hosts eh ON eh.event_api_id = e.api_id
     WHERE eh.host_api_id = $1
     ORDER BY e.start_at DESC`,
    [id]
  );

  res.json({
    host: {
      ...host,
      linkedin_url: host.linkedin_handle ? `https://linkedin.com${host.linkedin_handle}` : null,
    },
    events: eventsResult.rows.map(row => ({
      ...row,
      url: `https://lu.ma/${row.url_slug}`,
    })),
    event_count: eventsResult.rows.length,
  });
});

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (req.query.has_linkedin === 'true') {
    conditions.push('h.linkedin_handle IS NOT NULL');
  } else if (req.query.has_linkedin === 'false') {
    conditions.push('h.linkedin_handle IS NULL');
  }

  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    conditions.push(`h.name ILIKE $${params.length}`);
  }

  if (req.query.city) {
    params.push(req.query.city);
    conditions.push(`EXISTS (
      SELECT 1 FROM event_hosts eh
      JOIN events ev ON ev.api_id = eh.event_api_id
      WHERE eh.host_api_id = h.api_id AND ev.city ILIKE $${params.length}
    )`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM hosts h ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT h.*, COUNT(eh.event_api_id) AS event_count
     FROM hosts h
     LEFT JOIN event_hosts eh ON eh.host_api_id = h.api_id
     ${where}
     GROUP BY h.api_id
     ORDER BY event_count DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    hosts: rows.map(row => ({
      ...row,
      linkedin_url: row.linkedin_handle ? `https://linkedin.com${row.linkedin_handle}` : null,
      event_count: parseInt(row.event_count, 10),
    })),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  });
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/hosts.js
git commit -m "feat: hosts routes with linkedin directory, city filter, and search"
```

---

### Task 10: Scrape Status Routes

**Files:**
- Create: `src/routes/scrape.js`

- [ ] **Step 1: Create src/routes/scrape.js**

```js
const { Router } = require('express');
const { pool } = require('../db/connection');

const router = Router();

router.get('/status', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1'
  );

  if (rows.length === 0) {
    return res.json({ status: 'no_runs', latest: null });
  }

  const latest = rows[0];

  // Also include summary counts
  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM events) AS total_events,
       (SELECT COUNT(*) FROM hosts) AS total_hosts,
       (SELECT COUNT(*) FROM hosts WHERE linkedin_handle IS NOT NULL) AS hosts_with_linkedin,
       (SELECT COUNT(*) FROM cities) AS total_cities,
       (SELECT COUNT(*) FROM calendars) AS total_calendars`
  );

  res.json({
    latest_run: latest,
    summary: counts.rows[0],
  });
});

router.get('/history', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 20'
  );
  res.json({ runs: rows });
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/scrape.js
git commit -m "feat: scrape status and history routes with summary counts"
```

---

### Task 11: App Entry Point

**Files:**
- Create: `src/index.js`

- [ ] **Step 1: Create src/index.js**

```js
const express = require('express');
const config = require('./config');
const { initDatabase } = require('./db/init');
const { startScheduler } = require('./scraper/scheduler');
const referenceRoutes = require('./routes/reference');
const eventsRoutes = require('./routes/events');
const hostsRoutes = require('./routes/hosts');
const scrapeRoutes = require('./routes/scrape');

const app = express();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', referenceRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/hosts', hostsRoutes);
app.use('/api/scrape', scrapeRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initDatabase();
  await startScheduler();

  app.listen(config.PORT, () => {
    console.log(`Luma API wrapper running on port ${config.PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it starts locally (requires DATABASE_URL)**

```bash
DATABASE_URL=postgresql://localhost:5432/luma node src/index.js
```

Expected: `Database schema initialized` + `Scraper scheduled: 0 */6 * * *` + `Luma API wrapper running on port 3000`
(Ctrl+C to stop — this is just a smoke test. If no local Postgres, skip to deployment.)

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: Express app entry point wiring routes, db init, and cron scheduler"
```

---

### Task 12: GitHub & Railway Deployment

**Files:** None new — this task uses CLI commands.

- [ ] **Step 1: Create GitHub repo**

```bash
cd /Users/kovalov/Documents/Claude/luma-analysis
gh repo create luma-api-wrapper --public --source=. --remote=origin
```

- [ ] **Step 2: Push to GitHub**

```bash
git push -u origin main
```

(If the default branch is `master`, use `master` instead.)

- [ ] **Step 3: Create Railway project with Postgres**

```bash
railway init
railway add --plugin postgresql
```

- [ ] **Step 4: Link the service and set variables**

```bash
railway link
```

Railway auto-injects `DATABASE_URL` from the Postgres plugin. No manual env vars needed unless you want to override `CRON_SCHEDULE`.

- [ ] **Step 5: Deploy**

```bash
railway up
```

- [ ] **Step 6: Verify deployment**

```bash
railway open
```

Then test:
- `GET /health` — should return `{ "status": "ok" }`
- `GET /api/scrape/status` — should show the initial scrape running or completed
- `GET /api/hosts/with-linkedin` — after scrape completes, should return hosts with LinkedIn URLs

- [ ] **Step 7: Commit any Railway config changes**

```bash
git add -A
git commit -m "chore: railway deployment config"
git push
```
