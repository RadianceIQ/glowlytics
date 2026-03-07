const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/radianceiq',
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== USER PROFILES ====================

app.post('/api/users', async (req, res) => {
  try {
    const {
      age_range, location_coarse, period_applicable,
      period_last_start_date, cycle_length_days,
      smoker_status, drink_baseline_frequency,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO user_profiles
       (age_range, location_coarse, period_applicable, period_last_start_date,
        cycle_length_days, smoker_status, drink_baseline_frequency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [age_range, location_coarse, period_applicable,
       period_last_start_date, cycle_length_days || 28,
       smoker_status, drink_baseline_frequency]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1', [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    const result = await pool.query(
      `UPDATE user_profiles SET ${setClause}, updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SCAN PROTOCOLS ====================

app.post('/api/protocols', async (req, res) => {
  try {
    const { user_id, primary_goal, scan_region, baseline_date } = req.body;
    const result = await pool.query(
      `INSERT INTO scan_protocols (user_id, primary_goal, scan_region, baseline_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, primary_goal, scan_region, baseline_date || new Date().toISOString().split('T')[0]]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/protocols/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scan_protocols WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PRODUCTS ====================

app.post('/api/products', async (req, res) => {
  try {
    const {
      user_id, product_name, product_capture_method,
      ingredients_list, usage_schedule, start_date, notes,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO product_catalog
       (user_id, product_name, product_capture_method, ingredients_list,
        usage_schedule, start_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, product_name, product_capture_method,
       ingredients_list, usage_schedule,
       start_date || new Date().toISOString().split('T')[0], notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_catalog WHERE user_id = $1 AND end_date IS NULL ORDER BY start_date',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE product_catalog SET end_date = CURRENT_DATE WHERE user_product_id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DAILY RECORDS ====================

app.post('/api/daily-records', async (req, res) => {
  try {
    const {
      user_id, date, scanner_reading_id, scanner_indices,
      scanner_quality_flag, scan_region, photo_uri,
      photo_quality_flag, sunscreen_used, new_product_added,
      period_status_confirmed, cycle_day_estimated,
      sleep_quality, stress_level, drinks_yesterday,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO daily_records
       (user_id, date, scanner_reading_id, scanner_indices,
        scanner_quality_flag, scan_region, photo_uri,
        photo_quality_flag, sunscreen_used, new_product_added,
        period_status_confirmed, cycle_day_estimated,
        sleep_quality, stress_level, drinks_yesterday)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (user_id, date) DO UPDATE SET
        scanner_indices = EXCLUDED.scanner_indices,
        scanner_quality_flag = EXCLUDED.scanner_quality_flag,
        sunscreen_used = EXCLUDED.sunscreen_used,
        new_product_added = EXCLUDED.new_product_added,
        period_status_confirmed = EXCLUDED.period_status_confirmed,
        sleep_quality = EXCLUDED.sleep_quality,
        stress_level = EXCLUDED.stress_level,
        drinks_yesterday = EXCLUDED.drinks_yesterday
       RETURNING *`,
      [user_id, date || new Date().toISOString().split('T')[0],
       scanner_reading_id, JSON.stringify(scanner_indices),
       scanner_quality_flag || 'pass', scan_region,
       photo_uri, photo_quality_flag,
       sunscreen_used, new_product_added || false,
       period_status_confirmed, cycle_day_estimated,
       sleep_quality, stress_level, drinks_yesterday]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-records/:userId', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query(
      `SELECT * FROM daily_records
       WHERE user_id = $1 AND date >= CURRENT_DATE - $2::integer
       ORDER BY date`,
      [req.params.userId, days]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MODEL OUTPUTS ====================

app.post('/api/model-outputs', async (req, res) => {
  try {
    const {
      daily_id, acne_score, sun_damage_score, skin_age_score,
      confidence, primary_driver, recommended_action, escalation_flag,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO model_outputs
       (daily_id, acne_score, sun_damage_score, skin_age_score,
        confidence, primary_driver, recommended_action, escalation_flag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [daily_id, acne_score, sun_damage_score, skin_age_score,
       confidence, primary_driver, recommended_action, escalation_flag || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/model-outputs/:userId', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query(
      `SELECT mo.* FROM model_outputs mo
       JOIN daily_records dr ON mo.daily_id = dr.daily_id
       WHERE dr.user_id = $1 AND dr.date >= CURRENT_DATE - $2::integer
       ORDER BY dr.date`,
      [req.params.userId, days]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== REPORTS ====================

app.post('/api/reports', async (req, res) => {
  try {
    const { user_id, date_range, included_fields } = req.body;
    const result = await pool.query(
      `INSERT INTO report_artifacts (user_id, date_range, included_fields, report_uri)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, date_range, included_fields || [],
       `report_${Date.now()}.pdf`]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM report_artifacts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== OPEN BEAUTY FACTS PROXY ====================

app.get('/api/products/lookup/:barcode', async (req, res) => {
  try {
    const response = await fetch(
      `https://world.openbeautyfacts.org/api/v0/product/${req.params.barcode}.json`
    );
    const data = await response.json();
    if (data.status === 1) {
      res.json({
        name: data.product.product_name || 'Unknown Product',
        brands: data.product.brands || '',
        ingredients: data.product.ingredients_text || '',
        image_url: data.product.image_url || null,
      });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`RadianceIQ API running on port ${PORT}`);
});
