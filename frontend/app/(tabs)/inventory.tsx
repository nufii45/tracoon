import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

import PurchasesScreen from '../purchases/index';
import StockScreen from '../inventory/index';

type Segment = 'stock' | 'purchases';

export default function InventoryTab() {
  const [segment, setSegment] = useState<Segment>('stock');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
      </View>

      {/* Segment Tabs */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'stock' && styles.segmentBtnActive]}
          onPress={() => setSegment('stock')}
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color={segment === 'stock' ? colors.neutral : colors.textSecondary}
          />
          <Text style={[styles.segmentText, segment === 'stock' && styles.segmentTextActive]}>
            Stock
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'purchases' && styles.segmentBtnActive]}
          onPress={() => setSegment('purchases')}
        >
          <Ionicons
            name="cart-outline"
            size={16}
            color={segment === 'purchases' ? colors.neutral : colors.textSecondary}
          />
          <Text style={[styles.segmentText, segment === 'purchases' && styles.segmentTextActive]}>
            Purchases
          </Text>
        </TouchableOpacity>
      </View>

      {/* Render selected screen */}
      {segment === 'purchases' ? (
        <View style={{ flex: 1, marginTop: -spacing.md }}>
          <PurchasesScreen />
        </View>
      ) : (
        <View style={{ flex: 1, marginTop: -spacing.md }}>
          <StockScreen />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.tertiary },

  // Segments
  segmentRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs,
    marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
  },
  segmentBtnActive: { backgroundColor: colors.tertiary, borderColor: colors.tertiary },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  segmentTextActive: { color: colors.neutral },
});
