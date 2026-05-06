import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const T = {
  bg: '#14110F',
  surface: '#1D1916',
  surfaceRaised: '#29231F',
  border: '#3A3029',
  accent: '#D6A85D',
  akaroa: '#DCC9A3',
  akaroaDim: '#B6A886',
  akaroaFaint: '#817762',
  danger: '#E05D5D',
  warning: '#E0A84F',
  success: '#6CBF84',
};

type Variant = 'neutral' | 'success' | 'warning' | 'danger';

function getVariantColor(variant?: Variant) {
  switch (variant) {
    case 'success':
      return T.success;
    case 'warning':
      return T.warning;
    case 'danger':
      return T.danger;
    default:
      return T.akaroaFaint;
  }
}

export function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  sub,
  subVariant = 'neutral',
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  subVariant?: Variant;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.statCard, style]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {sub ? (
        <Text style={[s.statSub, { color: getVariantColor(subVariant) }]}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({
  title,
  badge,
  badgeVariant = 'neutral',
  onSeeAll,
}: {
  title: string;
  badge?: number;
  badgeVariant?: Variant;
  onSeeAll?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionTitleRow}>
        <Text style={s.sectionTitle}>{title}</Text>

        {!!badge && badge > 0 ? (
          <View
            style={[
              s.badge,
              { borderColor: getVariantColor(badgeVariant) },
            ]}
          >
            <Text style={[s.badgeText, { color: getVariantColor(badgeVariant) }]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={s.seeAll}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function BudgetProgressRow({ budget }: { budget: any }) {
  const name = budget.name ?? budget.category_name ?? 'Budget';
  const spent = Number(budget.spent ?? budget.used ?? budget.amount_spent ?? 0);
  const limit = Number(budget.limit ?? budget.amount ?? budget.budget_amount ?? 0);
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.rowTitle}>{name}</Text>
        <Text style={s.rowAmount}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </Text>
      </View>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export function ExpenseRow({ expense }: { expense: any }) {
  return (
    <SimpleRow
      icon="remove-circle-outline"
      title={expense.name ?? expense.title ?? expense.category_name ?? 'Expense'}
      subtitle={expense.date ?? expense.created_at ?? ''}
      right={formatCurrency(expense.amount)}
      variant="danger"
    />
  );
}

export function RecurringRow({ item }: { item: any }) {
  return (
    <SimpleRow
      icon="repeat-outline"
      title={item.name ?? item.title ?? 'Recurring expense'}
      subtitle={item.next_due_date ? `Due ${item.next_due_date}` : 'Upcoming'}
      right={formatCurrency(item.amount)}
      variant="warning"
    />
  );
}

export function LowStockRow({ item }: { item: any }) {
  const quantity = item.quantity ?? item.current_quantity ?? 0;
  const threshold = item.low_stock_threshold ?? item.minimum_quantity ?? item.threshold ?? 0;

  return (
    <SimpleRow
      icon="cube-outline"
      title={item.name ?? 'Inventory item'}
      subtitle={`Stock: ${quantity} / Min: ${threshold}`}
      right="Low"
      variant="warning"
    />
  );
}

export function PurchaseRow({ purchase }: { purchase: any }) {
  return (
    <SimpleRow
      icon="bag-outline"
      title={purchase.name ?? purchase.store_name ?? purchase.vendor ?? 'Purchase'}
      subtitle={purchase.date ?? purchase.created_at ?? ''}
      right={formatCurrency(purchase.total ?? purchase.amount)}
      variant="neutral"
    />
  );
}

export function QuickActionCard({ action }: { action: any }) {
  return (
    <Pressable style={s.quickAction} onPress={action.onPress}>
      <View style={s.quickIcon}>
        <Ionicons
          name={action.icon ?? 'alert-circle-outline'}
          size={18}
          color={T.accent}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.quickTitle}>{action.title ?? action.label ?? 'Action'}</Text>
        {action.description ? (
          <Text style={s.quickDescription}>{action.description}</Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={T.akaroaFaint} />
    </Pressable>
  );
}

function SimpleRow({
  icon,
  title,
  subtitle,
  right,
  variant = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: string;
  variant?: Variant;
}) {
  return (
    <View style={s.simpleRow}>
      <View style={s.simpleIcon}>
        <Ionicons name={icon} size={18} color={getVariantColor(variant)} />
      </View>

      <View style={s.simpleContent}>
        <Text style={s.simpleTitle}>{title}</Text>
        {subtitle ? <Text style={s.simpleSubtitle}>{subtitle}</Text> : null}
      </View>

      {right ? <Text style={s.simpleRight}>{right}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  emptyState: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: T.akaroaFaint,
  },
  statCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  statLabel: {
    fontSize: 12,
    color: T.akaroaFaint,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: T.akaroa,
  },
  statSub: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: T.akaroa,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 12,
    color: T.accent,
    fontWeight: '600',
  },
  row: {
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  rowTitle: {
    flex: 1,
    fontSize: 13,
    color: T.akaroa,
    fontWeight: '600',
  },
  rowAmount: {
    fontSize: 12,
    color: T.akaroaFaint,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: T.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.accent,
    borderRadius: 999,
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  simpleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  simpleContent: {
    flex: 1,
  },
  simpleTitle: {
    fontSize: 13,
    color: T.akaroa,
    fontWeight: '600',
  },
  simpleSubtitle: {
    fontSize: 11,
    color: T.akaroaFaint,
    marginTop: 2,
  },
  simpleRight: {
    fontSize: 12,
    color: T.akaroaDim,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 8,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickTitle: {
    fontSize: 13,
    color: T.akaroa,
    fontWeight: '700',
  },
  quickDescription: {
    fontSize: 11,
    color: T.akaroaFaint,
    marginTop: 2,
  },
});