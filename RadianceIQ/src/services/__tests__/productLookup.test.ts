import {
  lookupOpenBeautyFacts,
  lookupOpenFoodFacts,
  lookupUPCitemdb,
  lookupBarcode,
} from '../productLookup';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('lookupOpenBeautyFacts', () => {
  it('returns product when found', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        status: 1,
        product: {
          product_name: 'CeraVe Moisturizer',
          ingredients_text: 'Ceramides, Hyaluronic Acid, Niacinamide',
        },
      }),
    });

    const result = await lookupOpenBeautyFacts('123456789');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('CeraVe Moisturizer');
    expect(result!.ingredients).toEqual(['Ceramides', 'Hyaluronic Acid', 'Niacinamide']);
    expect(result!.source).toBe('Open Beauty Facts');
  });

  it('returns null when product not found', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: 0 }),
    });

    const result = await lookupOpenBeautyFacts('000000000');
    expect(result).toBeNull();
  });
});

describe('lookupOpenFoodFacts', () => {
  it('returns product when found', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Some Food Product',
          ingredients_text: 'Water, Salt',
        },
      }),
    });

    const result = await lookupOpenFoodFacts('123456789');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Some Food Product');
    expect(result!.source).toBe('Open Food Facts');
  });
});

describe('lookupUPCitemdb', () => {
  it('returns product when found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ title: 'Neutrogena Hydro Boost' }],
      }),
    });

    const result = await lookupUPCitemdb('123456789');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Neutrogena Hydro Boost');
    expect(result!.source).toBe('UPCitemdb');
  });

  it('returns null when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await lookupUPCitemdb('000000000');
    expect(result).toBeNull();
  });

  it('returns null when no items found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await lookupUPCitemdb('000000000');
    expect(result).toBeNull();
  });
});

describe('lookupBarcode (waterfall)', () => {
  it('returns first successful result from waterfall', async () => {
    // First call (Open Beauty Facts) succeeds
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Tretinoin Cream',
          ingredients_text: 'Tretinoin 0.025%',
        },
      }),
    });

    const result = await lookupBarcode('123456789');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Tretinoin Cream');
    expect(result!.source).toBe('Open Beauty Facts');
    // Should only have called the first source
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to next source when first fails', async () => {
    // First call (Open Beauty Facts) fails
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: 0 }),
    });
    // Second call (Open Food Facts) succeeds
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Found via Food Facts',
          ingredients_text: '',
        },
      }),
    });

    const result = await lookupBarcode('123456789');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Found via Food Facts');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns null when all sources fail', async () => {
    // All sources return not found
    mockFetch.mockResolvedValueOnce({ json: async () => ({ status: 0 }) });
    mockFetch.mockResolvedValueOnce({ json: async () => ({ status: 0 }) });
    mockFetch.mockResolvedValueOnce({ ok: false });
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await lookupBarcode('000000000');
    expect(result).toBeNull();
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await lookupBarcode('123456789');
    expect(result).toBeNull();
  });
});
