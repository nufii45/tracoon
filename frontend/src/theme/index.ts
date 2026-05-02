/** Traccoon Design Tokens — Akaroa / Mine Shaft palette (contrast-fixed) */

export const colors = {
  // ── Primary scale (Akaroa — warm tan/beige) ──
  primary50: '#F5F0E8',
  primary100: '#EAE0D2',
  primary200: '#DDD0B8',
  primary300: '#D7C9AE',   // Akaroa
  primary400: '#CDBFA0',
  primary500: '#C4B090',
  primary600: '#B8A07C',
  primary700: '#A89068',
  primary800: '#947A50',
  primary: '#D7C9AE',
  primaryLight: '#EAE0D2',
  primaryDark: '#C4B090',

  // ── Secondary scale (Barley Corn — warm brown) ──
  secondary50: '#F2EBE0',
  secondary100: '#E0CDB0',
  secondary200: '#CEAF80',
  secondary300: '#BE9668',
  secondary400: '#B08050',
  secondary500: '#A68763',
  secondary600: '#8A6E4E',
  secondary700: '#705638',
  secondary800: '#584028',
  secondary: '#A68763',
  secondaryLight: '#BE9668',
  secondaryDark: '#8A6E4E',

  // ── Tertiary scale (Mine Shaft — dark charcoal) ──
  tertiary50: '#6B6B6B',
  tertiary100: '#5A5A5A',
  tertiary200: '#4A4A4A',
  tertiary300: '#3D3D3D',
  tertiary400: '#333333',
  tertiary500: '#2D2D2D',
  tertiary600: '#242424',
  tertiary700: '#1A1A1A',
  tertiary800: '#111111',
  tertiary: '#2D2D2D',
  tertiaryLight: '#4A4A4A',
  tertiaryDark: '#1A1A1A',

  // ── Neutral ──
  neutral: '#F5F0E8',       // lightest warm white — text on dark surfaces

  // ── Semantic aliases ──
  accent: '#A68763',
  accentLight: '#C4A882',
  accentDark: '#8A6E4E',

  // ── Backgrounds ──
  // KEY FIX: page bg is the lightest value so cards can sit above it visibly
  background: '#F5F0E8',       // lightest warm white — page bg
  surface: '#FFFFFF',          // pure white — cards float clearly above bg
  surfaceElevated: '#EAE0D2',  // White Rock — inputs, inner sections
  surfaceDark: '#2D2D2D',      // Mine Shaft — inverted/dark cards

  // ── Borders ──
  // KEY FIX: borderLight must be darker than surface so it's actually visible
  border: '#C4B090',           // Akaroa dark — strong borders
  borderLight: '#DDD0B8',      // primary200 — subtle dividers (visible on white)

  // ── Text ──
  // KEY FIX: textMuted needs to be dark enough to read on both bg and surface
  textPrimary: '#2D2D2D',      // Mine Shaft — headings, body
  textSecondary: '#705638',    // secondary700 — secondary labels (darker brown)
  textMuted: '#8A6E4E',        // secondary600 — placeholders, captions
  textInverse: '#F5F0E8',      // lightest warm — text on dark surfaces
  textOnDark: '#F5F0E8',

  // ── Button variants ──
  btnPrimary: '#2D2D2D',
  btnPrimaryText: '#F5F0E8',
  btnSecondary: '#EAE0D2',
  btnSecondaryText: '#2D2D2D',
  btnInverted: '#2D2D2D',
  btnInvertedText: '#F5F0E8',
  btnOutlined: 'transparent',
  btnOutlinedBorder: '#2D2D2D',
  btnOutlinedText: '#2D2D2D',

  // ── Semantic states ──
  success: '#00895E',   // darkened for contrast on light bg
  warning: '#C98A00',   // darkened amber (original was too light)
  danger: '#C0392B',    // cleaner red
  info: '#2980B9',      // darkened blue

  // ── Misc ──
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(45, 45, 45, 0.6)',
} as const;

// ── Spacing ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ── Border radius ──
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ── Typography ──
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  hero: 34,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ── Shadows ──
export const shadow = {
  sm: {
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ── Convenience theme object ──
export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  shadow,
} as const;

export default theme;