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
