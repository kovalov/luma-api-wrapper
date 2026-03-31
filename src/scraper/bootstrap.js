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
