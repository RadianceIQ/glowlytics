const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Glowlytics API running on port ${PORT}`);
  if (!process.env.CLERK_ISSUER_URL) {
    console.log('  WARNING: CLERK_ISSUER_URL not set -- JWT verification disabled (dev mode)');
  }
});
