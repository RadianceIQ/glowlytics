require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const OpenAI = require('openai');
const { seedGuidelines, queryGuidelines } = require('./rag');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/radianceiq',
});

// ==================== AUTH MIDDLEWARE ====================

const CLERK_ISSUER_URL = process.env.CLERK_ISSUER_URL || '';

const client = CLERK_ISSUER_URL ? jwksClient({
  jwksUri: `${CLERK_ISSUER_URL}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
}) : null;

function getKey(header, callback) {
  if (!client) return callback(null, null);
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Auth middleware: verifies Clerk JWT from Authorization header.
 * - Production: rejects requests without a valid token (401).
 * - Development (NODE_ENV=development): allows unauthenticated requests
 *   through with req.auth = null so the backend works without Clerk.
 * - If CLERK_ISSUER_URL is not set, tokens are accepted but not verified
 *   (dev-mode passthrough).
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development') {
      req.auth = null;
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  if (!client) {
    // No JWKS configured -- dev mode passthrough with a synthetic user
    req.auth = { userId: 'dev-user' };
    return next();
  }

  jwt.verify(token, getKey, { issuer: CLERK_ISSUER_URL }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.auth = { userId: decoded.sub, sessionId: decoded.sid };
    next();
  });
};

// ==================== INPUT VALIDATION ====================

/** Whitelist of columns that may be updated via PATCH /api/users/:id */
const ALLOWED_USER_FIELDS = [
  'age_range',
  'location_coarse',
  'period_applicable',
  'period_last_start_date',
  'cycle_length_days',
  'smoker_status',
  'drink_baseline_frequency',
  'wearable_connected',
  'wearable_source',
  'camera_permission_status',
  'onboarding_complete',
];

// ==================== PUBLIC ROUTES (no auth) ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Barcode product lookup (public -- called before the user has an account)
app.get('/api/products/lookup/:barcode', async (req, res) => {
  const barcode = req.params.barcode;
  const sources = [lookupOpenBeautyFacts, lookupOpenFoodFacts, lookupUPCitemdb, lookupNIHDailyMed];

  let bestResult = null;
  for (const lookup of sources) {
    try {
      const result = await lookup(barcode);
      if (result && result.name) {
        bestResult = result;
        if (result.ingredients) break;
      }
    } catch {
      // Source failed, try next
    }
  }

  if (bestResult) {
    return res.json(bestResult);
  }

  res.status(404).json({ error: 'Product not found in any database' });
});

// Product text search (public)
app.get('/api/products/search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.length < 2) {
    return res.status(400).json({ error: 'Query parameter "q" must be at least 2 characters' });
  }

  try {
    const searchRes = await fetch(
      `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=10`
    );
    if (!searchRes.ok) {
      return res.json([]);
    }
    const data = await searchRes.json();
    const results = (data.products || [])
      .filter((p) => p.product_name)
      .map((p) => ({
        name: p.product_name,
        brands: p.brands || '',
        ingredients: p.ingredients_text || '',
        image_url: p.image_url || null,
        source: 'Open Beauty Facts',
      }));
    res.json(results);
  } catch {
    res.json([]);
  }
});

// ==================== PROTECTED ROUTES (auth required) ====================
// TODO: Add rate limiting middleware here for production (e.g. express-rate-limit)

app.use(authMiddleware);

// ==================== VISION API PROXY ====================

app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { image_base64, context } = req.body;

    if (!image_base64) {
      return res.status(400).json({ error: 'image_base64 is required' });
    }
    if (!context) {
      return res.status(400).json({ error: 'context object is required' });
    }

    const modelId = process.env.VISION_MODEL_ID || 'gpt-4o';

    const systemPrompt = `You are a dermatology analysis assistant. Analyze the provided facial skin photo and return structured scores.

Score each dimension 0-100 where 0 = no concern and 100 = severe concern:
- acne_score: inflammation, breakouts, comedones, papules, pustules
- sun_damage_score: hyperpigmentation, sunspots, melasma, UV damage signs
- skin_age_score: fine lines, wrinkles, texture roughness, elasticity loss

Also provide:
- confidence: "low", "med", or "high" based on image quality and clarity
- primary_driver: the main factor driving the scores (e.g., "acne", "sun_damage", "routine adherence")
- recommended_action: one actionable sentence for the user

Context: User's primary goal is "${context.primary_goal || 'general tracking'}", scanning "${context.scan_region || 'full face'}" region.
Sunscreen used today: ${context.sunscreen_used ?? false}. Sleep: ${context.sleep_quality || 'unknown'}. Stress: ${context.stress_level || 'unknown'}.
Number of previous scans: ${context.scan_count ?? 0}.

Return ONLY valid JSON matching this schema:
{
  "acne_score": number,
  "sun_damage_score": number,
  "skin_age_score": number,
  "confidence": "low" | "med" | "high",
  "primary_driver": string,
  "recommended_action": string
}`;

    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this facial skin photo and return the structured scores.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image_base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty response from Vision model' });
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Could not parse JSON from Vision model response', raw: content });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clamp ranges
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const validConfidence = ['low', 'med', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low';

    const result = {
      acne_score: clamp(parsed.acne_score),
      sun_damage_score: clamp(parsed.sun_damage_score),
      skin_age_score: clamp(parsed.skin_age_score),
      confidence: validConfidence,
      primary_driver: parsed.primary_driver || 'general tracking',
      recommended_action: parsed.recommended_action || 'Continue daily scans for more data.',
    };

    res.json(result);
  } catch (err) {
    console.error('Vision API error:', err.message);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(502).json({ error: 'OpenAI API key is invalid or missing' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Vision API rate limit exceeded. Try again shortly.' });
    }
    res.status(500).json({ error: `Vision analysis failed: ${err.message}` });
  }
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
    // Filter request body to only whitelisted fields to prevent SQL injection
    const safeFields = {};
    for (const key of Object.keys(req.body)) {
      if (ALLOWED_USER_FIELDS.includes(key)) {
        safeFields[key] = req.body[key];
      }
    }

    const fields = Object.keys(safeFields);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const values = Object.values(safeFields);
    const setClause = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');

    const result = await pool.query(
      `UPDATE user_profiles SET ${setClause}, updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [req.params.id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
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

// ==================== RAG PIPELINE ====================

// Seed guidelines into Pinecone (dev/admin only)
app.post('/api/rag/seed', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Seeding is only available in development mode' });
    }

    if (!process.env.PINECONE_API_KEY) {
      return res.status(500).json({ error: 'PINECONE_API_KEY not configured' });
    }

    const result = await seedGuidelines();
    res.json({
      success: true,
      message: `Seeded ${result.seeded} guideline chunks`,
      categories: result.categories,
    });
  } catch (err) {
    console.error('RAG seed error:', err.message);
    res.status(500).json({ error: `Failed to seed guidelines: ${err.message}` });
  }
});

