export interface ProductResult {
  name: string;
  ingredients: string[];
  source: string;
}

export interface SearchResult {
  name: string;
  ingredients: string[];
}

// ---- Individual lookup sources ----

export async function lookupOpenBeautyFacts(barcode: string): Promise<ProductResult | null> {
  const res = await fetch(
    `https://world.openbeautyfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
  );
  const data = await res.json();
  if (data.status === 1 && data.product?.product_name) {
    const p = data.product;
    return {
      name: p.product_name,
      ingredients: p.ingredients_text
        ? p.ingredients_text.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      source: 'Open Beauty Facts',
    };
  }
  return null;
}

export async function lookupOpenFoodFacts(barcode: string): Promise<ProductResult | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
  );
  const data = await res.json();
  if (data.status === 1 && data.product?.product_name) {
    const p = data.product;
    return {
      name: p.product_name,
      ingredients: p.ingredients_text
        ? p.ingredients_text.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      source: 'Open Food Facts',
    };
  }
  return null;
}

export async function lookupUPCitemdb(barcode: string): Promise<ProductResult | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.items && data.items.length > 0 && data.items[0].title) {
    return {
      name: data.items[0].title,
      ingredients: [],
      source: 'UPCitemdb',
    };
  }
  return null;
}

export async function lookupNIHDailyMed(barcode: string): Promise<ProductResult | null> {
  // NIH DailyMed doesn't support barcode lookup directly, but we can try
  // UPC/NDC-based search via their API
  const res = await fetch(
    `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?ndc=${encodeURIComponent(barcode)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.data && data.data.length > 0) {
    const spl = data.data[0];
    return {
      name: spl.title || spl.spl_name || 'Unknown Product',
      ingredients: spl.active_ingredients
        ? spl.active_ingredients.map((i: { name: string }) => i.name)
        : [],
      source: 'NIH DailyMed',
    };
  }
  return null;
}

// ---- Text search ----

export async function searchOpenBeautyFacts(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=10`
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.products || data.products.length === 0) return [];
  return data.products
    .filter((p: { product_name?: string }) => p.product_name)
    .map((p: { product_name: string; ingredients_text?: string }) => ({
      name: p.product_name,
      ingredients: p.ingredients_text
        ? p.ingredients_text.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    }));
}

// ---- Waterfall lookup ----

const lookupSources = [
  lookupOpenBeautyFacts,
  lookupOpenFoodFacts,
  lookupUPCitemdb,
  lookupNIHDailyMed,
];

export async function lookupBarcode(barcode: string): Promise<ProductResult | null> {
  for (const lookup of lookupSources) {
    try {
      const result = await lookup(barcode);
      if (result) return result;
    } catch {
      // Source failed, try next
    }
  }
  return null;
}
