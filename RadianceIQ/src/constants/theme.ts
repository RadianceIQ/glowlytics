import { Platform } from 'react-native';

export const Colors = {
  primary: '#7DE7E1',
  primaryLight: '#C7FFFA',
  primaryDark: '#39B5BF',
  secondary: '#8A95FF',
  secondaryLight: '#BBC3FF',
  accent: '#59D6BB',
  accentLight: '#92E9D6',

  background: '#060B12',
  backgroundDeep: '#08111C',
  backgroundRaised: '#0D1827',
  surface: '#101927',
  surfaceLight: '#152234',
  surfaceHighlight: '#1D2C42',
  glass: 'rgba(17, 28, 43, 0.78)',
  glassStrong: 'rgba(10, 18, 30, 0.92)',
  surfaceOverlay: 'rgba(125, 231, 225, 0.08)',

  text: '#F5F7FB',
  textSecondary: '#BCC7D9',
  textMuted: '#7A8AA3',
  textDim: '#56657C',

  success: '#5FD3AC',
  warning: '#F2B56A',
  error: '#FF7A78',
  info: '#86C7FF',

  acne: '#F48A87',
  sunDamage: '#EDC27B',
  skinAge: '#8DB5FF',

  border: 'rgba(155, 183, 216, 0.15)',
  borderStrong: 'rgba(190, 215, 255, 0.28)',
  divider: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(4, 8, 16, 0.68)',
  glowPrimary: 'rgba(125, 231, 225, 0.22)',
  glowSecondary: 'rgba(138, 149, 255, 0.20)',
  glowAmber: 'rgba(242, 181, 106, 0.18)',
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 40,
  display: 52,
};

export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 999,
};

export const FontFamily = {
  sans: 'Outfit_400Regular',
  sansMedium: 'Outfit_500Medium',
  sansSemiBold: 'Outfit_600SemiBold',
  sansBold: 'Outfit_700Bold',
  serif: 'CormorantGaramond_600SemiBold',
  serifBold: 'CormorantGaramond_700Bold',
};

export const Shadows = {
  glow: Platform.select({
    ios: {
      shadowColor: Colors.primary,
      shadowOpacity: 0.22,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 16 },
    },
    android: {
      elevation: 10,
    },
    default: {
      shadowColor: Colors.primary,
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
    },
  }),
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.28,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
    },
    android: {
      elevation: 7,
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 18 },
    },
  }),
};

export const Motion = {
  fast: 140,
  base: 220,
  slow: 320,
};
