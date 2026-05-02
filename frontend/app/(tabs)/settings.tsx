import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  Modal, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import { useHouseholdStore } from '@/stores/household-store';
import { categoriesApi } from '@/api/categories';
import type { Category, CategoryType } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Category type metadata ──
const categoryTypes: { key: CategoryType; label: string; icon: IoniconsName; color: string }[] = [
  { key: 'expense', label: 'Expense', icon: 'wallet-outline', color: colors.danger },
  { key: 'budget', label: 'Budget', icon: 'pie-chart-outline', color: colors.primary },
  { key: 'inventory', label: 'Inventory', icon: 'cube-outline', color: colors.accent },
  { key: 'purchase', label: 'Purchase', icon: 'cart-outline', color: colors.warning },
];

const presetColors = [
  '#6C5CE7', '#A29BFE', '#00CEC9', '#81ECEC', '#00B894',
  '#FDCB6E', '#FF6B6B', '#74B9FF', '#FD79A8', '#E17055',
  '#636E72', '#B2BEC3', '#DFE6E9', '#55EFC4', '#FAB1A0',
];

const presetIcons: IoniconsName[] = [
  'restaurant-outline', 'car-outline', 'home-outline', 'medkit-outline',
  'school-outline', 'game-controller-outline', 'shirt-outline', 'gift-outline',
  'airplane-outline', 'fitness-outline', 'musical-notes-outline', 'paw-outline',
  'wifi-outline', 'construct-outline', 'leaf-outline', 'flash-outline',
];

const emptyForm = { name: '', category_type: 'expense' as CategoryType, color: '#6C5CE7', icon: '' };

