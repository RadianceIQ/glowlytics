import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../constants/theme';
import { useStore } from '../store/useStore';
import { lookupBarcode, searchOpenBeautyFacts } from '../services/productLookup';
import { trackEvent } from '../services/analytics';
import type { UsageSchedule } from '../types';

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

interface Props {
  visible: boolean;
  onClose: () => void;
}

type SheetMode = 'menu' | 'search' | 'barcode' | 'manual' | 'schedule';

interface SelectedProduct {
  name: string;
  ingredients: string[];
  brand?: string;
}

export const AddProductSheet: React.FC<Props> = ({ visible, onClose }) => {
  const addProduct = useStore((s) => s.addProduct);
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<SheetMode>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; ingredients: string[] }>>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedProduct | null>(null);
  const [schedule, setSchedule] = useState<UsageSchedule>('AM');
  const [manualName, setManualName] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [barcodeFound, setBarcodeFound] = useState(false);
  const processingRef = useRef(false);

  const resetState = () => {
    setMode('menu');
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
    setSelected(null);
    setSchedule('AM');
    setManualName('');
    setManualIngredients('');
    setBarcodeFound(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchOpenBeautyFacts(query);
      const localResults = MOCK_PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      );
      const combined = [...localResults];
      for (const r of results) {
        if (!combined.some((c) => c.name === r.name)) combined.push(r);
      }
      const finalResults = combined.slice(0, 10);
      setSearchResults(finalResults);
      trackEvent('product_searched', { query, result_count: finalResults.length });
    } catch {
      const localResults = MOCK_PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      );
      setSearchResults(localResults);
    }
    setSearching(false);
  };

  const handleSelectResult = (product: { name: string; ingredients: string[] }) => {
    setSelected({ name: product.name, ingredients: product.ingredients });
    setMode('schedule');
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setBarcodeFound(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const result = await lookupBarcode(barcode);
      if (result) {
        trackEvent('product_barcode_scanned', { found: true });
        setSelected({ name: result.name, ingredients: result.ingredients });
        setMode('schedule');
      } else {
        trackEvent('product_barcode_scanned', { found: false });
        setBarcodeFound(false);
        Alert.alert('Not found', 'Product not found. Try searching by name or enter manually.');
        setMode('menu');
      }
    } catch {
      setBarcodeFound(false);
      Alert.alert('Error', 'Could not look up barcode.');
      setMode('menu');
    }
    processingRef.current = false;
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    const ingredients = manualIngredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setSelected({ name: manualName.trim(), ingredients });
    setMode('schedule');
  };

  const handleConfirmAdd = () => {
    if (!selected) return;
    const captureMethod = mode === 'barcode' ? 'barcode' : 'search';
    addProduct({
      product_name: selected.name,
      brand: selected.brand,
      product_capture_method: captureMethod,
      ingredients_list: selected.ingredients,
      usage_schedule: schedule,
      start_date: new Date().toISOString().split('T')[0],
    });
    trackEvent('product_added', { product_name: selected.name, capture_method: captureMethod, schedule });
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {mode === 'menu' ? 'Add Product' :
               mode === 'search' ? 'Search Products' :
               mode === 'barcode' ? 'Scan Barcode' :
               mode === 'manual' ? 'Enter Manually' :
               'Usage Schedule'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Feather name="x" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetContent}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mode === 'menu' && (
              <View style={styles.menuOptions}>
                <TouchableOpacity style={styles.menuOption} onPress={() => setMode('search')}>
                  <View style={styles.menuIconWrap}>
                    <Feather name="search" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text style={styles.menuLabel}>Search by name</Text>
                    <Text style={styles.menuDesc}>Find from our database</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={async () => {
                    if (!permission?.granted) await requestPermission();
                    setBarcodeFound(false);
                    setMode('barcode');
                  }}
                >
                  <View style={styles.menuIconWrap}>
                    <Feather name="maximize" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text style={styles.menuLabel}>Scan barcode</Text>
                    <Text style={styles.menuDesc}>Use your camera</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuOption} onPress={() => setMode('manual')}>
                  <View style={styles.menuIconWrap}>
                    <Feather name="edit-3" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text style={styles.menuLabel}>Enter manually</Text>
                    <Text style={styles.menuDesc}>Type name and ingredients</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {mode === 'search' && (
              <View style={styles.searchMode}>
                <View style={styles.searchInputRow}>
                  <Feather name="search" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    placeholderTextColor={Colors.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                      <Feather name="x-circle" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {searching && <ActivityIndicator style={{ marginTop: 16 }} color={Colors.primary} />}
                {searchResults.map((r, i) => (
                  <TouchableOpacity
                    key={`${r.name}-${i}`}
                    style={styles.resultRow}
                    onPress={() => handleSelectResult(r)}
                  >
                    <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.resultMeta}>{r.ingredients.length} ingredients</Text>
                  </TouchableOpacity>
                ))}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <Text style={styles.noResults}>No results found. Try a different search or enter manually.</Text>
                )}
              </View>
            )}

            {mode === 'barcode' && (
              <View style={styles.barcodeMode}>
                {permission?.granted ? (
                  <View style={styles.cameraBox}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                      onBarcodeScanned={(result) => handleBarcodeScan(result.data)}
                    />
                    <View style={styles.cameraOverlay}>
                      <View style={[
                        styles.scanFrame,
                        barcodeFound && styles.scanFrameFound,
                      ]} />
                      {barcodeFound && (
                        <View style={styles.scanFeedback}>
                          <Feather name="check-circle" size={28} color={Colors.success} />
                          <Text style={styles.scanFeedbackText}>Barcode detected</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noResults}>Camera permission required to scan barcodes.</Text>
                )}
              </View>
            )}

            {mode === 'manual' && (
              <View style={styles.manualMode}>
                <Text style={styles.fieldLabel}>Product name</Text>
                <TextInput
                  style={styles.textField}
                  placeholder="e.g. CeraVe Moisturizer"
                  placeholderTextColor={Colors.textMuted}
                  value={manualName}
                  onChangeText={setManualName}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>Ingredients (comma-separated)</Text>
                <TextInput
                  style={[styles.textField, styles.textFieldMulti]}
                  placeholder="e.g. Niacinamide, Hyaluronic Acid, Ceramides"
                  placeholderTextColor={Colors.textMuted}
                  value={manualIngredients}
                  onChangeText={setManualIngredients}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.confirmButton, !manualName.trim() && styles.confirmButtonDisabled]}
                  onPress={handleManualAdd}
                  disabled={!manualName.trim()}
                >
                  <Text style={styles.confirmText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === 'schedule' && selected && (
              <View style={styles.scheduleMode}>
                <Text style={styles.selectedName}>{selected.name}</Text>
                <Text style={styles.selectedMeta}>{selected.ingredients.length} ingredients</Text>

                <Text style={styles.fieldLabel}>When do you use this product?</Text>
                <View style={styles.scheduleOptions}>
                  {(['AM', 'PM', 'both'] as UsageSchedule[]).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.scheduleChip, schedule === s && styles.scheduleChipActive]}
                      onPress={() => setSchedule(s)}
                    >
                      <Text style={[styles.scheduleChipText, schedule === s && styles.scheduleChipTextActive]}>
                        {s === 'both' ? 'AM & PM' : s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmAdd}>
                  <Text style={styles.confirmText}>Add Product</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  menuOptions: {
    gap: Spacing.sm,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  menuDesc: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  searchMode: {
    gap: Spacing.sm,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.md,
  },
  resultRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 2,
  },
  resultName: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  resultMeta: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  noResults: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  barcodeMode: {
    alignItems: 'center',
  },
  cameraBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
  },
  scanFrameFound: {
    borderColor: Colors.success,
    borderWidth: 3,
  },
  scanFeedback: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  scanFeedbackText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  manualMode: {
    gap: Spacing.md,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  textField: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.md,
    height: 48,
  },
  textFieldMulti: {
    height: 90,
    textAlignVertical: 'top',
  },
  scheduleMode: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  selectedName: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  selectedMeta: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  scheduleOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  scheduleChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glass,
  },
  scheduleChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceOverlay,
  },
  scheduleChipText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  scheduleChipTextActive: {
    color: Colors.primary,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.md,
  },
});
