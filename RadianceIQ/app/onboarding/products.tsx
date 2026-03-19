import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { useStore } from '../../src/store/useStore';
import { lookupBarcode, searchOpenBeautyFacts } from '../../src/services/productLookup';
import { computeProductEffectiveness } from '../../src/services/ingredientDB';
import { trackEvent } from '../../src/services/analytics';
import type { UsageSchedule } from '../../src/types';

const MOCK_PRODUCTS = [
  { name: 'CeraVe Foaming Facial Cleanser', ingredients: ['Ceramides', 'Niacinamide', 'Hyaluronic Acid'] },
  { name: 'La Roche-Posay Anthelios SPF 50', ingredients: ['Avobenzone', 'Homosalate', 'Niacinamide'] },
  { name: 'The Ordinary Niacinamide 10%', ingredients: ['Niacinamide', 'Zinc PCA'] },
  { name: 'CeraVe Moisturizing Cream', ingredients: ['Ceramides', 'Hyaluronic Acid', 'Petrolatum'] },
  { name: 'Neutrogena Hydro Boost', ingredients: ['Hyaluronic Acid', 'Glycerin', 'Dimethicone'] },
  { name: "Paula's Choice BHA Exfoliant", ingredients: ['Salicylic Acid', 'Green Tea Extract'] },
  { name: 'The Ordinary Retinol 0.5%', ingredients: ['Retinol', 'Squalane', 'Jojoba Oil'] },
  { name: 'Differin Adapalene Gel', ingredients: ['Adapalene 0.1%', 'Carbomer', 'Propylene Glycol'] },
];

