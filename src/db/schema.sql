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
  name TEXT,
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

-- Migration: allow null names (some Luma data has null names)
ALTER TABLE hosts ALTER COLUMN name DROP NOT NULL;
ALTER TABLE events ALTER COLUMN name DROP NOT NULL;
