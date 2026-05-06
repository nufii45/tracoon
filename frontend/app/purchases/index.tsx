import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { purchasesApi } from '@/api/purchases';
import { useHouseholdStore } from '@/stores/household-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { usePurchases } from '@/features/purchases/hooks/usePurchases';
import type { Purchase } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'e_wallet', 'other'] as const;
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank', e_wallet: 'E-Wallet', other: 'Other',
};

export default function PurchasesScreen() {
  const household = useHouseholdStore((s) => s.currentHousehold);
  const sym = useCurrencyStore((s) => s.currency.symbol);
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  // Form state
  const [storeName, setStoreName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');

  // Item form state
  const [items, setItems] = useState<Array<{ name: string; quantity: string; unit: string; unit_price: string; total_price: string }>>([]);

  const { data, isLoading, refetch, isRefetching, createPurchase, updatePurchase, deletePurchase, isPending: isSaving } = usePurchases(household?.id);

  function resetForm() {
    setStoreName(''); setPurchaseDate(new Date().toISOString().slice(0, 10));
    setTotalAmount(''); setPaymentMethod('cash'); setReceiptRef('');
    setNotes(''); setItems([]); setEditingPurchase(null); setShowModal(false);
  }

  function openEdit(p: Purchase) {
    setEditingPurchase(p);
    setStoreName(p.store_name || '');
    setPurchaseDate(p.purchase_date);
    setTotalAmount(String(Number(p.total_amount)));
    setPaymentMethod(p.payment_method || 'cash');
    setReceiptRef(p.receipt_reference || '');
    setNotes(p.notes || '');
    setItems([]);
    setShowModal(true);
  }

  function handleSave() {
    const amt = parseFloat(totalAmount);
    if (!amt || amt < 0) return;
    const itemPayloads = items
      .filter((i) => i.name.trim() && parseFloat(i.total_price) >= 0)
      .map((i) => ({
        name: i.name.trim(),
        quantity: parseFloat(i.quantity) || 1,
        unit: i.unit.trim() || undefined,
        unit_price: i.unit_price ? parseFloat(i.unit_price) : undefined,
        total_price: parseFloat(i.total_price) || 0,
      }));

    if (editingPurchase) {
      updatePurchase({
        id: editingPurchase.id,
        data: {
          store_name: storeName.trim() || null,
          purchase_date: purchaseDate,
          total_amount: amt,
          payment_method: paymentMethod,
          receipt_reference: receiptRef.trim() || null,
          notes: notes.trim() || null,
        },
      }, { onSuccess: resetForm });
    } else {
      createPurchase({
        store_name: storeName.trim() || undefined,
        purchase_date: purchaseDate,
        total_amount: amt,
        payment_method: paymentMethod,
        receipt_reference: receiptRef.trim() || undefined,
        notes: notes.trim() || undefined,
        items: itemPayloads.length > 0 ? itemPayloads : undefined,
      }, { onSuccess: resetForm });
    }
  }

  function handleDelete(p: Purchase) {
    Alert.alert('Delete Purchase', `Remove this ${p.store_name || ''} purchase?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePurchase(p.id) },
    ]);
  }

  function addItemRow() {
    setItems([...items, { name: '', quantity: '1', unit: '', unit_price: '', total_price: '0' }]);
  }

  function updateItemRow(idx: number, field: string, value: string) {
    const copy = [...items];
    (copy[idx] as any)[field] = value;
    setItems(copy);
  }

  function removeItemRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function getPaymentIcon(method: string | null): React.ComponentProps<typeof Ionicons>['name'] {
    switch (method) {
      case 'cash': return 'cash-outline';
      case 'card': return 'card-outline';
      case 'bank_transfer': return 'business-outline';
      case 'e_wallet': return 'phone-portrait-outline';
      default: return 'receipt-outline';
    }
  }

  const renderPurchase = ({ item: p }: { item: Purchase }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(p)} onLongPress={() => handleDelete(p)}>
      <View style={[styles.cardIcon, { backgroundColor: `${colors.accent}20` }]}>
        <Ionicons name={getPaymentIcon(p.payment_method)} size={22} color={colors.accent} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{p.store_name || 'Purchase'}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>
            <Ionicons name="calendar-outline" size={11} color={colors.textMuted} /> {p.purchase_date}
          </Text>
          {p.item_count > 0 && (
            <Text style={styles.cardItems}>{p.item_count} item{p.item_count !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {p.payment_method && (
          <View style={styles.payChip}>
            <Text style={styles.payChipText}>{PAYMENT_LABELS[p.payment_method] || p.payment_method}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardAmount}>{sym}{Number(p.total_amount).toFixed(2)}</Text>
    </TouchableOpacity>
  );

  if (!household) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Ionicons name="home-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Select a household first</Text>
        </View>
      </SafeAreaView>
    );
  }



  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Summary */}
        {data && (
          <View style={styles.summary}>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryValue}>{sym}{Number(data.total_amount).toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Total Spent</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryValue}>{data.total_count}</Text>
              <Text style={styles.summaryLabel}>Purchases</Text>
            </View>
          </View>
        )}

        {/* List */}
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={data?.purchases}
            keyExtractor={(p) => p.id}
            renderItem={renderPurchase}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No purchases yet</Text>
                <Text style={styles.emptyHint}>Tap + to log your first purchase</Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setShowModal(true); }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Create/Edit Modal */}
        <Modal visible={showModal} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingPurchase ? 'Edit Purchase' : 'New Purchase'}</Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Store Name</Text>
                <TextInput style={styles.input} placeholder="e.g. Walmart, Costco" placeholderTextColor={colors.textMuted} value={storeName} onChangeText={setStoreName} />

                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Date *</Text>
                    <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={purchaseDate} onChangeText={setPurchaseDate} />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Total *</Text>
                    <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={colors.textMuted} value={totalAmount} onChangeText={setTotalAmount} keyboardType="numeric" />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Payment Method</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {PAYMENT_METHODS.map((m) => (
                    <TouchableOpacity key={m} style={[styles.chip, paymentMethod === m && styles.chipActive]} onPress={() => setPaymentMethod(m)}>
                      <Ionicons name={getPaymentIcon(m)} size={14} color={paymentMethod === m ? colors.white : colors.textSecondary} />
                      <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>{PAYMENT_LABELS[m]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Receipt Reference</Text>
                <TextInput style={styles.input} placeholder="Receipt # or reference" placeholderTextColor={colors.textMuted} value={receiptRef} onChangeText={setReceiptRef} />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.inputMulti]} placeholder="Any notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline numberOfLines={2} />

                {/* Inline Items (create only) */}
                {!editingPurchase && (
                  <>
                    <View style={styles.itemsHeader}>
                      <Text style={styles.fieldLabel}>Items</Text>
                      <TouchableOpacity onPress={addItemRow} style={styles.addItemBtn}>
                        <Ionicons name="add-circle" size={20} color={colors.primary} />
                        <Text style={styles.addItemText}>Add Item</Text>
                      </TouchableOpacity>
                    </View>
                    {items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemRowTop}>
                          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Item name" placeholderTextColor={colors.textMuted} value={item.name} onChangeText={(v) => updateItemRow(idx, 'name', v)} />
                          <TouchableOpacity onPress={() => removeItemRow(idx)} style={styles.removeItemBtn}>
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.fieldRow}>
                          <View style={{ flex: 1 }}>
                            <TextInput style={styles.input} placeholder="Qty" placeholderTextColor={colors.textMuted} value={item.quantity} onChangeText={(v) => updateItemRow(idx, 'quantity', v)} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput style={styles.input} placeholder="Unit" placeholderTextColor={colors.textMuted} value={item.unit} onChangeText={(v) => updateItemRow(idx, 'unit', v)} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput style={styles.input} placeholder="Price" placeholderTextColor={colors.textMuted} value={item.total_price} onChangeText={(v) => updateItemRow(idx, 'total_price', v)} keyboardType="numeric" />
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, (!totalAmount || isSaving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!totalAmount || isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.saveBtnText}>{editingPurchase ? 'Update Purchase' : 'Save Purchase'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },

  summary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  summaryBlock: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.borderLight },

  list: { gap: spacing.sm, paddingBottom: 100, paddingTop: spacing.sm },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  cardMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  cardDate: { fontSize: fontSize.xs, color: colors.textMuted },
  cardItems: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.accent },
  payChip: {
    alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, marginTop: 4,
  },
  payChipText: { fontSize: 10, color: colors.textSecondary, fontWeight: fontWeight.medium },

  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  emptyHint: { fontSize: fontSize.sm, color: colors.textMuted },

  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, paddingBottom: spacing.xl, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  modalBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldHalf: { flex: 1 },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing.sm, color: colors.textPrimary, fontSize: fontSize.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },

  chipRow: { marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated, marginRight: spacing.xs,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  chipTextActive: { color: colors.white },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
  itemRow: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs },
  itemRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  removeItemBtn: { padding: 4 },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, marginHorizontal: spacing.lg,
    marginTop: spacing.lg, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textInverse },
});
