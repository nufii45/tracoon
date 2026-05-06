import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { householdsApi } from '@/api/households';
import { useDashboardSummary } from '@/features/dashboard/hooks/useDashboardSummary';
import { useAuthStore } from '@/stores/auth-store';
import { useHouseholdStore } from '@/stores/household-store';
import { useCurrencyStore } from '@/stores/currency-store';
import type {
  HouseholdWithRole, HouseholdMember, HouseholdDetail,
  DashboardSummary, DashboardExpense, DashboardRecurring,
  DashboardLowStock, DashboardPurchase, DashboardBudget, QuickAction,
} from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';
import RadialFAB from '@/components/RadialFAB';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Role badge helpers ──
const roleMeta: Record<string, { icon: IoniconsName; color: string }> = {
  owner: { icon: 'shield', color: colors.warning },
  admin: { icon: 'shield-half', color: colors.secondary },
  member: { icon: 'person', color: colors.accent },
  viewer: { icon: 'eye', color: colors.textMuted },
};

// ── Recurring card icon fallback ──
const getRecurringIcon = (title: string): IoniconsName => {
  const t = title.toLowerCase();
  if (t.includes('netflix') || t.includes('film') || t.includes('movie')) return 'film-outline';
  if (t.includes('gym') || t.includes('fitness')) return 'fitness-outline';
  if (t.includes('cloud') || t.includes('icloud') || t.includes('dropbox')) return 'cloud-outline';
  if (t.includes('spotify') || t.includes('music') || t.includes('apple music')) return 'musical-notes-outline';
  if (t.includes('electric') || t.includes('power')) return 'flash-outline';
  if (t.includes('water')) return 'water-outline';
  if (t.includes('internet') || t.includes('wifi')) return 'wifi-outline';
  if (t.includes('phone') || t.includes('mobile')) return 'phone-portrait-outline';
  if (t.includes('rent') || t.includes('mortgage')) return 'home-outline';
  if (t.includes('insurance')) return 'shield-checkmark-outline';
  return 'repeat-outline';
};

