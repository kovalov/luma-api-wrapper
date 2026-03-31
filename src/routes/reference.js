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
