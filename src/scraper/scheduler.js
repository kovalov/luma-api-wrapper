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
