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
