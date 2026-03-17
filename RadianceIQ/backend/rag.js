const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// ==================== CLIENTS ====================

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').replace(/\s+/g, ''),
});

let pineconeIndex = null;

function getPineconeIndex() {
  if (pineconeIndex) return pineconeIndex;

  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY not configured');
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const indexName = process.env.PINECONE_INDEX_NAME || 'glowlytics-guidelines';
  pineconeIndex = pc.index(indexName);
  return pineconeIndex;
}

// ==================== EMBEDDING ====================

/**
 * Generate an embedding vector for the given text using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional float array.
 */
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// ==================== GUIDELINE DATA ====================

const GUIDELINE_CHUNKS = [
  {
    id: 'aad-acne-mgmt-01',
    text: 'AAD Acne Management: For mild acne (comedonal), topical retinoids are first-line therapy. Adapalene 0.1% gel is available OTC and is well-tolerated. Apply a pea-sized amount to clean, dry skin at night. Expect initial purging for 4-6 weeks before improvement becomes visible. Benzoyl peroxide 2.5% is equally effective as higher concentrations with less irritation.',
    category: 'acne_management',
  },
  {
    id: 'aad-acne-mgmt-02',
    text: 'AAD Acne Management: For moderate inflammatory acne, combination therapy with a topical retinoid plus benzoyl peroxide is recommended. Oral antibiotics (doxycycline 50-100mg) should be limited to 3 months to reduce antibiotic resistance. Always pair oral antibiotics with a topical retinoid for maintenance after the antibiotic course ends.',
    category: 'acne_management',
  },
  {
    id: 'aad-sun-protection-01',
    text: 'AAD Sun Protection Guidelines: Use broad-spectrum SPF 30 or higher sunscreen daily, even on cloudy days. UV radiation penetrates clouds and windows. Apply 1 ounce (shot glass full) to all exposed skin 15 minutes before going outdoors. Reapply every 2 hours, or immediately after swimming or sweating. Chemical sunscreens need 20 minutes to absorb; mineral sunscreens work immediately.',
    category: 'sun_protection',
  },
  {
    id: 'aad-sun-protection-02',
    text: 'AAD SPF Guidelines: SPF 30 blocks 97% of UVB rays, SPF 50 blocks 98%, and SPF 100 blocks 99%. The marginal benefit above SPF 50 is minimal. Look for "broad spectrum" to ensure UVA protection. Key UVA filters include avobenzone, zinc oxide, titanium dioxide, and mexoryl. Reapplication is more important than higher SPF numbers.',
    category: 'sun_protection',
  },
  {
    id: 'aad-skin-aging-01',
    text: 'AAD Skin Aging Prevention: Photoaging accounts for up to 90% of visible skin aging. Daily sunscreen use reduces skin aging by 24% (Nambour trial). Tretinoin 0.025-0.05% is the gold standard for treating and preventing photoaging. It increases collagen synthesis, accelerates cell turnover, and reduces fine lines within 12 weeks of consistent use.',
    category: 'skin_aging',
  },
  {
    id: 'aad-retinoid-use-01',
    text: 'AAD Retinoid Guidance: Start with the lowest concentration (tretinoin 0.025% or adapalene 0.1%) and apply every other night for the first 2 weeks. Increase to nightly use as tolerated. Common side effects include dryness, peeling, and photosensitivity. Always use sunscreen during the day when using retinoids. Avoid combining with other exfoliating actives (AHA/BHA) until skin is acclimated.',
    category: 'retinoid_use',
  },
  {
    id: 'aad-retinoid-use-02',
    text: 'Retinoid Hierarchy by Strength: Retinol (OTC, gentlest) < Retinaldehyde < Adapalene 0.1% (OTC) < Tretinoin 0.025% < Tretinoin 0.05% < Tretinoin 0.1% < Tazarotene 0.1%. For anti-aging, tretinoin 0.025% is sufficient. For acne, adapalene 0.3% or tretinoin 0.05% may be needed. Retinol requires 10-20x the concentration to match tretinoin efficacy.',
    category: 'retinoid_use',
  },
  {
    id: 'aha-bha-guidance-01',
    text: 'AHA/BHA Exfoliation Guidelines: AHAs (glycolic acid, lactic acid) are water-soluble and work on the skin surface. Best for sun damage, dryness, and texture. Start at 5-8% concentration. BHAs (salicylic acid) are oil-soluble and penetrate pores. Best for acne and blackheads. Start at 0.5-2%. Do not combine AHA/BHA with retinoids on the same night -- alternate evenings.',
    category: 'aha_bha_guidance',
  },
  {
    id: 'sunscreen-recs-01',
    text: 'Sunscreen Selection Recommendations: For oily/acne-prone skin, choose lightweight chemical sunscreens or gel formulations. For sensitive skin, mineral sunscreens (zinc oxide, titanium dioxide) are less likely to cause irritation. For dark skin tones, tinted mineral sunscreens avoid the white cast. Apply sunscreen as the last step of skincare, before makeup. Spray sunscreens should be rubbed in after application.',
    category: 'sunscreen_recommendations',
  },
  {
    id: 'hormonal-acne-01',
    text: 'Hormonal Acne Management: Hormonal acne typically presents along the jawline and chin, worsening around menstruation. Spironolactone 50-100mg is first-line for adult female hormonal acne. Oral contraceptives containing drospirenone or norgestimate are also effective. Topical retinoids and benzoyl peroxide remain important adjuncts. Hormonal acne rarely responds to antibiotics alone.',
    category: 'hormonal_acne',
  },
  {
    id: 'sleep-stress-skin-01',
    text: 'Sleep and Stress Impact on Skin: Sleep deprivation increases cortisol, which stimulates sebum production and inflammation, worsening acne and eczema. Aim for 7-9 hours of quality sleep. Chronic stress activates the HPA axis, leading to increased inflammatory cytokines and impaired skin barrier function. Stress management techniques (meditation, exercise) measurably improve skin conditions within 4-6 weeks.',
    category: 'sleep_stress_impact',
  },
  {
    id: 'sleep-stress-skin-02',
    text: 'Circadian Rhythm and Skin Repair: Skin cell regeneration peaks between 11 PM and 4 AM. Transepidermal water loss (TEWL) is highest at night, making nighttime moisturization critical. Blue light from screens suppresses melatonin and may impair skin repair cycles. Apply heavier occlusives and active treatments (retinoids, peptides) at night when skin permeability is highest.',
    category: 'sleep_stress_impact',
  },
  {
    id: 'moisturizer-selection-01',
    text: 'Moisturizer Selection Guide: Look for three categories of ingredients: humectants (hyaluronic acid, glycerin) to attract water, emollients (ceramides, squalane) to soften, and occlusives (petrolatum, dimethicone) to seal moisture. For oily skin, use lightweight gel moisturizers with hyaluronic acid. For dry skin, use cream-based formulas with ceramides. Apply to damp skin within 60 seconds of cleansing for best absorption.',
    category: 'moisturizer_selection',
  },
  {
    id: 'ingredient-interactions-01',
    text: 'Ingredient Interaction Warnings: Do not combine vitamin C (ascorbic acid) with niacinamide at high concentrations -- may cause flushing. Do not combine retinoids with AHA/BHA on the same night. Do not combine benzoyl peroxide with tretinoin (oxidizes it). Benzoyl peroxide is safe with adapalene. Vitamin C is best applied in the morning under sunscreen for photoprotective synergy.',
    category: 'ingredient_interactions',
  },
  {
    id: 'ingredient-interactions-02',
    text: 'Safe Ingredient Combinations: Hyaluronic acid pairs well with everything. Niacinamide (2-5%) pairs well with retinoids to reduce irritation. Centella asiatica soothes retinoid-irritated skin. Ceramides support barrier repair during active treatment. Azelaic acid (10-15%) is safe with most actives and is pregnancy-safe for acne and hyperpigmentation.',
    category: 'ingredient_interactions',
  },
  {
    id: 'dermatologist-referral-01',
    text: 'When to See a Dermatologist: Seek professional evaluation if acne does not improve after 12 weeks of consistent OTC treatment. Urgent referral for: rapidly changing moles (ABCDE criteria), painful cystic acne with scarring risk, widespread unexplained rash, suspected skin infection, or any lesion that bleeds and does not heal within 3 weeks. Annual skin checks are recommended for all adults.',
    category: 'dermatologist_referral',
  },
  {
    id: 'photoaging-prevention-01',
    text: 'Photoaging Prevention Strategies: UV exposure is cumulative and irreversible. Key prevention: daily sunscreen, protective clothing (UPF 50+), seeking shade during peak UV hours (10 AM - 4 PM). Antioxidant serums (vitamin C 15-20%, vitamin E, ferulic acid) provide additional photoprotection when layered under sunscreen. Window glass blocks UVB but not UVA -- apply sunscreen for prolonged indoor sun exposure.',
    category: 'photoaging_prevention',
  },
  {
    id: 'inflammatory-skin-01',
    text: 'Inflammatory Skin Conditions: Rosacea triggers include sun, heat, alcohol, spicy food, and stress. Azelaic acid 15% and metronidazole 0.75% are first-line topical treatments. Avoid retinoids and AHAs on rosacea-prone skin unless directed by a dermatologist. Eczema (atopic dermatitis) requires aggressive moisturization and avoidance of irritants. Ceramide-rich moisturizers applied twice daily reduce flare frequency by 50%.',
    category: 'inflammatory_conditions',
  },
  {
    id: 'skin-barrier-repair-01',
    text: 'Skin Barrier Repair Protocol: Signs of compromised barrier include stinging with products, redness, increased sensitivity, and dehydration despite moisturizing. Stop all actives (retinoids, AHA/BHA, vitamin C). Use only a gentle cleanser, ceramide moisturizer, and SPF for 2-4 weeks. Reintroduce actives one at a time, starting with the gentlest. Niacinamide 4-5% helps rebuild barrier integrity. Avoid hot water and over-cleansing.',
    category: 'skin_barrier_repair',
  },
];

