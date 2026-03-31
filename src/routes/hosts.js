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
