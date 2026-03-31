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
