import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { expensesApi } from '@/api/expenses';
import { categoriesApi } from '@/api/categories';
import { useHouseholdStore } from '@/stores/household-store';
import RecurringSection from '@/components/RecurringSection';
import type { Expense, Category } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type Segment = 'expenses' | 'recurring';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const paymentMethods = [
  { key: 'cash', label: 'Cash', icon: 'cash-outline' as IoniconsName },
  { key: 'card', label: 'Card', icon: 'card-outline' as IoniconsName },
  { key: 'bank_transfer', label: 'Bank', icon: 'business-outline' as IoniconsName },
  { key: 'e_wallet', label: 'E-Wallet', icon: 'phone-portrait-outline' as IoniconsName },
  { key: 'other', label: 'Other', icon: 'ellipse-outline' as IoniconsName },
];

const emptyForm = {
  title: '', amount: '', expense_date: '', category_id: '' as string,
  description: '', payment_method: '' as string, notes: '', is_recurring: false,
};

export default function ExpensesScreen() {
  const household = useHouseholdStore((s) => s.currentHousehold);
  const queryClient = useQueryClient();

  const [segment, setSegment] = useState<Segment>('expenses');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCat, setFilterCat] = useState<string>('');

  // ── Queries ──
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', household?.id, filterCat],
    queryFn: () => expensesApi.list(household!.id, filterCat ? { category_id: filterCat } : undefined),
    enabled: !!household,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', household?.id, 'expense'],
    queryFn: () => categoriesApi.list(household!.id, 'expense'),
    enabled: !!household,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (d: Parameters<typeof expensesApi.create>[1]) =>
      expensesApi.create(household!.id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) =>
      expensesApi.update(household!.id, id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(household!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete'),
  });

  // ── Helpers ──
  const closeModal = () => { setShowModal(false); setEditingExpense(null); setForm(emptyForm); };

  const openCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ ...emptyForm, expense_date: today });
    setEditingExpense(null);
    setShowModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditingExpense(item);
    setForm({
      title: item.title,
      amount: String(item.amount),
      expense_date: String(item.expense_date),
      category_id: item.category_id || '',
      description: item.description || '',
      payment_method: item.payment_method || '',
      notes: item.notes || '',
      is_recurring: item.is_recurring,
    });
    setShowModal(true);
  };

  const handleSave = useCallback(() => {
    if (!form.title.trim() || !form.amount || !form.expense_date) return;
    const payload: any = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
    };
    if (form.category_id) payload.category_id = form.category_id;
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.payment_method) payload.payment_method = form.payment_method;
    if (form.notes.trim()) payload.notes = form.notes.trim();
    payload.is_recurring = form.is_recurring;

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, d: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, editingExpense]);

  const handleDelete = (item: Expense) => {
    Alert.alert('Delete Expense', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId || !categories) return null;
    return categories.find((c: Category) => c.id === catId)?.name || null;
  };

  // ── Render Expense Card ──
  const renderExpense = ({ item }: { item: Expense }) => {
    const pmIcon = paymentMethods.find(p => p.key === item.payment_method)?.icon || 'receipt-outline';
    const catName = getCategoryName(item.category_id);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openEdit(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardIcon}>
          <Ionicons name={pmIcon as IoniconsName} size={22} color={colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{item.expense_date}</Text>
            {catName && (
              <View style={styles.catChip}>
                <Text style={styles.catChipText}>{catName}</Text>
              </View>
            )}
            {item.is_recurring && (
              <Ionicons name="repeat" size={12} color={colors.accent} style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
        <Text style={styles.cardAmount}>
          ${Number(item.amount).toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  };

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

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSave = form.title.trim() && form.amount && form.expense_date;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Segment Toggle */}
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'expenses' && styles.segmentBtnActive]}
            onPress={() => setSegment('expenses')}
          >
            <Ionicons name="wallet" size={16} color={segment === 'expenses' ? colors.white : colors.textSecondary} />
            <Text style={[styles.segmentText, segment === 'expenses' && styles.segmentTextActive]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'recurring' && styles.segmentBtnActive]}
            onPress={() => setSegment('recurring')}
          >
            <Ionicons name="repeat" size={16} color={segment === 'recurring' ? colors.white : colors.textSecondary} />
            <Text style={[styles.segmentText, segment === 'recurring' && styles.segmentTextActive]}>Recurring</Text>
          </TouchableOpacity>
        </View>

        {segment === 'recurring' ? (
          <RecurringSection householdId={household.id} />
        ) : (
          <>
            {/* Summary */}
            {data && (
              <View style={styles.summary}>
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryLabel}>Total Spent</Text>
                  <Text style={styles.summaryAmount}>
                    ${Number(data.total_amount).toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.summaryCount}>{data.total_count} expenses</Text>
              </View>
            )}

            {/* Category filter chips */}
            {categories && categories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: spacing.xs }}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterCat && styles.filterChipActive]}
                  onPress={() => setFilterCat('')}
                >
                  <Text style={[styles.filterChipText, !filterCat && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map((c: Category) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.filterChip, filterCat === c.id && styles.filterChipActive]}
                    onPress={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                  >
                    <Text style={[styles.filterChipText, filterCat === c.id && styles.filterChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              <FlatList
                data={data?.expenses}
                keyExtractor={(item) => item.id}
                renderItem={renderExpense}
                contentContainerStyle={styles.list}
                refreshControl={
                  <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No expenses yet</Text>
                    <Text style={styles.emptySubtext}>Tap + to add your first expense</Text>
                  </View>
                }
              />
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.8}>
              <Ionicons name="add" size={28} color={colors.white} />
            </TouchableOpacity>

            {/* ══════ Create / Edit Modal ══════ */}
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={[styles.modalContent]}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {editingExpense ? 'Edit Expense' : 'New Expense'}
                    </Text>
                    <TouchableOpacity onPress={closeModal}>
                      <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>
                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.title}
                      onChangeText={(t) => setForm(f => ({ ...f, title: t }))}
                      placeholder="Groceries, Gas, Rent..."
                      placeholderTextColor={colors.textMuted}
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Amount *</Text>
                        <TextInput
                          style={styles.input}
                          value={form.amount}
                          onChangeText={(t) => setForm(f => ({ ...f, amount: t }))}
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Date *</Text>
                        <TextInput
                          style={styles.input}
                          value={form.expense_date}
                          onChangeText={(t) => setForm(f => ({ ...f, expense_date: t }))}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>

                    {/* Category Selector */}
                    {categories && categories.length > 0 && (
                      <>
                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                          <TouchableOpacity
                            style={[styles.catBtn, !form.category_id && styles.catBtnActive]}
                            onPress={() => setForm(f => ({ ...f, category_id: '' }))}
                          >
                            <Text style={[styles.catBtnText, !form.category_id && styles.catBtnTextActive]}>None</Text>
                          </TouchableOpacity>
                          {categories.map((c: Category) => (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.catBtn, form.category_id === c.id && styles.catBtnActive]}
                              onPress={() => setForm(f => ({ ...f, category_id: c.id }))}
                            >
                              <Text style={[styles.catBtnText, form.category_id === c.id && styles.catBtnTextActive]}>{c.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}

                    {/* Payment Method */}
                    <Text style={styles.label}>Payment Method</Text>
                    <View style={styles.pmRow}>
                      {paymentMethods.map((pm) => (
                        <TouchableOpacity
                          key={pm.key}
                          style={[styles.pmBtn, form.payment_method === pm.key && styles.pmBtnActive]}
                          onPress={() => setForm(f => ({ ...f, payment_method: f.payment_method === pm.key ? '' : pm.key }))}
                        >
                          <Ionicons
                            name={pm.icon}
                            size={16}
                            color={form.payment_method === pm.key ? colors.white : colors.textSecondary}
                          />
                          <Text style={[styles.pmBtnText, form.payment_method === pm.key && styles.pmBtnTextActive]}>
                            {pm.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={form.description}
                      onChangeText={(t) => setForm(f => ({ ...f, description: t }))}
                      placeholder="Optional description..."
                      placeholderTextColor={colors.textMuted}
                    />

                    <Text style={styles.label}>Notes</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={form.notes}
                      onChangeText={(t) => setForm(f => ({ ...f, notes: t }))}
                      placeholder="Additional notes..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={2}
                    />

                    {/* Recurring toggle */}
                    <TouchableOpacity
                      style={styles.toggleRow}
                      onPress={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    >
                      <Ionicons
                        name={form.is_recurring ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={form.is_recurring ? colors.primary : colors.textMuted}
                      />
                      <Text style={styles.toggleLabel}>Recurring expense</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={closeModal}>
                      <Text style={styles.btnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnPrimary, !canSave && styles.btnDisabled]}
                      onPress={handleSave}
                      disabled={!canSave || isPending}
                    >
                      {isPending ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.btnPrimaryText}>
                          {editingExpense ? 'Update' : 'Create'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },

  // Segment toggle
  segmentRow: {
    flexDirection: 'row', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 4, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.md,
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  segmentTextActive: { color: colors.white },

  // Summary
  summary: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginVertical: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  summaryMain: { marginBottom: spacing.xs },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryAmount: { fontSize: fontSize.hero, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryCount: { fontSize: fontSize.sm, color: colors.textMuted },

  // Filter
  filterRow: { marginBottom: spacing.sm, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  filterChipTextActive: { color: colors.white, fontWeight: fontWeight.semibold },

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
    backgroundColor: 'rgba(108,92,231,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  cardDate: { fontSize: fontSize.xs, color: colors.textMuted },
  catChip: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm,
    backgroundColor: 'rgba(0,206,201,0.15)',
  },
  catChipText: { fontSize: 10, color: colors.accent, fontWeight: fontWeight.medium },
  cardAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.danger },

  // Empty
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: fontWeight.medium },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textMuted },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg,
    paddingBottom: spacing.xxl, maxHeight: '90%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  // Form
  label: {
    fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm },

  // Category selector
  catBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  catBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catBtnText: { fontSize: fontSize.xs, color: colors.textSecondary },
  catBtnTextActive: { color: colors.textInverse, fontWeight: fontWeight.semibold },

  // Payment method
  pmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.md, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  pmBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pmBtnText: { fontSize: fontSize.xs, color: colors.textSecondary },
  pmBtnTextActive: { color: colors.white },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: spacing.xs,
  },
  toggleLabel: { fontSize: fontSize.sm, color: colors.textSecondary },

  // Buttons
  btnPrimary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white },
  btnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textSecondary },
  btnDisabled: { opacity: 0.5 },
});
