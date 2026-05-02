import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { householdsApi } from '@/api/households';
import { useAuthStore } from '@/stores/auth-store';
import { useHouseholdStore } from '@/stores/household-store';
import type { HouseholdWithRole, HouseholdMember, HouseholdDetail } from '@/types';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Role badge helpers ──
const roleMeta: Record<string, { icon: IoniconsName; color: string }> = {
  owner: { icon: 'shield', color: colors.warning },
  admin: { icon: 'shield-half', color: colors.primary },
  member: { icon: 'person', color: colors.accent },
  viewer: { icon: 'eye', color: colors.textMuted },
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { currentHousehold, setCurrentHousehold } = useHouseholdStore();
  const queryClient = useQueryClient();

  // ── State ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'viewer'>('member');

  // ── Queries ──
  const { data: households, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['households'],
    queryFn: householdsApi.list,
  });

  const { data: householdDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['household-detail', currentHousehold?.id],
    queryFn: () => householdsApi.get(currentHousehold!.id),
    enabled: !!currentHousehold && showDetailModal,
  });

  // Auto-select first household if none selected
  useEffect(() => {
    if (households?.length && !currentHousehold) {
      setCurrentHousehold(households[0]);
    }
  }, [households]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      householdsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setCreateName('');
      setCreateDesc('');
      setShowCreateModal(false);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create household');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      householdsApi.addMember(currentHousehold!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-detail', currentHousehold?.id] });
      setInviteEmail('');
      Alert.alert('Success', 'Member invited successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      householdsApi.removeMember(currentHousehold!.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-detail', currentHousehold?.id] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove member');
    },
  });

  // ── Handlers ──
  const handleCreate = useCallback(() => {
    if (!createName.trim()) return;
    createMutation.mutate({
      name: createName.trim(),
      description: createDesc.trim() || undefined,
    });
  }, [createName, createDesc]);

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim()) return;
    addMemberMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }, [inviteEmail, inviteRole]);

  const handleRemoveMember = useCallback((member: HouseholdMember) => {
    const isMe = member.user_id === user?.id;
    Alert.alert(
      isMe ? 'Leave Household' : 'Remove Member',
      isMe
        ? 'Are you sure you want to leave this household?'
        : `Remove ${member.user_full_name || member.user_email} from this household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isMe ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: () => removeMemberMutation.mutate(member.id),
        },
      ],
    );
  }, [user, currentHousehold]);

  // ── Render Household Card ──
  const renderHousehold = ({ item }: { item: HouseholdWithRole }) => {
    const isActive = currentHousehold?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardActive]}
        onPress={() => setCurrentHousehold(item)}
        onLongPress={() => {
          setCurrentHousehold(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIcon, isActive && styles.cardIconActive]}>
          <Ionicons name="home" size={24} color={isActive ? colors.white : colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.roleChip}>
            <Ionicons
              name={roleMeta[item.my_role]?.icon || 'person'}
              size={12}
              color={roleMeta[item.my_role]?.color || colors.textMuted}
            />
            <Text style={styles.roleText}>{item.my_role}</Text>
          </View>
        </View>
        {isActive && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // ── Render Member Row ──
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
          <Text style={styles.memberName}>
            {member.user_full_name || 'Traccoon User'}{isMe ? ' (you)' : ''}
          </Text>
          <Text style={styles.memberEmail}>{member.user_email}</Text>
        </View>
        <View style={[styles.memberRoleBadge, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.memberRoleText, { color: meta.color }]}>{member.role}</Text>
        </View>
        {canRemove && member.role !== 'owner' && (
          <TouchableOpacity
            style={styles.memberRemoveBtn}
            onPress={() => handleRemoveMember(member)}
          >
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingSmall}>Welcome back,</Text>
            <Text style={styles.greetingName}>{user?.full_name || user?.email} 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name || user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        {currentHousehold && (
          <TouchableOpacity
            style={styles.statsRow}
            activeOpacity={0.8}
            onPress={() => setShowDetailModal(true)}
          >
            <View style={[styles.statCard, { backgroundColor: 'rgba(108,92,231,0.15)' }]}>
              <Ionicons name="home" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{currentHousehold.name}</Text>
              <Text style={styles.statLabel}>Active Household</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0,206,201,0.15)' }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
              <Text style={styles.statValue}>{currentHousehold.my_role}</Text>
              <Text style={styles.statLabel}>Your Role</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0,184,148,0.15)' }]}>
              <Ionicons name="people" size={20} color={colors.success} />
              <Text style={styles.statValue}>Manage</Text>
              <Text style={styles.statLabel}>Tap to View</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Households */}
        <Text style={styles.sectionTitle}>Your Households</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={households}
            keyExtractor={(item) => item.id}
            renderItem={renderHousehold}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="home-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No households yet</Text>
                <Text style={styles.emptySubtext}>Tap + to create one!</Text>
              </View>
            }
          />
        )}

        {/* FAB — Create Household */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>

        {/* ══════ Create Household Modal ══════ */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Create Household</Text>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={createName}
                onChangeText={setCreateName}
                placeholder="My Home"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={createDesc}
                onChangeText={setCreateDesc}
                placeholder="A short description..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => {
                    setCreateName('');
                    setCreateDesc('');
                    setShowCreateModal(false);
                  }}
                >
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, !createName.trim() && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={!createName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ══════ Household Detail / Members Modal ══════ */}
        <Modal
          visible={showDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContent, styles.modalContentTall]}>
              <View style={styles.modalHandle} />
              <View style={styles.detailHeader}>
                <Text style={styles.modalTitle}>
                  {currentHousehold?.name || 'Household'}
                </Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {currentHousehold?.description ? (
                <Text style={styles.detailDesc}>{currentHousehold.description}</Text>
              ) : null}

              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                {/* Members List */}
                <Text style={styles.detailSectionTitle}>
                  Members{householdDetail?.members ? ` (${householdDetail.members.length})` : ''}
                </Text>

                {isDetailLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                ) : (
                  householdDetail?.members.map(renderMember)
                )}

                {/* Invite Section — Only for owners/admins */}
                {(householdDetail?.my_role === 'owner' || householdDetail?.my_role === 'admin') && (
                  <View style={styles.inviteSection}>
                    <Text style={styles.detailSectionTitle}>Invite Member</Text>
                    <TextInput
                      style={styles.input}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      placeholder="Enter their email address"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    {/* Role Selector */}
                    <View style={styles.roleSelector}>
                      {(['member', 'admin', 'viewer'] as const).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleSelectorBtn, inviteRole === r && styles.roleSelectorActive]}
                          onPress={() => setInviteRole(r)}
                        >
                          <Ionicons
                            name={roleMeta[r]?.icon || 'person'}
                            size={14}
                            color={inviteRole === r ? colors.white : colors.textSecondary}
                          />
                          <Text style={[
                            styles.roleSelectorText,
                            inviteRole === r && styles.roleSelectorTextActive
                          ]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.btnPrimary, styles.inviteBtn, !inviteEmail.trim() && styles.btnDisabled]}
                      onPress={handleInvite}
                      disabled={!inviteEmail.trim() || addMemberMutation.isPending}
                    >
                      {addMemberMutation.isPending ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="person-add" size={18} color={colors.white} />
                          <Text style={styles.btnPrimaryText}>Send Invite</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
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

  // ── Greeting ──
  greeting: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: spacing.md,
  },
  greetingSmall: { fontSize: fontSize.sm, color: colors.textSecondary },
  greetingName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  avatar: {
    width: 48, height: 48, borderRadius: radius.full,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.white },

  // ── Stats ──
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs,
  },
  statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary },

  // ── Section ──
  sectionTitle: {
    fontSize: fontSize.lg, fontWeight: fontWeight.bold,
    color: colors.textPrimary, marginBottom: spacing.sm,
  },

  // ── List ──
  list: { gap: spacing.sm, paddingBottom: 100 },

  // ── Household Card ──
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  cardActive: { borderColor: colors.primary },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: 'rgba(108,92,231,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  cardIconActive: { backgroundColor: colors.primary },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary },
  roleChip: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, backgroundColor: colors.surfaceElevated, marginTop: 4,
  },
  roleText: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'capitalize' },

  // ── Empty ──
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: fontWeight.medium },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textMuted },

  // ── FAB ──
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay,
  },
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
  modalTitle: {
    fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
  },

  // ── Form ──
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

  // ── Buttons ──
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white },
  btnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textSecondary },
  btnDisabled: { opacity: 0.5 },

  // ── Detail Modal ──
  detailHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  detailDesc: {
    fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md,
  },
  detailScroll: { marginTop: spacing.sm },
  detailSectionTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  // ── Member Row ──
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
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

  // ── Invite Section ──
  inviteSection: {
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  roleSelector: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
  },
  roleSelectorBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight,
  },
  roleSelectorActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  roleSelectorText: {
    fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'capitalize',
  },
  roleSelectorTextActive: { color: colors.white },
  inviteBtn: { marginTop: spacing.md, flex: 0, paddingHorizontal: spacing.lg },
});
