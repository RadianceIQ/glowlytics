import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { useStore } from '../../src/store/useStore';
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
  const products = useStore((s) => s.products);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<typeof MOCK_PRODUCTS[0] | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const filteredProducts = searchQuery.length > 1
    ? MOCK_PRODUCTS.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      <OnboardingHero
        total={7}
        current={3}
        eyebrow="Step 4 · Routine"
        title="Add the products you’re using right now."
        subtitle="This step is optional, but it helps explain changes in your scores and recommendations."
      />

      {products.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Current routine</Text>
          {products.map((product) => (
            <View key={product.user_product_id} style={styles.productCard}>
              <Text style={styles.productName}>{product.product_name}</Text>
              <Text style={styles.productIngredients}>
                {product.ingredients_list.join(', ')}
              </Text>
              <Text style={styles.productSchedule}>{product.usage_schedule}</Text>
            </View>
          ))}
        </View>
      )}

      {!showSearch ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Choose how to add a product</Text>
          <Text style={styles.helperText}>
            Search is fastest for the prototype. Barcode and photo can follow the same path later.
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
              onPress={() => setShowSearch(true)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Search skincare products</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for a product..."
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />

          {filteredProducts.map((product) => (
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
    fontWeight: '700',
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
  productName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  productIngredients: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  productSchedule: {
    color: Colors.primaryLight,
    fontSize: FontSize.xs,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  addProductButton: {
    marginTop: Spacing.xs,
  },
  footer: {
    marginTop: Spacing.sm,
  },
});
