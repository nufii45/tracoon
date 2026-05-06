import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHouseholdStore } from '@/stores/household-store';
import { useInventory } from '@/features/inventory/hooks/useInventory';
import type { InventoryItem } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type FilterMode = 'all' | 'low_stock';

export default function StockScreen() {
  const household = useHouseholdStore((s) => s.currentHousehold);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // --- Form state for add/edit ---
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState('0');
  const [formUnit, setFormUnit] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data, isLoading, refetch, isRefetching, createInventoryItem, updateInventoryItem, deleteInventoryItem, isPending: isSaving } = useInventory(household?.id, undefined, filter === 'low_stock');

  function resetForm() {
    setFormName('');
    setFormQty('0');
    setFormUnit('');
    setFormLocation('');
    setFormThreshold('');
    setFormExpiry('');
    setFormNotes('');
    setEditingItem(null);
    setShowAdd(false);
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormQty(String(Number(item.quantity)));
    setFormUnit(item.unit || '');
    setFormLocation(item.location || '');
    setFormThreshold(item.low_stock_threshold != null ? String(Number(item.low_stock_threshold)) : '');
    setFormExpiry(item.expiry_date || '');
    setFormNotes(item.notes || '');
    setShowAdd(true);
  }

  function handleSave() {
    if (!formName.trim()) return;

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      quantity: parseFloat(formQty) || 0,
      unit: formUnit.trim() || null,
      location: formLocation.trim() || null,
      low_stock_threshold: formThreshold ? parseFloat(formThreshold) : null,
      expiry_date: formExpiry.trim() || null,
      notes: formNotes.trim() || null,
    };

    if (editingItem) {
      updateInventoryItem({ id: editingItem.id, data: payload }, { onSuccess: resetForm });
    } else {
      createInventoryItem(payload as any, { onSuccess: resetForm });
    }
  }

  function handleDelete(item: InventoryItem) {
    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteInventoryItem(item.id),
        },
      ],
    );
  }

  function getStockColor(item: InventoryItem) {
    if (item.is_low_stock) return colors.danger;
    if (item.low_stock_threshold != null) {
      const ratio = Number(item.quantity) / Number(item.low_stock_threshold);
      if (ratio <= 1.5) return colors.warning;
    }
    return colors.success;
  }

  function getLocationIcon(location: string | null): React.ComponentProps<typeof Ionicons>['name'] {
    if (!location) return 'cube-outline';
    const loc = location.toLowerCase();
    if (loc.includes('kitchen')) return 'restaurant-outline';
    if (loc.includes('pantry')) return 'nutrition-outline';
    if (loc.includes('bath') || loc.includes('toilet')) return 'water-outline';
    if (loc.includes('medicine') || loc.includes('med')) return 'medkit-outline';
    if (loc.includes('storage') || loc.includes('garage')) return 'file-tray-stacked-outline';
    if (loc.includes('fridge') || loc.includes('freezer')) return 'snow-outline';
    return 'cube-outline';
  }

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const stockColor = getStockColor(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
        <View style={[styles.cardIcon, { backgroundColor: `${stockColor}20` }]}>
          <Ionicons name={getLocationIcon(item.location)} size={22} color={stockColor} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardMeta}>
            {item.location && (
              <Text style={styles.cardLocation} numberOfLines={1}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} /> {item.location}
              </Text>
            )}
            {item.expiry_date && (
              <Text style={styles.cardExpiry}>
                <Ionicons name="calendar-outline" size={11} color={colors.textMuted} /> {item.expiry_date}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardQty}>
          <Text style={[styles.qtyValue, { color: stockColor }]}>
            {Number(item.quantity)}
          </Text>
          {item.unit && <Text style={styles.qtyUnit}>{item.unit}</Text>}
          {item.is_low_stock && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>LOW</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!household) {
    return (
      <View style={styles.empty}>
        <Ionicons name="home-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>Select a household first</Text>
      </View>
    );
  }

  // Filter local search if needed, API is currently handling low stock filter
  const displayedItems = search.trim()
    ? data?.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : data?.items;

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      {data && (
        <View style={styles.summary}>
          <View style={styles.summaryLeft}>
            <Ionicons name="cube" size={20} color={colors.primary} />
            <Text style={styles.summaryTotal}>{data.total_count} items</Text>
          </View>
          {data.low_stock_count > 0 && (
            <TouchableOpacity
              style={styles.lowStockBadge}
              onPress={() => setFilter(filter === 'low_stock' ? 'all' : 'low_stock')}
            >
              <Ionicons name="warning" size={14} color={colors.danger} />
              <Text style={styles.lowStockText}>{data.low_stock_count} low stock</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'low_stock' && styles.filterBtnActive]}
          onPress={() => setFilter(filter === 'low_stock' ? 'all' : 'low_stock')}
        >
          <Ionicons
            name="alert-circle"
            size={18}
            color={filter === 'low_stock' ? colors.background : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {filter === 'low_stock' ? 'No low-stock items' : 'No inventory items yet'}
              </Text>
              <Text style={styles.emptyHint}>Tap + to add your first item</Text>
            </View>
          }
        />
      )}

      {/* FAB - Rectangular with text */}
      <TouchableOpacity style={styles.fabPill} onPress={() => setShowAddMenu(true)}>
        <Ionicons name="add" size={20} color={colors.textInverse} />
        <Text style={styles.fabPillText}>Add Item</Text>
      </TouchableOpacity>

      {/* Add Options Menu Modal */}
      <Modal visible={showAddMenu} transparent animationType="fade" onRequestClose={() => setShowAddMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowAddMenu(false)}>
          <View style={styles.menuBox}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowAddMenu(false); resetForm(); setShowAdd(true); }}
            >
              <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.menuItemText}>Add Manually</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowAddMenu(false); Alert.alert("Coming Soon", "Scanner placeholder!"); }}
            >
              <Ionicons name="scan-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.menuItemText}>Scan Receipt</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Edit Item' : 'Add Item'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rice, Soap, Paracetamol"
                placeholderTextColor={colors.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={formQty}
                    onChangeText={setFormQty}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="kg, pcs, bottles..."
                    placeholderTextColor={colors.textMuted}
                    value={formUnit}
                    onChangeText={setFormUnit}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Pantry, Kitchen..."
                    placeholderTextColor={colors.textMuted}
                    value={formLocation}
                    onChangeText={setFormLocation}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Low Stock Alert</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Threshold qty"
                    placeholderTextColor={colors.textMuted}
                    value={formThreshold}
                    onChangeText={setFormThreshold}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Expiry Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={formExpiry}
                onChangeText={setFormExpiry}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textMuted}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, (!formName.trim() || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!formName.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingItem ? 'Update Item' : 'Add Item'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // Summary
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.xs,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryTotal: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  lowStockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${colors.danger}18`, paddingHorizontal: spacing.sm,
    paddingVertical: 4, borderRadius: radius.full,
  },
  lowStockText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.danger },

  // Search
  searchRow: {
    flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm, alignItems: 'center',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, height: 42,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm },
  filterBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
  },
  filterBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },

  // List
  list: { gap: spacing.sm, paddingBottom: 100 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  cardMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  cardLocation: { fontSize: fontSize.xs, color: colors.textMuted },
  cardExpiry: { fontSize: fontSize.xs, color: colors.textMuted },
  cardQty: { alignItems: 'center', minWidth: 48 },
  qtyValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  qtyUnit: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  lowBadge: {
    backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radius.full, marginTop: 3,
  },
  lowBadgeText: { fontSize: 9, fontWeight: fontWeight.bold, color: colors.textInverse, letterSpacing: 0.5 },

  // Empty
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  emptyHint: { fontSize: fontSize.sm, color: colors.textMuted },

  // FAB (Pill shaped)
  fabPill: {
    position: 'absolute', bottom: 24, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg,
    paddingVertical: 14, borderRadius: radius.full,
    elevation: 6,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabPillText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textInverse },

  // Add Menu
  menuOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 20, paddingBottom: 90 },
  menuBox: { backgroundColor: colors.surface, borderRadius: radius.lg, width: 220, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  menuItemText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: fontWeight.medium },
  menuDivider: { height: 1, backgroundColor: colors.borderLight },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  modalBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Form
  fieldLabel: {
    fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm,
  },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldHalf: { flex: 1 },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing.sm, color: colors.textPrimary, fontSize: fontSize.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, marginHorizontal: spacing.lg,
    marginTop: spacing.lg, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textInverse },
});
