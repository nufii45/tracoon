import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { budgetsApi } from '@/api/budgets';
import { categoriesApi } from '@/api/categories';
import { useHouseholdStore } from '@/stores/household-store';
import { useCurrencyStore } from '@/stores/currency-store';
import type { Budget, Category } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

const emptyForm = {
  name: '', amount: '', period_start: '', period_end: '',
  category_id: '' as string, description: '',
};

function getProgressColor(pct: number) {
  if (pct >= 90) return colors.danger;
  if (pct >= 70) return colors.warning;
  return colors.success;
}

export default function BudgetsScreen() {
  const household = useHouseholdStore((s) => s.currentHousehold);
  const sym = useCurrencyStore((s) => s.currency.symbol);
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ── Queries ──
  const { data: budgets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['budgets', household?.id],
    queryFn: () => budgetsApi.list(household!.id),
    enabled: !!household,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', household?.id, 'budget'],
    queryFn: () => categoriesApi.list(household!.id, 'budget'),
    enabled: !!household,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (d: Parameters<typeof budgetsApi.create>[1]) =>
      budgetsApi.create(household!.id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) =>
      budgetsApi.update(household!.id, id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(household!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete'),
  });

  // ── Helpers ──
  const closeModal = () => { setShowModal(false); setEditingBudget(null); setForm(emptyForm); };

  const openCreate = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setForm({ ...emptyForm, period_start: start, period_end: end });
    setEditingBudget(null);
    setShowModal(true);
  };

  const openEdit = (item: Budget) => {
    setEditingBudget(item);
    setForm({
      name: item.name,
      amount: String(item.amount),
      period_start: String(item.period_start),
      period_end: String(item.period_end),
      category_id: item.category_id || '',
      description: item.description || '',
    });
    setShowModal(true);
  };

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.amount || !form.period_start || !form.period_end) return;
    const payload: any = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      period_start: form.period_start,
      period_end: form.period_end,
    };
    if (form.category_id) payload.category_id = form.category_id;
    if (form.description.trim()) payload.description = form.description.trim();

    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, d: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, editingBudget]);

  const handleDelete = (item: Budget) => {
    Alert.alert('Delete Budget', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  };

  // ── Overall summary ──
  const totalBudget = budgets?.reduce((s: number, b: Budget) => s + (Number(b.amount) || 0), 0) || 0;

  // Deduplicate spent: multiple budgets sharing the same category (or no category)
  // track the same expenses, so only count each bucket once.
  const seenCategories = new Set<string>();
  let totalSpent = 0;
  budgets?.forEach((b: Budget) => {
    const key = b.category_id || '__uncategorized__';
    if (!seenCategories.has(key)) {
      seenCategories.add(key);
      totalSpent += Number(b.spent) || 0;
    }
  });

  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // ── Render Budget Card ──
  const renderBudget = ({ item }: { item: Budget }) => {
    const pctClamped = Math.min(item.percentage_used, 100);
    const barColor = getProgressColor(item.percentage_used);
    const isOver = item.percentage_used > 100;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openEdit(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, isOver && { backgroundColor: 'rgba(255,107,107,0.15)' }]}>
            <Ionicons
              name={isOver ? 'warning' : 'pie-chart'}
              size={20}
              color={isOver ? colors.danger : colors.primary}
            />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardPeriod}>
              {item.period_start} → {item.period_end}
            </Text>
          </View>
          <View style={styles.pctBadge}>
            <Text style={[styles.pctText, { color: barColor }]}>
              {item.percentage_used}%
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pctClamped}%`, backgroundColor: barColor }]} />
        </View>

        {/* Amounts */}
        <View style={styles.amounts}>
          <View>
            <Text style={styles.amountLabel}>Spent</Text>
            <Text style={[styles.amountValue, { color: barColor }]}>
              {sym}{(Number(item.spent) || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.amountCenter}>
            <Text style={styles.amountLabel}>Budget</Text>
            <Text style={styles.amountValue}>
              {sym}{(Number(item.amount) || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.amountRight}>
            <Text style={styles.amountLabel}>Remaining</Text>
            <Text style={[styles.amountValue, { color: (Number(item.remaining) || 0) < 0 ? colors.danger : colors.success }]}>
              {sym}{(Number(item.remaining) || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {item.expense_count > 0 && (
          <Text style={styles.expenseCount}>
            {item.expense_count} expense{item.expense_count !== 1 ? 's' : ''} tracked
          </Text>
        )}
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
  const canSave = form.name.trim() && form.amount && form.period_start && form.period_end;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Overall Summary */}
        {budgets && budgets.length > 0 && (
          <View style={styles.overallSummary}>
            <View style={styles.overallRow}>
              <View style={styles.overallStat}>
                <Text style={styles.overallLabel}>Total Budget</Text>
                <Text style={styles.overallValue}>{sym}{totalBudget.toFixed(2)}</Text>
              </View>
              <View style={styles.overallDivider} />
              <View style={styles.overallStat}>
                <Text style={styles.overallLabel}>Total Spent</Text>
                <Text style={[styles.overallValue, { color: getProgressColor(overallPct) }]}>
                  {sym}{totalSpent.toFixed(2)}
                </Text>
              </View>
              <View style={styles.overallDivider} />
              <View style={styles.overallStat}>
                <Text style={styles.overallLabel}>Used</Text>
                <Text style={[styles.overallValue, { color: getProgressColor(overallPct) }]}>
                  {overallPct}%
                </Text>
              </View>
            </View>
            <View style={styles.overallTrack}>
              <View style={[styles.overallFill, {
                width: `${Math.min(overallPct, 100)}%`,
                backgroundColor: getProgressColor(overallPct),
              }]} />
            </View>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={budgets}
            keyExtractor={(item) => item.id}
            renderItem={renderBudget}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="pie-chart-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No budgets yet</Text>
                <Text style={styles.emptySubtext}>Tap + to create your first budget</Text>
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
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingBudget ? 'Edit Budget' : 'New Budget'}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(t) => setForm(f => ({ ...f, name: t }))}
                  placeholder="Monthly Groceries, Rent..."
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Budget Amount *</Text>
                <TextInput
                  style={styles.input}
                  value={form.amount}
                  onChangeText={(t) => setForm(f => ({ ...f, amount: t }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start Date *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.period_start}
                      onChangeText={(t) => setForm(f => ({ ...f, period_start: t }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>End Date *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.period_end}
                      onChangeText={(t) => setForm(f => ({ ...f, period_end: t }))}
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

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={form.description}
                  onChangeText={(t) => setForm(f => ({ ...f, description: t }))}
                  placeholder="Optional description..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                />
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
                      {editingBudget ? 'Update' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // Overall Summary
  overallSummary: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  overallRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  overallStat: { flex: 1, alignItems: 'center' },
  overallLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  overallValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  overallDivider: { width: 1, height: 30, backgroundColor: colors.borderLight },
  overallTrack: {
    height: 6, backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full, overflow: 'hidden',
  },
  overallFill: { height: '100%', borderRadius: radius.full },

  // List
  list: { gap: spacing.md, paddingBottom: 100 },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: 'rgba(108,92,231,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  cardPeriod: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  pctBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.md, backgroundColor: colors.surfaceElevated,
  },
  pctText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  deleteBtn: {
    padding: spacing.xs, marginLeft: spacing.xs,
    borderRadius: radius.sm, backgroundColor: `${colors.danger}12`,
  },
  progressTrack: {
    height: 8, backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  amounts: { flexDirection: 'row', justifyContent: 'space-between' },
  amountCenter: { alignItems: 'center' },
  amountRight: { alignItems: 'flex-end' },
  amountLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  amountValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  expenseCount: {
    fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.xs,
  },

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
    paddingBottom: spacing.xxl, maxHeight: '85%',
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