// ==================== SEED FUNCTION ====================

/**
 * Upsert all guideline chunks into Pinecone with their embeddings.
 * Call this once to populate the index.
 */
async function seedGuidelines() {
  const index = getPineconeIndex();

  // Generate embeddings for all chunks in parallel batches
  const batchSize = 5;
  const vectors = [];

  for (let i = 0; i < GUIDELINE_CHUNKS.length; i += batchSize) {
    const batch = GUIDELINE_CHUNKS.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((chunk) => embedText(chunk.text))
    );

    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: batch[j].id,
        values: embeddings[j],
        metadata: {
          text: batch[j].text,
          category: batch[j].category,
        },
      });
    }
  }

  // Upsert to Pinecone (v7 SDK uses { records } format)
  await index.upsert({ records: vectors });

  return {
    seeded: vectors.length,
    categories: [...new Set(GUIDELINE_CHUNKS.map((c) => c.category))],
  };
}

// ==================== QUERY FUNCTION ====================

/**
 * Query Pinecone for guideline chunks relevant to the given query.
 * Returns the top-K most relevant guideline excerpts with their scores.
 */
async function queryGuidelines(query, topK = 3) {
  const index = getPineconeIndex();
  const queryEmbedding = await embedText(query);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score,
    text: match.metadata?.text || '',
    category: match.metadata?.category || '',
  }));
}

module.exports = {
  embedText,
  seedGuidelines,
  queryGuidelines,
  GUIDELINE_CHUNKS,
};
