const app = require('./app');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3001;

// Auto-initialize database tables on startup
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.log('  [DB] No DATABASE_URL — skipping schema init');
    return;
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        age_range VARCHAR(10) NOT NULL DEFAULT '',
        location_coarse VARCHAR(20) NOT NULL DEFAULT '',
        period_applicable VARCHAR(20) NOT NULL DEFAULT 'prefer_not',
        period_last_start_date DATE,
        cycle_length_days INTEGER DEFAULT 28,
        smoker_status BOOLEAN,
        drink_baseline_frequency VARCHAR(10),
        wearable_connected BOOLEAN DEFAULT FALSE,
        wearable_source VARCHAR(50),
        camera_permission_status VARCHAR(20) DEFAULT 'not_requested',
        health_connection JSONB DEFAULT '{}'::jsonb,
        onboarding_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS scan_protocols (
        protocol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES user_profiles(user_id),
        primary_goal VARCHAR(20) NOT NULL,
        scan_region VARCHAR(30) NOT NULL,
        scan_frequency VARCHAR(10) DEFAULT 'daily',
        baseline_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS product_catalog (
        user_product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES user_profiles(user_id),
        product_name VARCHAR(200) NOT NULL,
        product_capture_method VARCHAR(20) NOT NULL,
        ingredients_list TEXT[] NOT NULL DEFAULT '{}',
        usage_schedule VARCHAR(10) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        notes TEXT,
        brand VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS daily_records (
        daily_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES user_profiles(user_id),
        date DATE NOT NULL,
        scanner_reading_id UUID,
        scanner_indices JSONB NOT NULL DEFAULT '{}',
        scanner_quality_flag VARCHAR(10) DEFAULT 'pass',
        scan_region VARCHAR(30),
        photo_uri TEXT,
        photo_quality_flag VARCHAR(10),
        sunscreen_used BOOLEAN NOT NULL DEFAULT FALSE,
        new_product_added BOOLEAN NOT NULL DEFAULT FALSE,
        period_status_confirmed VARCHAR(20),
        cycle_day_estimated INTEGER,
        sleep_quality VARCHAR(10),
        stress_level VARCHAR(10),
        drinks_yesterday VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date)
      );
      CREATE TABLE IF NOT EXISTS model_outputs (
        output_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        daily_id UUID REFERENCES daily_records(daily_id),
        acne_score INTEGER NOT NULL,
        sun_damage_score INTEGER NOT NULL,
        skin_age_score INTEGER NOT NULL,
        confidence VARCHAR(10) DEFAULT 'low',
        primary_driver VARCHAR(100),
        recommended_action TEXT,
        escalation_flag BOOLEAN DEFAULT FALSE,
        conditions JSONB DEFAULT '[]'::jsonb,
        rag_recommendations JSONB DEFAULT '[]'::jsonb,
        personalized_feedback TEXT,
        signal_scores JSONB DEFAULT '{}',
        signal_features JSONB DEFAULT '{}',
        lesions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
      -- Add signal columns to existing tables (idempotent for existing deployments)
      ALTER TABLE model_outputs ADD COLUMN IF NOT EXISTS signal_scores JSONB DEFAULT '{}';
      ALTER TABLE model_outputs ADD COLUMN IF NOT EXISTS signal_features JSONB DEFAULT '{}';
      ALTER TABLE model_outputs ADD COLUMN IF NOT EXISTS lesions JSONB DEFAULT '[]';
      CREATE TABLE IF NOT EXISTS waitlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(320) NOT NULL UNIQUE,
        source VARCHAR(50) DEFAULT 'landing',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_model_outputs_daily ON model_outputs(daily_id);
      CREATE INDEX IF NOT EXISTS idx_products_user ON product_catalog(user_id);
    `);
    console.log('  [DB] Schema initialized');
  } catch (err) {
    console.error('  [DB] Schema init error:', err.message);
  } finally {
    await pool.end();
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Glowlytics API running on port ${PORT}`);
  if (!process.env.CLERK_ISSUER_URL) {
    console.log('  WARNING: CLERK_ISSUER_URL not set -- JWT verification disabled (dev mode)');
  }
  await initDB();
});
