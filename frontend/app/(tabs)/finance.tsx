import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Modal, Alert
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDashboardSummary } from '@/features/dashboard/hooks/useDashboardSummary';
import { useHouseholdStore } from '@/stores/household-store';
import { useCurrencyStore } from '@/stores/currency-store';
import type { DashboardSummary, DashboardBudget, DashboardExpense, DashboardRecurring } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type Segment = 'overview' | 'expenses' | 'budgets' | 'recurring';

const segments: { key: Segment; label: string; icon: IoniconsName }[] = [
  { key: 'overview', label: 'Overview', icon: 'stats-chart-outline' },
  { key: 'expenses', label: 'Expenses', icon: 'wallet-outline' },
  { key: 'budgets', label: 'Budgets', icon: 'pie-chart-outline' },
  { key: 'recurring', label: 'Recurring', icon: 'repeat-outline' },
];

function getProgressColor(pct: number) {
  if (pct >= 90) return colors.danger;
  if (pct >= 70) return colors.warning;
  return colors.success;
}

export default function FinanceScreen() {
  const household = useHouseholdStore((s) => s.currentHousehold);
  const sym = useCurrencyStore((s) => s.currency.symbol);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('overview');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const { data: dashboard, isLoading, isRefetching, refetch } = useDashboardSummary(household?.id);

  const handleRefresh = () => {
    refetch();
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

  const spentThisMonth = dashboard?.spent_this_month ?? 0;
  const totalBudget = dashboard?.total_budget ?? 0;
  const budgetLeft = dashboard?.total_budget_remaining ?? 0;
  const budgetPct = dashboard?.budget_utilization_pct ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
      </View>

      {/* Segment Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentRow}
        style={styles.segmentContainer}
      >
        {segments.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segmentBtn, segment === s.key && styles.segmentBtnActive]}
            onPress={() => setSegment(s.key)}
          >
            <Ionicons
              name={s.icon}
              size={14}
              color={segment === s.key ? colors.neutral : colors.textSecondary}
            />
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.tertiary}
          />
        }
      >
        {/* ═══════════ OVERVIEW ═══════════ */}
        {segment === 'overview' && (
          <>
            {/* Financial Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>MONTHLY OVERVIEW</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Spent</Text>
                  <Text style={styles.summaryStatValue}>
                    {sym}{Number(spentThisMonth).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Budget</Text>
                  <Text style={styles.summaryStatValue}>
                    {sym}{Number(totalBudget).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Left</Text>
                  <Text style={[styles.summaryStatValue, { color: budgetLeft < 0 ? colors.danger : colors.success }]}>
                    {sym}{Number(budgetLeft).toFixed(2)}
                  </Text>
                </View>
              </View>
              {totalBudget > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(budgetPct, 100)}%`,
                        backgroundColor: getProgressColor(budgetPct),
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => router.push('/expenses')}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${colors.accent}20` }]}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                </View>
                <Text style={styles.quickLabel}>Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => { setSegment('budgets'); }}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${colors.info}20` }]}>
                  <Ionicons name="pie-chart-outline" size={22} color={colors.info} />
                </View>
                <Text style={styles.quickLabel}>View Budgets</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => { setSegment('recurring'); }}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${colors.warning}20` }]}>
                  <Ionicons name="repeat-outline" size={22} color={colors.warning} />
                </View>
                <Text style={styles.quickLabel}>Recurring</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Expenses Preview */}
            {dashboard && dashboard.recent_expenses.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Expenses</Text>
                  <TouchableOpacity onPress={() => setSegment('expenses')}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.listSection}>
                  {dashboard.recent_expenses.slice(0, 5).map((exp: DashboardExpense) => (
                    <View key={exp.id} style={styles.listRow}>
                      <View style={styles.listIcon}>
                        <Ionicons name="receipt-outline" size={18} color={colors.tertiary} />
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName} numberOfLines={1}>{exp.title}</Text>
                        <Text style={styles.listSub}>
                          {exp.expense_date}{exp.category_name ? ` · ${exp.category_name}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.listAmount}>{sym}{Number(exp.amount ?? 0).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Budget Progress Preview */}
            {dashboard && dashboard.budgets.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Budget Progress</Text>
                  <TouchableOpacity onPress={() => setSegment('budgets')}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.listSection}>
                  {dashboard.budgets.slice(0, 3).map((b: DashboardBudget) => {
                    const pct = Math.min(b.percentage_used, 100);
                    const barColor = getProgressColor(b.percentage_used);
                    return (
                      <View key={b.id} style={styles.budgetItem}>
                        <View style={styles.budgetTop}>
                          <Text style={styles.budgetName} numberOfLines={1}>{b.name}</Text>
                          <Text style={styles.budgetAmt}>
                            {sym}{Number(b.spent).toFixed(0)} / {sym}{Number(b.amount).toFixed(0)}
                          </Text>
                        </View>
                        <View style={styles.budgetTrack}>
                          <View style={[styles.budgetBar, { width: `${pct}%`, backgroundColor: barColor }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Upcoming Recurring Preview */}
            {dashboard && dashboard.upcoming_recurring.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Upcoming Recurring</Text>
                  <TouchableOpacity onPress={() => setSegment('recurring')}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.listSection}>
                  {dashboard.upcoming_recurring.slice(0, 3).map((item: DashboardRecurring) => (
                    <View key={item.id} style={styles.listRow}>
                      <View style={[styles.listIcon, item.is_overdue && { borderColor: colors.danger }]}>
                        <Ionicons name="repeat-outline" size={18} color={item.is_overdue ? colors.danger : colors.tertiary} />
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.listSub, item.is_overdue && { color: colors.danger }]}>
                          {item.is_overdue
                            ? `${Math.abs(item.days_until_due)}d overdue`
                            : item.days_until_due === 0
                              ? 'Due today'
                              : `In ${item.days_until_due} days`}
                        </Text>
                      </View>
                      <Text style={styles.listAmount}>{sym}{Number(item.amount ?? 0).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ═══════════ EXPENSES ═══════════ */}
        {segment === 'expenses' && (
          <View style={styles.hubCard}>
            <View style={styles.hubCardHeader}>
              <View style={[styles.hubCardIcon, { backgroundColor: `${colors.accent}20` }]}>
                <Ionicons name="wallet" size={24} color={colors.accent} />
              </View>
              <View style={styles.hubCardHeaderText}>
                <Text style={styles.hubCardTitle}>Expenses</Text>
                <Text style={styles.hubCardDesc}>View, add, and manage all your expenses</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hubCardAction}
              onPress={() => router.push('/expenses')}
            >
              <Text style={styles.hubCardActionText}>Open Expenses</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.neutral} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════ BUDGETS ═══════════ */}
        {segment === 'budgets' && (
          <View style={styles.hubCard}>
            <View style={styles.hubCardHeader}>
              <View style={[styles.hubCardIcon, { backgroundColor: `${colors.info}20` }]}>
                <Ionicons name="pie-chart" size={24} color={colors.info} />
              </View>
              <View style={styles.hubCardHeaderText}>
                <Text style={styles.hubCardTitle}>Budgets</Text>
                <Text style={styles.hubCardDesc}>Create and track spending budgets</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hubCardAction}
              onPress={() => router.push('/budgets')}
            >
              <Text style={styles.hubCardActionText}>Open Budgets</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.neutral} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════ RECURRING ═══════════ */}
        {segment === 'recurring' && (
          <View style={styles.hubCard}>
            <View style={styles.hubCardHeader}>
              <View style={[styles.hubCardIcon, { backgroundColor: `${colors.warning}20` }]}>
                <Ionicons name="repeat" size={24} color={colors.warning} />
              </View>
              <View style={styles.hubCardHeaderText}>
                <Text style={styles.hubCardTitle}>Recurring Expenses</Text>
                <Text style={styles.hubCardDesc}>Manage subscriptions and recurring bills</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hubCardAction}
              onPress={() => router.push('/expenses')}
            >
              <Text style={styles.hubCardActionText}>Open Recurring</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.neutral} />
            </TouchableOpacity>
          </View>
        )}

        {/* Show full-screen content for expenses/budgets/recurring segments */}
        {(segment === 'expenses' || segment === 'budgets' || segment === 'recurring') && dashboard && (
          <>
            {/* Spending by month summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>THIS MONTH</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Spent</Text>
                  <Text style={styles.summaryStatValue}>
                    {sym}{Number(spentThisMonth).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Budget Used</Text>
                  <Text style={[styles.summaryStatValue, { color: getProgressColor(budgetPct) }]}>
                    {Math.round(budgetPct)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Budget progress list for budgets segment */}
            {segment === 'budgets' && dashboard.budgets.length > 0 && (
              <View style={styles.listSection}>
                {dashboard.budgets.map((b: DashboardBudget) => {
                  const pct = Math.min(b.percentage_used, 100);
                  const barColor = getProgressColor(b.percentage_used);
                  return (
                    <View key={b.id} style={styles.budgetItem}>
                      <View style={styles.budgetTop}>
                        <Text style={styles.budgetName} numberOfLines={1}>{b.name}</Text>
                        <Text style={styles.budgetAmt}>
                          {sym}{Number(b.spent).toFixed(0)} / {sym}{Number(b.amount).toFixed(0)}
                        </Text>
                      </View>
                      <View style={styles.budgetTrack}>
                        <View style={[styles.budgetBar, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Recent expenses for expenses segment */}
            {segment === 'expenses' && dashboard.recent_expenses.length > 0 && (
              <View style={styles.listSection}>
                {dashboard.recent_expenses.map((exp: DashboardExpense) => (
                  <View key={exp.id} style={styles.listRow}>
                    <View style={styles.listIcon}>
                      <Ionicons name="receipt-outline" size={18} color={colors.tertiary} />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.listSub}>
                        {exp.expense_date}{exp.category_name ? ` · ${exp.category_name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.listAmount}>{sym}{Number(exp.amount ?? 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recurring list for recurring segment */}
            {segment === 'recurring' && dashboard.upcoming_recurring.length > 0 && (
              <View style={styles.listSection}>
                {dashboard.upcoming_recurring.map((item: DashboardRecurring) => (
                  <View key={item.id} style={styles.listRow}>
                    <View style={[styles.listIcon, item.is_overdue && { borderColor: colors.danger }]}>
                      <Ionicons name="repeat-outline" size={18} color={item.is_overdue ? colors.danger : colors.tertiary} />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.listSub, item.is_overdue && { color: colors.danger }]}>
                        {item.is_overdue
                          ? `${Math.abs(item.days_until_due)}d overdue`
                          : item.days_until_due === 0
                            ? 'Due today'
                            : `In ${item.days_until_due} days`}
                      </Text>
                    </View>
                    <Text style={styles.listAmount}>{sym}{Number(item.amount ?? 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB - Quick Add Expense */}
      <TouchableOpacity style={styles.fabPill} onPress={() => setShowAddMenu(true)}>
        <Ionicons name="add" size={20} color={colors.textInverse} />
        <Text style={styles.fabPillText}>Add Expense</Text>
      </TouchableOpacity>

      {/* Add Options Menu Modal */}
      <Modal visible={showAddMenu} transparent animationType="fade" onRequestClose={() => setShowAddMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowAddMenu(false)}>
          <View style={styles.menuBox}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowAddMenu(false); router.push('/expenses'); }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.tertiary },

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

  // Segments
  segmentContainer: { flexGrow: 0, marginBottom: spacing.sm },
  segmentRow: { paddingHorizontal: spacing.md, gap: spacing.xs },
  segmentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  segmentBtnActive: { backgroundColor: colors.tertiary, borderColor: colors.tertiary },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  segmentTextActive: { color: colors.neutral },

  // Summary Card
  summaryCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.borderLight,
  },
  summaryCardLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },
  summaryStatLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  summaryStatValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.tertiary },

  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.borderLight,
    overflow: 'hidden', marginTop: spacing.md,
  },
  progressFill: { height: 6, borderRadius: 3 },

  // Quick Actions
  quickRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    gap: spacing.sm, marginBottom: spacing.md,
  },
  quickCard: {
    flex: 1, alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  quickIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  quickLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.tertiary, textAlign: 'center' },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.tertiary },
  seeAll: { fontSize: fontSize.sm, color: colors.secondary, fontWeight: fontWeight.medium },

  // List Section
  listSection: { paddingHorizontal: spacing.md, gap: spacing.xs, marginBottom: spacing.md },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  listIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  listInfo: { flex: 1, gap: 3 },
  listName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.tertiary },
  listSub: { fontSize: fontSize.xs, color: colors.textMuted },
  listAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.tertiary },

  // Budget Items
  budgetItem: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.tertiary, flex: 1 },
  budgetAmt: { fontSize: fontSize.xs, color: colors.textMuted },
  budgetTrack: { height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' },
  budgetBar: { height: 6, borderRadius: 3 },

  // Hub Card
  hubCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight,
  },
  hubCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg,
  },
  hubCardIcon: {
    width: 52, height: 52, borderRadius: radius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  hubCardHeaderText: { flex: 1, gap: 4 },
  hubCardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.tertiary },
  hubCardDesc: { fontSize: fontSize.sm, color: colors.textMuted },
  hubCardAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.tertiary,
    paddingVertical: spacing.md,
  },
  hubCardActionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.neutral },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: fontWeight.medium },
});
