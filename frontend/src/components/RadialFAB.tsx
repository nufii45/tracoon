import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ActionItem {
  label: string;
  icon: IoniconsName;
  route: string;  
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTIONS: ActionItem[] = [
  { label: 'Expense',   icon: 'cash-outline', route: '/expenses'  },
  { label: 'Finance',   icon: 'pie-chart-outline', route: '/(tabs)/finance'   },
  { label: 'Inventory', icon: 'cube-outline', route: '/(tabs)/inventory' },
  { label: 'Scan Receipt', icon: 'scan-outline', route: '#' }, // Placeholder for OCR
];

const FAB_SIZE = 58;
const ANIMATION_MS = 200;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadialFAB() {
  const [open, setOpen] = useState(false);

  // Master progress: 0 = closed, 1 = open
  const progress = useRef(new Animated.Value(0)).current;

  // Rotation for the +/× icon
  const rotation = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '135deg'], // 135° turns "+" into "×"
  });

  // Menu animations
  const menuScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const menuOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const menuTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  function toggle() {
    const toValue = open ? 0 : 1;
    setOpen(!open);
    Animated.timing(progress, {
      toValue,
      duration: ANIMATION_MS,
      easing: open ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function handleAction(route: string) {
    Animated.timing(progress, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      router.push(route as any);
    });
  }

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ── Scrim (tap outside to close) ── */}
      {open && (
        <Pressable style={styles.scrim} onPress={toggle} />
      )}

      {/* ── Popover Menu ── */}
      <Animated.View
        style={[
          styles.menu,
          {
            opacity: menuOpacity,
            transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
            pointerEvents: open ? 'auto' : 'none',
          },
        ]}
      >
        {ACTIONS.map((action, i) => (
          <Pressable
            key={action.route}
            style={({ pressed }) => [
              styles.menuItem,
              i < ACTIONS.length - 1 && styles.menuItemBorder,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => handleAction(action.route)}
          >
            <Ionicons name={action.icon} size={20} color={colors.tertiary} />
            <Text style={styles.menuItemText}>{action.label}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* ── Main FAB ── */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.fab,
          open    && styles.fabOpen,
          pressed && styles.fabPressed,
        ]}
      >
        <Animated.Text
          style={[styles.fabIcon, { transform: [{ rotate: rotation }] }]}
        >
          +
        </Animated.Text>
      </Pressable>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  
  // ── Popover Menu ──
  menu: {
    position: 'absolute',
    bottom: 100, // Slightly above the FAB
    right: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    minWidth: 160,
    shadowColor: colors.tertiary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Pivot from bottom right for scale animation
    transformOrigin: 'bottom right',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },

  // ── Main FAB ──
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width:  FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.tertiary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 8,
  },
  fabOpen: {
    backgroundColor: colors.textPrimary,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  fabIcon: {
    fontSize: 32,
    lineHeight: 36,
    color: colors.neutral,
    fontWeight: '300',
  },
});