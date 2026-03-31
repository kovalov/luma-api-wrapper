module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: parseInt(process.env.PORT, 10) || 3000,
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 */6 * * *',
  LUMA_BASE_URL: 'https://api2.luma.com',
};
