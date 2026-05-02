import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { recurringExpensesApi } from '@/api/recurring-expenses';
import { categoriesApi } from '@/api/categories';
import type { RecurringExpense, UpcomingExpense, Category } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';
import { useCurrencyStore } from '@/stores/currency-store';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Biweekly',
  monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};
const PAY_METHODS = ['cash', 'card', 'bank_transfer', 'e_wallet', 'other'] as const;
const PAY_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank', e_wallet: 'E-Wallet', other: 'Other',
};

export default function RecurringSection({ householdId }: { householdId: string }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);

  const { currency } = useCurrencyStore();
  const sym = currency.symbol;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['recurring', householdId],
    queryFn: () => recurringExpensesApi.list(householdId),
  });

  const { data: upcoming, isLoading: upLd } = useQuery({
    queryKey: ['recurring-upcoming', householdId],
    queryFn: () => recurringExpensesApi.upcoming(householdId, 30),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', householdId, 'expense'],
    queryFn: () => categoriesApi.list(householdId, 'expense'),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['recurring', householdId] });
    qc.invalidateQueries({ queryKey: ['recurring-upcoming', householdId] });
  };

  const createM = useMutation({
    mutationFn: (d: Parameters<typeof recurringExpensesApi.create>[1]) =>
      recurringExpensesApi.create(householdId, d),
    onSuccess: () => { inv(); resetForm(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) =>
      recurringExpensesApi.update(householdId, id, d),
    onSuccess: () => { inv(); resetForm(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => recurringExpensesApi.delete(householdId, id),
    onSuccess: inv,
  });
  const genM = useMutation({
    mutationFn: () => recurringExpensesApi.generate(householdId),
    onSuccess: (r) => {
      inv();
      qc.invalidateQueries({ queryKey: ['expenses', householdId] });
      Alert.alert('Generated', `Created ${r.generated_count}, skipped ${r.skipped_count}.`);
    },
  });

  function resetForm() {
    setTitle(''); setAmount(''); setFrequency('monthly');
    setNextDueDate(new Date().toISOString().slice(0, 10));
    setCategoryId(null); setDescription(''); setPayMethod('');
    setNotes(''); setIsActive(true); setEditing(null); setShowModal(false);
  }

  function openEdit(r: RecurringExpense) {
    setEditing(r); setTitle(r.title); setAmount(String(Number(r.amount)));
    setFrequency(r.frequency); setNextDueDate(r.next_due_date);
    setCategoryId(r.category_id); setDescription(r.description || '');
    setPayMethod(r.payment_method || ''); setNotes(r.notes || '');
    setIsActive(r.is_active); setShowModal(true);
  }

  function handleSave() {
    const a = parseFloat(amount);
    if (!title.trim() || !a || a < 0) return;
    if (editing) {
      updateM.mutate({
        id: editing.id, d: {
          title: title.trim(), amount: a, frequency, next_due_date: nextDueDate,
          category_id: categoryId || null, description: description.trim() || null,
          payment_method: payMethod || null, notes: notes.trim() || null, is_active: isActive,
        }
      });
    } else {
      createM.mutate({
        title: title.trim(), amount: a, frequency, next_due_date: nextDueDate,
        category_id: categoryId || undefined, description: description.trim() || undefined,
        payment_method: payMethod || undefined, notes: notes.trim() || undefined,
      });
    }
  }

  const catName = (id: string | null) => {
    if (!id || !categories) return null;
    return categories.find((c: Category) => c.id === id)?.name || null;
  };

  const daysLabel = (d: number) => d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `In ${d}d`;
  const daysColor = (d: number) => d < 0 ? colors.danger : d <= 3 ? colors.warning : colors.textMuted;

  const isSaving = createM.isPending || updateM.isPending;
  const activeCount = data?.rules.filter(r => r.is_active).length || 0;
  const overdueCount = upcoming?.filter(u => u.days_until_due < 0).length || 0;

  const renderRule = ({ item: r }: { item: RecurringExpense }) => (
    <TouchableOpacity style={s.card} onPress={() => openEdit(r)} onLongPress={() =>
      Alert.alert('Delete', `Remove "${r.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteM.mutate(r.id) },
      ])}>
      <View style={[s.cardIcon, { backgroundColor: r.is_active ? `${colors.primary}20` : `${colors.textMuted}20` }]}>
        <Ionicons name="repeat-outline" size={20} color={r.is_active ? colors.primary : colors.textMuted} />
      </View>
      <View style={s.cardBody}>
        <Text style={[s.cardTitle, !r.is_active && { opacity: 0.5 }]} numberOfLines={1}>{r.title}</Text>
        <View style={s.cardMeta}>
          <View style={s.freqChip}><Text style={s.freqText}>{FREQ_LABELS[r.frequency]}</Text></View>
          {catName(r.category_id) && <Text style={s.cardCat}>{catName(r.category_id)}</Text>}
          {!r.is_active && <Text style={s.pausedText}>Paused</Text>}
        </View>
        <Text style={s.cardDue}>Next: {r.next_due_date}</Text>
      </View>
      <Text style={[s.cardAmt, !r.is_active && { opacity: 0.5 }]}>{sym}{Number(r.amount).toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Stats + Actions */}
      <View style={s.stats}>
        <View style={s.statBlock}><Text style={s.statVal}>{activeCount}</Text><Text style={s.statLbl}>Active</Text></View>
        <View style={s.statDiv} />
        <View style={s.statBlock}><Text style={[s.statVal, overdueCount > 0 && { color: colors.danger }]}>{overdueCount}</Text><Text style={s.statLbl}>Overdue</Text></View>
        <View style={s.statDiv} />
        <View style={s.statBlock}><Text style={s.statVal}>{data?.total_count || 0}</Text><Text style={s.statLbl}>Total</Text></View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.genBtn} onPress={() => Alert.alert('Generate', 'Create expenses from due rules?', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Generate', onPress: () => genM.mutate() }
        ])} disabled={genM.isPending}>
          {genM.isPending ? <ActivityIndicator size="small" color="#fff" /> :
            <><Ionicons name="flash" size={15} color="#fff" /><Text style={s.genText}>Generate Due</Text></>}
        </TouchableOpacity>
        <TouchableOpacity style={s.upBtn} onPress={() => setShowUpcoming(true)}>
          <Ionicons name="time" size={15} color={colors.primary} /><Text style={s.upText}>Upcoming</Text>
        </TouchableOpacity>
      </View>

      {/* Rules List */}
      {isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
        <FlatList data={data?.rules} keyExtractor={r => r.id} renderItem={renderRule}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="repeat-outline" size={48} color={colors.textMuted} />
              <Text style={s.emptyText}>No recurring expenses</Text>
              <Text style={s.emptyHint}>Tap + to create your first rule</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => { resetForm(); setShowModal(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Edit Rule' : 'New Recurring Expense'}</Text>
              <TouchableOpacity onPress={resetForm}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={s.lbl}>Title *</Text>
              <TextInput style={s.inp} placeholder="e.g. Netflix, Rent" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
              <View style={s.row}>
                <View style={{ flex: 1 }}><Text style={s.lbl}>Amount *</Text>
                  <TextInput style={s.inp} placeholder="0.00" placeholderTextColor={colors.textMuted} value={amount} onChangeText={setAmount} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Text style={s.lbl}>Next Due *</Text>
                  <TextInput style={s.inp} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={nextDueDate} onChangeText={setNextDueDate} /></View>
              </View>
              <Text style={s.lbl}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {FREQUENCIES.map(f => (
                  <TouchableOpacity key={f} style={[s.chip, frequency === f && s.chipOn]} onPress={() => setFrequency(f)}>
                    <Text style={[s.chipTxt, frequency === f && s.chipTxtOn]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.lbl}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <TouchableOpacity style={[s.chip, !categoryId && s.chipOn]} onPress={() => setCategoryId(null)}>
                  <Text style={[s.chipTxt, !categoryId && s.chipTxtOn]}>None</Text>
                </TouchableOpacity>
                {categories?.map((c: Category) => (
                  <TouchableOpacity key={c.id} style={[s.chip, categoryId === c.id && s.chipOn]} onPress={() => setCategoryId(c.id)}>
                    <Text style={[s.chipTxt, categoryId === c.id && s.chipTxtOn]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.lbl}>Payment</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <TouchableOpacity style={[s.chip, !payMethod && s.chipOn]} onPress={() => setPayMethod('')}>
                  <Text style={[s.chipTxt, !payMethod && s.chipTxtOn]}>None</Text>
                </TouchableOpacity>
                {PAY_METHODS.map(m => (
                  <TouchableOpacity key={m} style={[s.chip, payMethod === m && s.chipOn]} onPress={() => setPayMethod(m)}>
                    <Text style={[s.chipTxt, payMethod === m && s.chipTxtOn]}>{PAY_LABELS[m]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.lbl}>Description</Text>
              <TextInput style={s.inp} placeholder="Optional" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} />
              <Text style={s.lbl}>Notes</Text>
              <TextInput style={[s.inp, { minHeight: 50, textAlignVertical: 'top' }]} placeholder="Any notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline />
              {editing && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
                  <Text style={{ fontSize: fontSize.md, color: colors.textPrimary }}>Active</Text>
                  <Switch value={isActive} onValueChange={setIsActive}
                    trackColor={{ false: colors.surfaceElevated, true: colors.primaryLight }}
                    thumbColor={isActive ? colors.primary : colors.textMuted} />
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={[s.saveBtn, (!title.trim() || !amount || isSaving) && { opacity: 0.5 }]}
              onPress={handleSave} disabled={!title.trim() || !amount || isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> :
                <Text style={s.saveTxt}>{editing ? 'Update Rule' : 'Create Rule'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upcoming Modal */}
      <Modal visible={showUpcoming} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Upcoming (30 days)</Text>
              <TouchableOpacity onPress={() => setShowUpcoming(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {upLd ? <ActivityIndicator size="large" color={colors.primary} style={{ margin: spacing.xl }} /> : (
              <FlatList data={upcoming} keyExtractor={u => u.recurring_expense_id} renderItem={({ item: u }) => (
                <View style={s.upCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>{u.title}</Text>
                    <Text style={[{ fontSize: fontSize.sm, marginTop: 2 }, { color: daysColor(u.days_until_due) }]}>{daysLabel(u.days_until_due)}</Text>
                  </View>
                  <Text style={s.cardAmt}>{sym}{Number(u.amount).toFixed(2)}</Text>
                </View>
              )} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
                ListEmptyComponent={
                  <View style={s.empty}><Ionicons name="checkmark-circle-outline" size={48} color={colors.success} /><Text style={s.emptyText}>Nothing due soon!</Text></View>
                } />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  statBlock: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLbl: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  statDiv: { width: 1, height: 36, backgroundColor: colors.borderLight },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  genBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primary },
  genText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#fff' },
  upBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
  upText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  list: { gap: spacing.sm, paddingBottom: 100, paddingTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  cardMeta: { flexDirection: 'row', gap: spacing.xs, marginTop: 4, alignItems: 'center' },
  freqChip: { backgroundColor: `${colors.primary}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  freqText: { fontSize: 10, color: colors.primaryLight, fontWeight: fontWeight.medium },
  cardCat: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardDue: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3 },
  cardAmt: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.accent },
  pausedText: { fontSize: 10, color: colors.warning },
  upCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  emptyHint: { fontSize: fontSize.sm, color: colors.textMuted },
  fab: { position: 'absolute', bottom: 24, right: 4, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: spacing.xl, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sheetBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  lbl: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  inp: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: spacing.sm, color: colors.textPrimary, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceElevated, marginRight: spacing.xs, borderWidth: 1, borderColor: colors.borderLight },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: fontSize.xs, color: colors.textSecondary },
  chipTxtOn: { color: colors.white },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  saveTxt: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#fff' },
});