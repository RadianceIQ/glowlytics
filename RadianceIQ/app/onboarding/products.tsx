import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';
import type { UsageSchedule } from '../../src/types';

// Simulated product database for search
const MOCK_PRODUCTS = [
  { name: 'CeraVe Foaming Facial Cleanser', ingredients: ['Ceramides', 'Niacinamide', 'Hyaluronic Acid'] },
  { name: 'La Roche-Posay Anthelios SPF 50', ingredients: ['Avobenzone', 'Homosalate', 'Niacinamide'] },
  { name: 'The Ordinary Niacinamide 10%', ingredients: ['Niacinamide', 'Zinc PCA'] },
  { name: 'CeraVe Moisturizing Cream', ingredients: ['Ceramides', 'Hyaluronic Acid', 'Petrolatum'] },
  { name: 'Neutrogena Hydro Boost', ingredients: ['Hyaluronic Acid', 'Glycerin', 'Dimethicone'] },
  { name: 'Paula\'s Choice BHA Exfoliant', ingredients: ['Salicylic Acid', 'Green Tea Extract'] },
  { name: 'The Ordinary Retinol 0.5%', ingredients: ['Retinol', 'Squalane', 'Jojoba Oil'] },
  { name: 'Differin Adapalene Gel', ingredients: ['Adapalene 0.1%', 'Carbomer', 'Propylene Glycol'] },
];

export default function Products() {
  const router = useRouter();
  const addProduct = useStore((s) => s.addProduct);
  const products = useStore((s) => s.products);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<typeof MOCK_PRODUCTS[0] | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const filteredProducts = searchQuery.length > 1
    ? MOCK_PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ProgressDots total={6} current={3} />

      <Text style={styles.title}>Your products</Text>
      <Text style={styles.subtitle}>
        Add your current skincare products so we can track ingredient effects.
      </Text>

      {/* Added products */}
      {products.map((p) => (
        <View key={p.user_product_id} style={styles.productCard}>
          <Text style={styles.productName}>{p.product_name}</Text>
          <Text style={styles.productIngredients}>
            {p.ingredients_list.join(', ')}
          </Text>
          <Text style={styles.productSchedule}>{p.usage_schedule}</Text>
        </View>
      ))}

      {/* Add product flow */}
      {!showSearch ? (
        <View style={styles.addButtons}>
          <Button
            title="Search product"
            variant="secondary"
            onPress={() => setShowSearch(true)}
          />
          <Button
            title="Scan barcode"
            variant="secondary"
            onPress={() => setShowSearch(true)} // Same flow for demo
            small
          />
        </View>
      ) : (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for a product..."
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />

          {filteredProducts.map((p) => (
            <TouchableOpacity
              key={p.name}
              style={[
                styles.searchResult,
                selectedProduct?.name === p.name && styles.searchResultSelected,
              ]}
              onPress={() => setSelectedProduct(p)}
            >
              <Text style={styles.searchResultName}>{p.name}</Text>
              <Text style={styles.searchResultIngredients}>
                {p.ingredients.join(', ')}
              </Text>
            </TouchableOpacity>
          ))}

          {selectedProduct && (
            <>
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
                title="Add Product"
                onPress={handleAddProduct}
                disabled={!schedule}
                style={{ marginTop: Spacing.md }}
              />
            </>
          )}

          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSelectedProduct(null);
            }}
            style={{ marginTop: Spacing.sm }}
            small
          />
        </View>
      )}

      <View style={styles.bottom}>
        <Button
          title={products.length > 0 ? 'Done' : 'Skip for now'}
          variant={products.length > 0 ? 'primary' : 'ghost'}
          onPress={() => router.push('/onboarding/baseline-scan')}
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
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  productCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  productName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  productIngredients: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  productSchedule: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  addButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  searchContainer: {
    marginTop: Spacing.md,
  },
  searchInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.sm,
  },
  searchResult: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchResultSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  searchResultName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  searchResultIngredients: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  scheduleLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  bottom: {
    marginTop: Spacing.xl,
  },
});
