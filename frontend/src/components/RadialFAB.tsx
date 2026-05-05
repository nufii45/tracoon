
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionItem {
  label: string;
  icon: string;   // emoji icon — swap for an icon library if preferred
  route: string;  
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTIONS: ActionItem[] = [
  { label: 'Expense',   icon: '', route: '/(tabs)/expenses'  },
  { label: 'Budget',    icon: '', route: '/(tabs)/budgets'   },
  { label: 'Inventory', icon: '', route: '/(tabs)/inventory' },
];

const FAB_SIZE     = 58;
const ACTION_SIZE  = 44;   // min 44dp for comfortable touch target
const ITEM_SPACING = 64;   // vertical gap between each action button center
const ANIMATION_MS = 260;

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

  // Per-action animated values
  const actionAnims = useRef(ACTIONS.map(() => new Animated.Value(0))).current;

  function toggle() {
    const toValue   = open ? 0 : 1;
    const isOpening = !open;
    setOpen(isOpening);

    // Items closest to FAB animate first when opening; reverse when closing
    const actionAnimations = actionAnims.map((anim, i) => {
      const staggerIndex = isOpening ? i : ACTIONS.length - 1 - i;
      return Animated.timing(anim, {
        toValue,
        duration: ANIMATION_MS,
        delay: staggerIndex * 45,
        easing: isOpening
          ? Easing.out(Easing.back(1.4))
          : Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
    });

    Animated.parallel([
      Animated.timing(progress, {
        toValue,
        duration: ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...actionAnimations,
    ]).start();
  }

  function handleAction(route: string) {
    const closeAnims = actionAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        delay: (ACTIONS.length - 1 - i) * 25,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      ...closeAnims,
    ]).start(() => {
      setOpen(false);
      router.push(route as any);
    });
  }

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ── Scrim (tap outside to close) ── */}
      {open && (
        <Pressable style={StyleSheet.absoluteFill} onPress={toggle} />
      )}

      {/* ── Action Buttons ── */}
      {ACTIONS.map((action, i) => {
        // Each item slides straight up from the FAB.
        // Index 0 is closest to FAB, index N-1 is furthest.
        const destinationY = -(ITEM_SPACING * (i + 1));

        const translateY = actionAnims[i].interpolate({
          inputRange:  [0, 1],
          outputRange: [0, destinationY],
        });
        const opacity = actionAnims[i].interpolate({
          inputRange:  [0, 0.2, 1],
          outputRange: [0, 0,   1],
        });
        const scale = actionAnims[i].interpolate({
          inputRange:  [0, 1],
          outputRange: [0.5, 1],
        });

        return (
          <Animated.View
            key={action.route}
            style={[
              styles.actionWrapper,
              { opacity, transform: [{ translateY }, { scale }] },
            ]}
          >
            {/* Label pill — to the left of the button */}
            <Animated.View
              style={[
                styles.labelPill,
                { opacity },
              ]}
            >
              <Text style={styles.labelText}>{action.label}</Text>
            </Animated.View>

            <Pressable
              onPress={() => handleAction(action.route)}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
            </Pressable>
          </Animated.View>
        );
      })}

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
  /**
   * The container sits at the bottom-right corner of the screen.
   * Add this component as the last child inside a `flex: 1` View or
   * inside a <Stack.Screen> layout that renders it as an overlay.
   */
  container: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── FAB ──
  fab: {
    width:  FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#2D2D2D',   // Mine Shaft — swap with theme token
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  fabOpen: {
    backgroundColor: '#3A3A3A',
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  fabIcon: {
    fontSize: 28,
    lineHeight: 32,
    color: '#F5F0E8',             // Akaroa — swap with theme token
    fontWeight: '300',
  },

  // ── Action button ──
  actionWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width:  ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    backgroundColor: '#F5F0E8',   // Akaroa
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 5,
    elevation: 5,
  },
  actionButtonPressed: {
    opacity: 0.80,
    transform: [{ scale: 0.93 }],
  },
  actionIcon: {
    fontSize: 22,
  },

  // ── Label pill ──
  labelPill: {
    backgroundColor: 'rgba(45,45,45,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  labelText: {
    color: '#F5F0E8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});