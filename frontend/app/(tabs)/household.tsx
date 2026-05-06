import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { useHouseholdStore } from '@/stores/household-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { categoriesApi } from '@/api/categories';
import { householdsApi } from '@/api/households';
import type { Category, CategoryType, HouseholdMember, HouseholdDetail } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won', flag: '🇰🇷' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
];

const roleMeta: Record<string, { icon: IoniconsName; color: string }> = {
  owner: { icon: 'shield', color: colors.warning },
  admin: { icon: 'shield-half', color: colors.secondary },
  member: { icon: 'person', color: colors.accent },
  viewer: { icon: 'eye', color: colors.textMuted },
};

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
        {value ? <Text style={styles.itemValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

export default function HouseholdScreen() {
  const { user, logout } = useAuthStore();
  const { currentHousehold: household, setCurrentHousehold } = useHouseholdStore();
  const { currency, setCurrency } = useCurrencyStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showMembers, setShowMembers] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'viewer'>('member');

  // ── Queries ──
  const { data: households, isLoading: isHouseholdsLoading } = useQuery({
    queryKey: ['households'],
    queryFn: householdsApi.list,
  });
  const { data: householdDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['household-detail', household?.id],
    queryFn: () => householdsApi.get(household!.id),
    enabled: !!household && showMembers,
  });

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['all-categories', household?.id],
    queryFn: () => categoriesApi.list(household!.id),
    enabled: !!household && showCategories,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => householdsApi.create(data),
    onSuccess: (newHousehold) => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setCreateName(''); setCreateDesc(''); setShowCreateModal(false);
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.detail || 'Failed to create household'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => householdsApi.addMember(household!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-detail', household?.id] });
      setInviteEmail('');
      Alert.alert('Success', 'Member invited successfully!');
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.detail || 'Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => householdsApi.removeMember(household!.id, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household-detail', household?.id] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove member'),
  });

  const handleCreate = useCallback(() => {
    if (!createName.trim()) return;
    createMutation.mutate({ name: createName.trim(), description: createDesc.trim() || undefined });
  }, [createName, createDesc]);

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim()) return;
    addMemberMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }, [inviteEmail, inviteRole]);

  const handleRemoveMember = useCallback((member: HouseholdMember) => {
    const isMe = member.user_id === user?.id;
    Alert.alert(
      isMe ? 'Leave Household' : 'Remove Member',
      isMe ? 'Are you sure you want to leave?' : `Remove ${member.user_full_name || member.user_email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isMe ? 'Leave' : 'Remove', style: 'destructive', onPress: () => removeMemberMutation.mutate(member.id) },
      ],
    );
  }, [user, household]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const renderMember = (member: HouseholdMember) => {
    const meta = roleMeta[member.role] || roleMeta.member;
    const isMe = member.user_id === user?.id;
    const canRemove = householdDetail?.my_role === 'owner' || isMe;
    return (
      <View key={member.id} style={styles.memberRow}>
        <View style={[styles.memberAvatar, { backgroundColor: meta.color + '30' }]}>
          <Text style={[styles.memberAvatarText, { color: meta.color }]}>
            {(member.user_full_name || member.user_email)?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.user_full_name || 'Traccoon User'}{isMe ? ' (you)' : ''}</Text>
          <Text style={styles.memberEmail}>{member.user_email}</Text>
        </View>
        <View style={[styles.memberRoleBadge, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.memberRoleText, { color: meta.color }]}>{member.role}</Text>
        </View>
        {canRemove && member.role !== 'owner' && (
          <TouchableOpacity style={styles.memberRemoveBtn} onPress={() => handleRemoveMember(member)}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Text style={styles.headerTitle}>Household</Text>

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

        {/* Household Info */}
        <Text style={styles.sectionTitle}>Household</Text>
        <View style={styles.section}>
          <SettingsItem 
            icon="home-outline" 
            label="Current Household" 
            value={household?.name || 'None selected'} 
            onPress={() => setShowSwitchModal(true)}
          />
          <SettingsItem icon="shield-outline" label="Your Role" value={household?.my_role || '—'} />
          <SettingsItem 
            icon="add-circle-outline" 
            label="Create New Household" 
            onPress={() => setShowCreateModal(true)} 
          />
        </View>

        {/* Management */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="people-outline"
            label="Members"
            value="Manage household members"
            onPress={() => setShowMembers(true)}
          />
          <SettingsItem
            icon="pricetags-outline"
            label="Categories"
            value="Manage expense, budget & inventory categories"
            onPress={() => router.push('/household/categories')}
          />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.section}>
          <SettingsItem
            icon="cash-outline"
            label="Currency"
            value={`${currency.symbol} ${currency.code}`}
            onPress={() => setShowCurrency(true)}
          />
          <SettingsItem icon="information-circle-outline" label="Version" value="1.0.0" />
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingsItem icon="person-outline" label="Full Name" value={user?.full_name || '—'} />
          <SettingsItem icon="mail-outline" label="Email" value={user?.email} />
        </View>

        {/* Sign Out */}
        <View style={[styles.section, { marginTop: spacing.md }]}>
          <SettingsItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
        </View>
      </ScrollView>

      {/* ══════ Members Modal ══════ */}
      <Modal visible={showMembers} animationType="slide" onRequestClose={() => setShowMembers(false)}>
        <View style={[styles.safe, { paddingTop: Platform.OS === 'android' ? 40 : Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMembers(false)}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Members</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
            {isDetailLoading ? (
              <ActivityIndicator color={colors.secondary} style={{ marginVertical: spacing.md }} />
            ) : (
              householdDetail?.members?.map(renderMember)
            )}

            {/* Invite Section */}
            {(householdDetail?.my_role === 'owner' || householdDetail?.my_role === 'admin') && (
              <View style={styles.inviteSection}>
                <Text style={styles.inviteSectionTitle}>Invite Member</Text>
                <TextInput
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.roleSelector}>
                  {(['member', 'admin', 'viewer'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleSelectorBtn, inviteRole === r && styles.roleSelectorActive]}
                      onPress={() => setInviteRole(r)}
                    >
                      <Ionicons name={roleMeta[r]?.icon || 'person'} size={14} color={inviteRole === r ? colors.neutral : colors.textSecondary} />
                      <Text style={[styles.roleSelectorText, inviteRole === r && styles.roleSelectorTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.btnPrimary, !inviteEmail.trim() && styles.btnDisabled]}
                  onPress={handleInvite}
                  disabled={!inviteEmail.trim() || addMemberMutation.isPending}
                >
                  {addMemberMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.neutral} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color={colors.neutral} />
                      <Text style={styles.btnPrimaryText}>Send Invite</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ══════ Currency Modal ══════ */}
      <Modal visible={showCurrency} transparent animationType="slide" onRequestClose={() => setShowCurrency(false)}>
        <View style={styles.currencyOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCurrency(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.currencySheetWrapper}>
            <View style={styles.currencySheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCurrency(false)} style={{ padding: spacing.xs }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Select Currency</Text>
                <View style={{ width: 32 }} />
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.currencyRow, currency.code === c.code && styles.currencyRowActive]}
                  onPress={() => { setCurrency(c); setShowCurrency(false); }}
                >
                  <Text style={styles.currencySymbol}>{c.symbol}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currencyCode}>{c.code}</Text>
                    <Text style={styles.currencyName}>{c.name}</Text>
                  </View>
                  {currency.code === c.code && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════ Switch Household Modal ══════ */}
      <Modal visible={showSwitchModal} transparent animationType="slide" onRequestClose={() => setShowSwitchModal(false)}>
        <View style={styles.currencyOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSwitchModal(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.currencySheetWrapper}>
            <View style={styles.currencySheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowSwitchModal(false)} style={{ padding: spacing.xs }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Switch Household</Text>
                <View style={{ width: 32 }} />
              </View>
              {isHouseholdsLoading ? (
                <ActivityIndicator color={colors.secondary} style={{ marginVertical: spacing.md }} />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
                {households?.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.currencyRow, household?.id === h.id && styles.currencyRowActive]}
                    onPress={() => { setCurrentHousehold(h); setShowSwitchModal(false); }}
                  >
                    <Ionicons name="home" size={20} color={household?.id === h.id ? colors.success : colors.textMuted} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currencyCode}>{h.name}</Text>
                      <Text style={styles.currencyName}>{h.my_role}</Text>
                    </View>
                    {household?.id === h.id && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
                  </TouchableOpacity>
                ))}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════ Create Household Modal ══════ */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.currencyOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCreateModal(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.currencySheetWrapper}>
            <View style={[styles.currencySheet, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ padding: spacing.xs }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>New Household</Text>
                <View style={{ width: 32 }} />
              </View>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: 4 }}>Name *</Text>
            <TextInput
              style={styles.input}
              value={createName}
              onChangeText={setCreateName}
              placeholder="My Home"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: 4, marginTop: spacing.md }}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={createDesc}
              onChangeText={setCreateDesc}
              placeholder="Optional description..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight }]} onPress={() => { setCreateName(''); setCreateDesc(''); setShowCreateModal(false); }}>
                <Text style={[styles.btnPrimaryText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }, !createName.trim() && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={!createName.trim() || createMutation.isPending}
              >
                {createMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.neutral} />
                  : <Text style={styles.btnPrimaryText}>Create</Text>}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  headerTitle: {
    fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.tertiary,
    marginBottom: spacing.md,
  },

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
  avatarText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
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
    backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center',
  },
  itemIconDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: fontSize.md, color: colors.textPrimary },
  itemLabelDanger: { color: colors.danger },
  itemValue: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },

  // Modal header
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalHeaderTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },

  // Members
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

  // Invite
  inviteSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
  inviteSectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  roleSelector: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  roleSelectorBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight,
  },
  roleSelectorActive: { backgroundColor: colors.tertiary, borderColor: colors.tertiary },
  roleSelectorText: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'capitalize' },
  roleSelectorTextActive: { color: colors.neutral },

  // Buttons
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.tertiary, borderRadius: radius.md,
    paddingVertical: spacing.md, marginTop: spacing.md,
  },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.neutral },
  btnDisabled: { opacity: 0.4 },

  // Currency modal
  currencyOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  currencySheetWrapper: { width: '100%', maxHeight: '80%' },
  currencySheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, paddingBottom: spacing.xl,
  },

  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  currencyRowActive: { backgroundColor: `${colors.success}10` },
  currencySymbol: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.tertiary, width: 36, textAlign: 'center' },
  currencyCode: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  currencyName: { fontSize: fontSize.xs, color: colors.textMuted },
});