export default function Products() {
  const router = useRouter();
  const addProduct = useStore((s) => s.addProduct);
  const removeProduct = useStore((s) => s.removeProduct);
  const products = useStore((s) => s.products);
  const protocol = useStore((s) => s.protocol);

  const [permission, requestPermission] = useCameraPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<typeof MOCK_PRODUCTS[0] | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<typeof MOCK_PRODUCTS[0] | null>(null);
  const [scanNotFound, setScanNotFound] = useState(false);
  const processingRef = useRef(false);
  const [manualName, setManualName] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; ingredients: string[] }>>([]);
  const [searching, setSearching] = useState(false);

  const filteredProducts = searchQuery.length > 1
    ? MOCK_PRODUCTS.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const allSearchResults = [
    ...filteredProducts,
    ...searchResults.filter(
      (r) => !filteredProducts.some((fp) => fp.name === r.name)
    ),
  ];

  const handleAddProduct = () => {
    if (!selectedProduct || !schedule) return;

    addProduct({
      product_name: selectedProduct.name,
      product_capture_method: 'search',
      ingredients_list: selectedProduct.ingredients,
      usage_schedule: schedule as UsageSchedule,
      start_date: new Date().toISOString().split('T')[0],
    });

    setSelectedProduct(null);
    setSchedule(null);
    setSearchQuery('');
    setShowSearch(false);
    setShowBarcodeScanner(false);
    setScannedBarcode(null);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setScannedBarcode(data);
    setShowBarcodeScanner(false);
    setScanNotFound(false);

    const result = await lookupBarcode(data);
    if (result) {
      setScannedProduct({
        name: result.name,
        ingredients: result.ingredients,
      });
    } else {
      setScanNotFound(true);
    }
    processingRef.current = false;
  };

  const handleTextSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchOpenBeautyFacts(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    setScannedProduct({
      name: manualName.trim(),
      ingredients: manualIngredients
        ? manualIngredients.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    });
    setShowManualEntry(false);
    setScanNotFound(false);
    setManualName('');
    setManualIngredients('');
  };

  const handleOpenBarcodeScanner = async () => {
    if (!permission) return;

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to scan barcodes.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setScannedBarcode(null);
    setShowBarcodeScanner(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <OnboardingHero
        total={7}
        current={3}
        eyebrow="Step 4 · Routine"
        title="Add the products you’re using right now."
        subtitle="This step is optional, but it helps explain changes in your scores and recommendations."
      />

      {!showSearch && !showBarcodeScanner && !scannedProduct && !scanNotFound ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Choose how to add a product</Text>
          <Text style={styles.helperText}>
            Scan a barcode or search by product name.
          </Text>
          <View style={styles.addButtons}>
            <Button
              title="Search product"
              variant="secondary"
              onPress={() => setShowSearch(true)}
            />
            <Button
              title="Scan barcode"
              variant="ghost"
              onPress={handleOpenBarcodeScanner}
            />
          </View>
        </View>
      ) : showBarcodeScanner ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Scan product barcode</Text>
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>Position barcode within the frame</Text>
              </View>
            </CameraView>
          </View>
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setShowBarcodeScanner(false);
              setScannedBarcode(null);
            }}
          />
        </View>
      ) : scannedProduct ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Product found</Text>
          <View style={styles.scannedProductCard}>
            <Text style={styles.scannedProductName}>{scannedProduct.name}</Text>
            <Text style={styles.scannedProductIngredients}>
              {scannedProduct.ingredients.join(', ')}
            </Text>
            {scannedBarcode && (
              <Text style={styles.scannedBarcode}>Barcode: {scannedBarcode}</Text>
            )}
          </View>
          <View style={styles.scheduleSection}>
            <Text style={styles.scheduleLabel}>When do you use it?</Text>
            <OptionSelector
              options={[
                { label: 'AM', value: 'AM' },
                { label: 'PM', value: 'PM' },
                { label: 'Both', value: 'both' },
              ]}
              selected={schedule}
              onSelect={setSchedule}
              horizontal
            />
            <Button
              title="Add product"
              onPress={() => {
                if (!schedule) return;
                addProduct({
                  product_name: scannedProduct.name,
                  product_capture_method: 'barcode',
                  ingredients_list: scannedProduct.ingredients,
                  usage_schedule: schedule as UsageSchedule,
                  start_date: new Date().toISOString().split('T')[0],
                });
                setScannedProduct(null);
                setScannedBarcode(null);
                setSchedule(null);
                processingRef.current = false;
              }}
              disabled={!schedule}
              style={styles.addProductButton}
            />
          </View>
          <View style={styles.scannedActions}>
            <Button
              title="Scan again"
              variant="secondary"
              onPress={() => {
                setScannedProduct(null);
                setScannedBarcode(null);
                setSchedule(null);
                processingRef.current = false;
                setShowBarcodeScanner(true);
              }}
            />
            <Button
              title="Back"
              variant="ghost"
              onPress={() => {
                setScannedProduct(null);
                setScannedBarcode(null);
                setSchedule(null);
                processingRef.current = false;
              }}
            />
          </View>
        </View>
      ) : scanNotFound && !showManualEntry ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Product not found</Text>
          <View style={styles.scannedProductCard}>
            <Text style={styles.notFoundText}>
              We couldn't find a product matching this barcode. Try scanning again, search by name, or enter manually.
            </Text>
            {scannedBarcode && (
              <Text style={styles.scannedBarcode}>Barcode: {scannedBarcode}</Text>
            )}
          </View>
          <View style={styles.scannedActions}>
            <Button
              title="Scan again"
              variant="secondary"
              onPress={() => {
                setScanNotFound(false);
                setScannedBarcode(null);
                processingRef.current = false;
                setShowBarcodeScanner(true);
              }}
            />
            <Button
              title="Search by name"
              variant="secondary"
              onPress={() => {
                setScanNotFound(false);
                setScannedBarcode(null);
                processingRef.current = false;
                setShowSearch(true);
              }}
            />
            <Button
              title="Enter manually"
              variant="secondary"
              onPress={() => setShowManualEntry(true)}
            />
            <Button
              title="Back"
              variant="ghost"
              onPress={() => {
                setScanNotFound(false);
                setScannedBarcode(null);
                processingRef.current = false;
              }}
            />
          </View>
        </View>
      ) : showManualEntry ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Enter product manually</Text>
          <TextInput
            style={styles.searchInput}
            value={manualName}
            onChangeText={setManualName}
            placeholder="Product name"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          <TextInput
            style={styles.searchInput}
            value={manualIngredients}
            onChangeText={setManualIngredients}
            placeholder="Ingredients (comma-separated, optional)"
            placeholderTextColor={Colors.textMuted}
          />
          <Button
            title="Add product"
            onPress={handleManualAdd}
            disabled={!manualName.trim()}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setShowManualEntry(false);
              setScanNotFound(false);
              setManualName('');
              setManualIngredients('');
              processingRef.current = false;
            }}
          />
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Search skincare products</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              handleTextSearch(text);
            }}
            placeholder="Search for a product..."
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />

          {searching && (
            <View style={{ paddingVertical: Spacing.sm, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.helperText}>Searching online databases...</Text>
            </View>
          )}

          {allSearchResults.map((product) => (
            <TouchableOpacity
              key={product.name}
              style={[
                styles.searchResult,
                selectedProduct?.name === product.name && styles.searchResultSelected,
              ]}
              onPress={() => setSelectedProduct(product)}
            >
              <Text style={styles.searchResultName}>{product.name}</Text>
              <Text style={styles.searchResultIngredients}>
                {product.ingredients.join(', ')}
              </Text>
            </TouchableOpacity>
          ))}

          {selectedProduct && (
            <View style={styles.scheduleSection}>
              <Text style={styles.scheduleLabel}>When do you use it?</Text>
              <OptionSelector
                options={[
                  { label: 'AM', value: 'AM' },
                  { label: 'PM', value: 'PM' },
                  { label: 'Both', value: 'both' },
                ]}
                selected={schedule}
                onSelect={setSchedule}
                horizontal
              />
              <Button
                title="Add product"
                onPress={handleAddProduct}
                disabled={!schedule}
                style={styles.addProductButton}
              />
            </View>
          )}

          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSelectedProduct(null);
              setSchedule(null);
            }}
          />
        </View>
      )}

      {products.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your Products</Text>
          {products.map((product) => {
            const effectiveness = protocol?.primary_goal
              ? computeProductEffectiveness(product, protocol.primary_goal)
              : null;
            const badgeColor = effectiveness
              ? effectiveness.score >= 75 ? '#34A77B'
                : effectiveness.score >= 55 ? Colors.primary
                : effectiveness.score >= 35 ? Colors.warning
                : Colors.error
              : null;

            return (
              <TouchableOpacity
                key={product.user_product_id}
                style={styles.productCard}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.user_product_id } })}
              >
                <View style={styles.productCardHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.productName} numberOfLines={1}>{product.product_name}</Text>
                    {effectiveness && badgeColor && (
                      <View style={[styles.effectivenessPill, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
                        <Text style={[styles.effectivenessLabel, { color: badgeColor }]}>{effectiveness.score}%</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      trackEvent('product_removed', { product_name: product.product_name });
                      removeProduct(product.user_product_id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.productIngredients}>
                  {product.ingredients_list.join(', ')}
                </Text>
                <Text style={styles.productSchedule}>{product.usage_schedule}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <Button
          title={products.length > 0 ? 'Continue' : 'Skip for now'}
          variant={products.length > 0 ? 'primary' : 'ghost'}
          onPress={() => router.push('/onboarding/permissions')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  productCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: 4,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  productIngredients: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  productSchedule: {
    color: Colors.primaryLight,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansBold,
    textTransform: 'uppercase',
  },
  addButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchResult: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  searchResultSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  searchResultName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  searchResultIngredients: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  scheduleSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  scheduleLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  addProductButton: {
    marginTop: Spacing.xs,
  },
  scannedProductCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  scannedProductName: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  scannedProductIngredients: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  scannedBarcode: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  notFoundText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  scannedActions: {
    gap: Spacing.xs,
  },
  cameraContainer: {
    width: '100%',
    height: 400,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  scannerFrame: {
    width: 250,
    height: 150,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  effectivenessPill: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  effectivenessLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
  },
  footer: {
    marginTop: Spacing.sm,
  },
});