// ── Settings Item Component ──
function SettingsItem({ icon, label, value, onPress, danger }: {
  icon: IoniconsName; label: string; value?: string; onPress?: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[styles.itemIcon, danger && styles.itemIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, danger && styles.itemLabelDanger]}>{label}</Text>
        {value ? <Text style={styles.itemValue}>{value}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const household = useHouseholdStore((s) => s.currentHousehold);
  const queryClient = useQueryClient();

  const [showCategories, setShowCategories] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState<CategoryType | ''>('');

  // ── Queries ──
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['all-categories', household?.id],
    queryFn: () => categoriesApi.list(household!.id),
    enabled: !!household && showCategories,
  });

  // ── Mutations ──
  const createCat = useMutation({
    mutationFn: (d: { name: string; category_type: CategoryType; color?: string; icon?: string }) =>
      categoriesApi.create(household!.id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-categories'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); closeCatForm(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create'),
  });

  const updateCat = useMutation({
    mutationFn: ({ id, d }: { id: string; d: { name?: string; color?: string; icon?: string } }) =>
      categoriesApi.update(household!.id, id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-categories'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); closeCatForm(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update'),
  });

  const deleteCat = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(household!.id, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-categories'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete'),
  });

  // ── Handlers ──
  const closeCatForm = () => { setShowCatForm(false); setEditingCat(null); setForm(emptyForm); };

  const openCreateCat = () => {
    setEditingCat(null);
    setForm({ ...emptyForm, category_type: (filterType || 'expense') as CategoryType });
    setShowCatForm(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setForm({ name: cat.name, category_type: cat.category_type as CategoryType, color: cat.color || '#6C5CE7', icon: cat.icon || '' });
    setShowCatForm(true);
  };

  const handleSaveCat = useCallback(() => {
    if (!form.name.trim()) return;
    if (editingCat) {
      updateCat.mutate({ id: editingCat.id, d: { name: form.name.trim(), color: form.color || undefined, icon: form.icon || undefined } });
    } else {
      createCat.mutate({ name: form.name.trim(), category_type: form.category_type, color: form.color || undefined, icon: form.icon || undefined });
    }
  }, [form, editingCat]);

  const handleDeleteCat = (cat: Category) => {
    Alert.alert('Delete Category', `Delete "${cat.name}"? Expenses using it won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCat.mutate(cat.id) },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const filteredCats = categories?.filter((c: Category) => !filterType || c.category_type === filterType) || [];
  const grouped = categoryTypes.map(t => ({
    ...t,
    items: filteredCats.filter((c: Category) => c.category_type === t.key),
  })).filter(g => !filterType || g.key === filterType);

  const isPending = createCat.isPending || updateCat.isPending;

  // ── Render Category Card ──
  const renderCat = (cat: Category) => {
    const meta = categoryTypes.find(t => t.key === cat.category_type);
    return (
      <TouchableOpacity key={cat.id} style={styles.catCard} onPress={() => openEditCat(cat)} onLongPress={() => handleDeleteCat(cat)} activeOpacity={0.7}>
        <View style={[styles.catColorDot, { backgroundColor: cat.color || meta?.color || colors.primary }]} />
        {cat.icon ? (
          <Ionicons name={cat.icon as IoniconsName} size={18} color={colors.textPrimary} style={{ marginRight: spacing.xs }} />
        ) : null}
        <Text style={styles.catName}>{cat.name}</Text>
        {cat.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        )}
        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name || user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.full_name || 'Traccoon User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingsItem icon="person-outline" label="Full Name" value={user?.full_name || '—'} />
          <SettingsItem icon="mail-outline" label="Email" value={user?.email} />
        </View>

        {/* Household */}
        <Text style={styles.sectionTitle}>Household</Text>
        <View style={styles.section}>
          <SettingsItem icon="home-outline" label="Current Household" value={household?.name || 'None selected'} />
          <SettingsItem icon="shield-outline" label="Your Role" value={household?.my_role || '—'} />
        </View>

        {/* Management */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="pricetags-outline"
            label="Manage Categories"
            value={`Organize your expense, budget & inventory categories`}
            onPress={() => setShowCategories(true)}
          />
        </View>

        {/* App */}
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.section}>
          <SettingsItem icon="information-circle-outline" label="Version" value="1.0.0" />
        </View>

        {/* Sign Out */}
        <View style={[styles.section, { marginTop: spacing.md }]}>
          <SettingsItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
        </View>
      </ScrollView>

      {/* ══════ Categories Management Modal ══════ */}
      <Modal visible={showCategories} animationType="slide" onRequestClose={() => setShowCategories(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.catHeader}>
            <TouchableOpacity onPress={() => setShowCategories(false)}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.catHeaderTitle}>Categories</Text>
            <TouchableOpacity onPress={openCreateCat} style={styles.catAddBtn}>
              <Ionicons name="add" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Type filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilterRow} contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md }}>
            <TouchableOpacity
              style={[styles.typeChip, !filterType && styles.typeChipActive]}
              onPress={() => setFilterType('')}
            >
              <Text style={[styles.typeChipText, !filterType && styles.typeChipTextActive]}>All</Text>
            </TouchableOpacity>
            {categoryTypes.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeChip, filterType === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => setFilterType(filterType === t.key ? '' : t.key)}
              >
                <Ionicons name={t.icon} size={14} color={filterType === t.key ? colors.white : colors.textSecondary} />
                <Text style={[styles.typeChipText, filterType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {catsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
              {grouped.map(group => (
                group.items.length > 0 && (
                  <View key={group.key} style={{ marginBottom: spacing.lg }}>
                    <View style={styles.groupHeader}>
                      <Ionicons name={group.icon} size={16} color={group.color} />
                      <Text style={[styles.groupTitle, { color: group.color }]}>{group.label}</Text>
                      <Text style={styles.groupCount}>{group.items.length}</Text>
                    </View>
                    {group.items.map(renderCat)}
                  </View>
                )
              ))}
              {filteredCats.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="pricetags-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No categories yet</Text>
                  <Text style={styles.emptySubtext}>Tap + to create one</Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>

        {/* ── Create/Edit Category Sub-Modal ── */}
        <Modal visible={showCatForm} transparent animationType="slide" onRequestClose={closeCatForm}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingCat ? 'Edit Category' : 'New Category'}</Text>
                <TouchableOpacity onPress={closeCatForm}>
                  <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(t) => setForm(f => ({ ...f, name: t }))}
                  placeholder="Category name..."
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />

                {/* Type selector (only for new) */}
                {!editingCat && (
                  <>
                    <Text style={styles.label}>Type *</Text>
                    <View style={styles.typeRow}>
                      {categoryTypes.map(t => (
                        <TouchableOpacity
                          key={t.key}
                          style={[styles.typeSel, form.category_type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                          onPress={() => setForm(f => ({ ...f, category_type: t.key }))}
                        >
                          <Ionicons name={t.icon} size={14} color={form.category_type === t.key ? colors.white : colors.textSecondary} />
                          <Text style={[styles.typeSelText, form.category_type === t.key && { color: colors.white }]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Color picker */}
                <Text style={styles.label}>Color</Text>
                <View style={styles.colorRow}>
                  {presetColors.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
                      onPress={() => setForm(f => ({ ...f, color: c }))}
                    >
                      {form.color === c && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Icon picker */}
                <Text style={styles.label}>Icon</Text>
                <View style={styles.iconRow}>
                  <TouchableOpacity
                    style={[styles.iconBtn, !form.icon && styles.iconBtnActive]}
                    onPress={() => setForm(f => ({ ...f, icon: '' }))}
                  >
                    <Text style={[styles.iconBtnText, !form.icon && { color: colors.white }]}>None</Text>
                  </TouchableOpacity>
                  {presetIcons.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[styles.iconBtn, form.icon === ic && styles.iconBtnActive]}
                      onPress={() => setForm(f => ({ ...f, icon: ic }))}
                    >
                      <Ionicons name={ic} size={18} color={form.icon === ic ? colors.white : colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview */}
                <Text style={styles.label}>Preview</Text>
                <View style={styles.previewCard}>
                  <View style={[styles.catColorDot, { backgroundColor: form.color }]} />
                  {form.icon ? <Ionicons name={form.icon as IoniconsName} size={18} color={colors.textPrimary} style={{ marginRight: spacing.xs }} /> : null}
                  <Text style={styles.catName}>{form.name || 'Category name'}</Text>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnSecondary} onPress={closeCatForm}>
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, !form.name.trim() && styles.btnDisabled]}
                  onPress={handleSaveCat}
                  disabled={!form.name.trim() || isPending}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>{editingCat ? 'Update' : 'Create'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  // Profile
  profileCard: {
    alignItems: 'center', padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.lg,
  },
  avatar: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', marginBottom: spacing.sm,
  },
  avatarText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.white },
  profileName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  profileEmail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Sections
  sectionTitle: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
    color: colors.textMuted, marginBottom: spacing.xs,
    marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1,
  },
  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: 'rgba(108,92,231,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  itemIconDanger: { backgroundColor: 'rgba(255,107,107,0.15)' },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: fontSize.md, color: colors.textPrimary },
  itemLabelDanger: { color: colors.danger },
  itemValue: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },

  // Categories header
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  catHeaderTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  catAddBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },

  // Type filter
  typeFilterRow: { flexGrow: 0, marginVertical: spacing.sm },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  typeChipTextActive: { color: colors.white, fontWeight: fontWeight.semibold },

  // Group
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginBottom: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  groupTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
  groupCount: {
    fontSize: fontSize.xs, color: colors.textMuted,
    backgroundColor: colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radius.full,
  },

  // Category card
  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  catColorDot: { width: 12, height: 12, borderRadius: 6 },
  catName: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, fontWeight: fontWeight.medium },
  defaultBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
    backgroundColor: 'rgba(108,92,231,0.15)',
  },
  defaultBadgeText: { fontSize: 10, color: colors.primary, fontWeight: fontWeight.semibold },

  // Empty
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: fontWeight.medium },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textMuted },

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

  // Type selector
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeSel: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  typeSelText: { fontSize: fontSize.xs, color: colors.textSecondary },

  // Color picker
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  colorDotActive: { borderWidth: 3, borderColor: colors.white },

  // Icon picker
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  iconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconBtnText: { fontSize: fontSize.xs, color: colors.textSecondary },

  // Preview
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight,
  },

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