// ── Skeleton loader ──
const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: object }) => (
  <View style={[{ width, height, backgroundColor: colors.borderLight, borderRadius: radius.sm, opacity: 0.6 }, style]} />
);

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { currentHousehold, setCurrentHousehold } = useHouseholdStore();
  const sym = useCurrencyStore((s) => s.currency.symbol);
  const queryClient = useQueryClient();
  const router = useRouter();

  // ── Queries ──
  const { data: households, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['households'],
    queryFn: householdsApi.list,
  });

  const { data: dashboard, isLoading: isDashLoading, refetch: refetchDash, isRefetching: isDashRefetching } = useDashboardSummary(currentHousehold?.id);

  useEffect(() => {
    if (households?.length && !currentHousehold) {
      setCurrentHousehold(households[0]);
    }
  }, [households]);

  // ── Derived from dashboard ──
  const spentThisMonth = dashboard?.spent_this_month ?? null;
  const availableBalance = dashboard?.total_budget ?? null;
  const budgetLeft = dashboard?.total_budget_remaining ?? null;

  // ── Recurring section ──
  const renderRecurring = () => {
    if (isDashLoading) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recurringRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.recurringCard}>
              <SkeletonBox width={40} height={40} style={{ borderRadius: radius.md, marginBottom: spacing.xs }} />
              <SkeletonBox width={70} height={12} style={{ marginBottom: 6 }} />
              <SkeletonBox width={50} height={10} style={{ marginBottom: 6 }} />
              <SkeletonBox width={60} height={14} />
            </View>
          ))}
        </ScrollView>
      );
    }

    const rules = dashboard?.upcoming_recurring ?? [];

    if (!rules.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="repeat-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>No recurring items yet</Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recurringRow}>
        {rules.map((item: DashboardRecurring, index: number) => {
          const isOverdue = item.is_overdue;
          const isFirst = index === 0;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.recurringCard, isFirst && styles.recurringCardActive, isOverdue && { borderColor: colors.danger }]}
              activeOpacity={0.8}
            >
              <View style={[styles.recurringIcon, isFirst && styles.recurringIconActive]}>
                <Ionicons name={getRecurringIcon(item.title)} size={22} color={isFirst ? colors.neutral : colors.tertiary} />
              </View>
              <Text style={[styles.recurringName, isFirst && styles.recurringTextActive]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.recurringFreq, isFirst && styles.recurringSubActive]}>
                {isOverdue ? `${Math.abs(item.days_until_due)}d overdue` : item.days_until_due === 0 ? 'Due today' : `In ${item.days_until_due}d`}
              </Text>
              <Text style={[styles.recurringAmount, isFirst && styles.recurringTextActive]}>
                {sym}{Number(item.amount ?? 0).toFixed(2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ── Expenses section ──
  const renderExpenses = () => {
    if (isDashLoading) {
      return (
        <View style={styles.expenseList}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.expenseRow, { gap: spacing.md }]}>
              <SkeletonBox width={44} height={44} style={{ borderRadius: radius.md }} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="70%" height={14} />
                <SkeletonBox width="45%" height={10} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <SkeletonBox width={60} height={14} />
                <SkeletonBox width={50} height={10} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    const expenses = dashboard?.recent_expenses ?? [];

    if (!expenses.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>No expenses this month</Text>
        </View>
      );
    }

    return (
      <View style={styles.expenseList}>
        {expenses.map((exp: DashboardExpense) => (
          <TouchableOpacity key={exp.id} style={styles.expenseRow} activeOpacity={0.7}>
            <View style={styles.expenseIcon}>
              <Ionicons name="receipt-outline" size={20} color={colors.tertiary} />
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseName} numberOfLines={1}>{exp.title}</Text>
              <Text style={styles.expenseSub}>
                {exp.expense_date}{exp.category_name ? ` · ${exp.category_name}` : ''}
              </Text>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>{sym}{Number(exp.amount ?? 0).toFixed(2)}</Text>
              {exp.payment_method && (
                <Text style={styles.expenseCategory}>{exp.payment_method.toUpperCase()}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isDashRefetching}
            onRefresh={() => {
              refetch();
              refetchDash();
            }}
            tintColor={colors.tertiary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingName}>Welcome, {user?.full_name?.split(' ')[0] || 'Hey'}</Text>
            <Text style={styles.householdLabel}>
              {currentHousehold?.name || 'No household selected'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => Alert.alert('Notifications', 'No new notifications')}>
              <Ionicons name="notifications-outline" size={22} color={colors.tertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(tabs)/household')}>
              <Text style={styles.avatarText}>
                {(user?.full_name || user?.email || '?')[0].toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Balance Hero Card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardTop}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          </View>
          {isDashLoading ? (
            <SkeletonBox width={180} height={40} style={{ marginVertical: spacing.sm }} />
          ) : (
            <Text style={styles.balanceAmount}>
              {availableBalance !== null ? `${sym}${Number(availableBalance).toFixed(2)}` : '—'}
            </Text>
          )}
          <View style={styles.balanceStatsRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>SPENT THIS MONTH</Text>
              {isDashLoading ? (
                <SkeletonBox width={80} height={18} style={{ marginTop: 2 }} />
              ) : (
                <Text style={styles.balanceStatValue}>
                  {spentThisMonth != null ? `${sym}${Number(spentThisMonth).toFixed(2)}` : '—'}
                </Text>
              )}
            </View>
            <View style={styles.balanceStatDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>BUDGET LEFT</Text>
              {isDashLoading ? (
                <SkeletonBox width={80} height={18} style={{ marginTop: 2 }} />
              ) : (
                <Text style={styles.balanceStatValue}>
                  {budgetLeft !== null ? `${sym}${Number(budgetLeft).toFixed(2)}` : '—'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Alerts Banner ── */}
        {dashboard && (dashboard.overdue_recurring_count > 0 || dashboard.budgets_over_limit_count > 0 || dashboard.low_stock_count > 0) && (
          <View style={styles.alertsBanner}>
            {dashboard.overdue_recurring_count > 0 && (
              <TouchableOpacity style={styles.alertItem} onPress={() => router.push('/(tabs)/finance')}>
                <View style={[styles.alertDot, { backgroundColor: colors.danger }]} />
                <Text style={styles.alertText}>
                  {dashboard.overdue_recurring_count} overdue recurring expense{dashboard.overdue_recurring_count !== 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {dashboard.budgets_over_limit_count > 0 && (
              <TouchableOpacity style={styles.alertItem} onPress={() => router.push('/(tabs)/finance')}>
                <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
                <Text style={styles.alertText}>
                  {dashboard.budgets_over_limit_count} budget{dashboard.budgets_over_limit_count !== 1 ? 's' : ''} over limit
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {dashboard.low_stock_count > 0 && (
              <TouchableOpacity style={styles.alertItem} onPress={() => router.push('/inventory')}>
                <View style={[styles.alertDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.alertText}>
                  {dashboard.low_stock_count} item{dashboard.low_stock_count !== 1 ? 's' : ''} low on stock
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Summary Stats Strip ── */}
        {dashboard && (
          <View style={styles.statsStrip}>
            <TouchableOpacity style={styles.statBox} onPress={() => router.push('/inventory')}>
              <Ionicons name="cube-outline" size={18} color={colors.accent} />
              <Text style={styles.statBoxValue}>{dashboard.inventory_total_count}</Text>
              <Text style={styles.statBoxLabel}>Inventory</Text>
            </TouchableOpacity>
            <View style={styles.statBoxDivider} />
            <TouchableOpacity style={styles.statBox} onPress={() => router.push('/(tabs)/inventory')}>
              <Ionicons name="cart-outline" size={18} color={colors.secondary} />
              <Text style={styles.statBoxValue}>{dashboard.purchase_count_this_month}</Text>
              <Text style={styles.statBoxLabel}>Purchases</Text>
            </TouchableOpacity>
            <View style={styles.statBoxDivider} />
            <TouchableOpacity style={styles.statBox} onPress={() => router.push('/(tabs)/finance')}>
              <Ionicons name="pie-chart-outline" size={18} color={
                dashboard.budget_utilization_pct > 100 ? colors.danger
                : dashboard.budget_utilization_pct > 80 ? colors.warning
                : colors.success
              } />
              <Text style={styles.statBoxValue}>{Math.round(dashboard.budget_utilization_pct)}%</Text>
              <Text style={styles.statBoxLabel}>Budget Used</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Budget Progress Preview ── */}
        {dashboard && dashboard.budgets.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Budgets</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/finance')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.budgetProgressList}>
              {dashboard.budgets.slice(0, 3).map((b: DashboardBudget) => {
                const pct = Math.min(b.percentage_used, 100);
                const barColor = b.percentage_used >= 90 ? colors.danger
                  : b.percentage_used >= 70 ? colors.warning : colors.success;
                return (
                  <View key={b.id} style={styles.budgetProgressItem}>
                    <View style={styles.budgetProgressTop}>
                      <Text style={styles.budgetProgressName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.budgetProgressAmt}>
                        {sym}{Number(b.spent).toFixed(0)} / {sym}{Number(b.amount).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.budgetProgressTrack}>
                      <View style={[styles.budgetProgressBar, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Quick Actions ── */}
        {dashboard?.quick_actions && dashboard.quick_actions.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.quickActionsRow}>
              {dashboard.quick_actions.map((a: QuickAction) => (
                <TouchableOpacity key={a.key} style={styles.quickActionCard} activeOpacity={0.7}
                  onPress={() => {
                    if (a.key === 'review_budgets') router.push('/(tabs)/finance');
                    else if (a.key === 'restock_items') router.push('/(tabs)/inventory');
                    else if (a.key === 'log_expense') router.push('/(tabs)/finance');
                    else if (a.key === 'create_budget') router.push('/(tabs)/finance');
                  }}
                >
                  <View style={styles.quickActionIcon}>
                    <Ionicons name={a.icon as IoniconsName} size={20} color={colors.tertiary} />
                  </View>
                  <Text style={styles.quickActionLabel} numberOfLines={1}>{a.label}</Text>
                  <Text style={styles.quickActionDesc} numberOfLines={2}>{a.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Recurring Items ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Recurring</Text>
          {(dashboard?.overdue_recurring_count ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{dashboard!.overdue_recurring_count} overdue</Text>
            </View>
          )}
        </View>
        {renderRecurring()}

        {/* ── Recent Expenses ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {renderExpenses()}

        {/* ── Low Stock Items ── */}
        {(dashboard?.low_stock_items?.length ?? 0) > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Low Stock</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{dashboard!.low_stock_count}</Text>
              </View>
            </View>
            <View style={styles.expenseList}>
              {dashboard!.low_stock_items.map((item: DashboardLowStock) => (
                <View key={item.id} style={styles.expenseRow}>
                  <View style={[styles.expenseIcon, { borderColor: colors.warning }]}>
                    <Ionicons name="cube-outline" size={20} color={colors.warning} />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.expenseSub}>{item.location || 'No location'}</Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={[styles.expenseAmount, { color: colors.warning }]}>
                      {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </Text>
                    <Text style={styles.expenseCategory}>MIN {item.low_stock_threshold}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Recent Purchases ── */}
        {(dashboard?.recent_purchases?.length ?? 0) > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Purchases</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.expenseList}>
              {dashboard!.recent_purchases.map((p: DashboardPurchase) => (
                <View key={p.id} style={styles.expenseRow}>
                  <View style={styles.expenseIcon}>
                    <Ionicons name="cart-outline" size={20} color={colors.tertiary} />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName} numberOfLines={1}>{p.store_name || 'Unknown Store'}</Text>
                    <Text style={styles.expenseSub}>{p.purchase_date} · {p.item_count} item{p.item_count !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>{sym}{Number(p.total_amount).toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.secondary} style={{ marginTop: spacing.md }} />
        ) : null}
      </ScrollView>



      {/* ══════ Radial FAB — Quick Access Panel ══════ */}
      <RadialFAB />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.md,
    paddingTop: spacing.sm, paddingBottom: spacing.xs,
  },
  headerLeft: { gap: 2, flex: 1 },
  greetingName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.tertiary },
  householdLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  avatarBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.neutral },

  balanceCard: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: colors.tertiary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  balanceCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    color: colors.textMuted, letterSpacing: 1.2,
  },
  balanceAmount: {
    fontSize: 36, fontWeight: fontWeight.bold,
    color: colors.tertiary, marginVertical: spacing.sm, letterSpacing: -0.5,
  },
  balanceStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.xs,
  },
  balanceStat: { flex: 1, gap: 3 },
  balanceStatDivider: { width: 1, height: 32, backgroundColor: colors.borderLight, marginHorizontal: spacing.md },
  balanceStatLabel: { fontSize: fontSize.xs, color: colors.textMuted, letterSpacing: 0.8 },
  balanceStatValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.tertiary },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.tertiary },
  seeAll: { fontSize: fontSize.sm, color: colors.secondary, fontWeight: fontWeight.medium },

  badge: {
    backgroundColor: `${colors.danger}20`, paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: radius.full,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.danger },

  alertsBanner: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statBoxDivider: { width: 1, height: 36, backgroundColor: colors.borderLight },
  statBoxValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.tertiary },
  statBoxLabel: { fontSize: fontSize.xs, color: colors.textMuted },

  budgetProgressList: {
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  budgetProgressItem: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  budgetProgressTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  budgetProgressName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.tertiary, flex: 1 },
  budgetProgressAmt: { fontSize: fontSize.xs, color: colors.textMuted },
  budgetProgressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden',
  },
  budgetProgressBar: { height: 6, borderRadius: 3 },

  quickActionsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1, minWidth: 140, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, gap: spacing.xs,
  },
  quickActionIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: 2,
  },
  quickActionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.tertiary },
  quickActionDesc: { fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 16 },

  recurringRow: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xs },
  recurringCard: {
    width: 110, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  recurringCardActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  recurringIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recurringIconActive: { backgroundColor: `${colors.white}33` },
  recurringName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.tertiary },
  recurringFreq: { fontSize: fontSize.xs, color: colors.textMuted },
  recurringAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.tertiary, marginTop: spacing.xs },
  recurringTextActive: { color: colors.neutral },
  recurringSubActive: { color: `${colors.primaryLight}B3` },

  expenseList: { paddingHorizontal: spacing.md, gap: spacing.xs },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  expenseIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  expenseInfo: { flex: 1, gap: 3 },
  expenseName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.tertiary },
  expenseSub: { fontSize: fontSize.xs, color: colors.textMuted },
  expenseRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.tertiary },
  expenseCategory: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.secondary, letterSpacing: 0.8 },

  emptyState: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl, marginHorizontal: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg,
    paddingBottom: spacing.xxl, maxHeight: '60%',
  },
  modalContentTall: { maxHeight: '85%' },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  label: {
    fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.tertiary, borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.neutral },
  btnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textSecondary },
  btnDisabled: { opacity: 0.4 },

  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  detailScroll: { marginTop: spacing.sm },
  detailSectionTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  memberInfo: { flex: 1, gap: 1 },
  memberName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  memberEmail: { fontSize: fontSize.xs, color: colors.textMuted },
  memberRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  memberRoleText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textTransform: 'capitalize' },
  memberRemoveBtn: { padding: 4 },

  inviteSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
  roleSelector: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  roleSelectorBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight,
  },
  roleSelectorActive: { backgroundColor: colors.tertiary, borderColor: colors.tertiary },
  roleSelectorText: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'capitalize' },
  roleSelectorTextActive: { color: colors.neutral },
  inviteBtn: { marginTop: spacing.md, flex: 0, paddingHorizontal: spacing.lg },
});