// Query relevant guideline excerpts
app.post('/api/rag/query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ error: 'Query must be a string with at least 3 characters' });
    }

    if (!process.env.PINECONE_API_KEY) {
      return res.status(500).json({ error: 'PINECONE_API_KEY not configured' });
    }

    const topK = Math.min(parseInt(req.body.topK) || 3, 10);
    const results = await queryGuidelines(query.trim(), topK);

    res.json({
      query: query.trim(),
      results,
    });
  } catch (err) {
    console.error('RAG query error:', err.message);
    res.status(500).json({ error: `Failed to query guidelines: ${err.message}` });
  }
});

// ==================== BARCODE PRODUCT LOOKUP (waterfall) ====================

async function lookupOpenBeautyFacts(barcode) {
  const res = await fetch(
    `https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`
  );
  const data = await res.json();
  if (data.status !== 1 || !data.product?.product_name) return null;
  const p = data.product;
  return {
    name: p.product_name || '',
    brands: p.brands || '',
    ingredients: p.ingredients_text || '',
    image_url: p.image_url || null,
    source: 'Open Beauty Facts',
  };
}

async function lookupOpenFoodFacts(barcode) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
  );
  const data = await res.json();
  if (data.status !== 1 || !data.product?.product_name) return null;
  const p = data.product;
  return {
    name: p.product_name || '',
    brands: p.brands || '',
    ingredients: p.ingredients_text || '',
    image_url: p.image_url || null,
    source: 'Open Food Facts',
  };
}

async function lookupUPCitemdb(barcode) {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;
  const item = data.items[0];
  return {
    name: item.title || '',
    brands: item.brand || '',
    ingredients: '',
    image_url: (item.images && item.images[0]) || null,
    source: 'UPCitemdb',
  };
}

async function lookupNIHDailyMed(barcode) {
  const res = await fetch(
    `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?ndc=${barcode}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data || data.data.length === 0) return null;
  const spl = data.data[0];
  return {
    name: spl.title || spl.spl_name || '',
    brands: '',
    ingredients: spl.active_ingredients
      ? spl.active_ingredients.map((i) => i.name).join(', ')
      : '',
    image_url: null,
    source: 'NIH DailyMed',
  };
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`RadianceIQ API running on port ${PORT}`);
  if (!CLERK_ISSUER_URL) {
    console.log('  WARNING: CLERK_ISSUER_URL not set -- JWT verification disabled (dev mode)');
  }
});
