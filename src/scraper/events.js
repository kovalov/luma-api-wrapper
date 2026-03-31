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
