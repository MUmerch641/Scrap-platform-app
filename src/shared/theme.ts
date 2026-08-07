import { Platform } from 'react-native';

export const brandColors = {
  navy: '#004162',
  lightCopper: '#E6A46B',
  copper: '#B87333',
  darkGrey: '#333333',
  offWhite: '#FBFCF8',
  white: '#FFFFFF',
} as const;

export const brandOverlays = {
  modalBackdrop: 'rgba(51, 51, 51, 0.5)',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const fontFamilies = {
  heading: 'LeagueSpartan_700Bold',
  headingSemibold: 'LeagueSpartan_600SemiBold',
  body: 'Quicksand_400Regular',
  bodyMedium: 'Quicksand_500Medium',
  bodySemibold: 'Quicksand_600SemiBold',
  bodyBold: 'Quicksand_700Bold',

  system: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
  }),

  systemHeading: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'system-ui',
  }),
} as const;

export const typography = {
  fontFamily: fontFamilies,

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
  },

  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    '2xl': 40,
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const statusColors = {
  light: {
    success: {
      surface: '#F0FDF4',
      text: '#15803D',
      border: '#BBF7D0',
    },

    warning: {
      surface: '#FEFCE8',
      text: '#A16207',
      border: '#FEF08A',
    },

    danger: {
      surface: '#FEF2F2',
      text: '#B91C1C',
      border: '#FECACA',
    },
  },

  dark: {
    success: {
      surface: '#052E16',
      text: '#4ADE80',
      border: '#14532D',
    },

    warning: {
      surface: '#422006',
      text: '#FACC15',
      border: '#713F12',
    },

    danger: {
      surface: '#450A0A',
      text: '#F87171',
      border: '#7F1D1D',
    },
  },
} as const;

export const semanticColors = {
  light: {
    background: brandColors.offWhite,

    surface: brandColors.white,
    surfaceSelected: brandColors.lightCopper,

    text: brandColors.darkGrey,
    textMuted: brandColors.darkGrey,

    border: 'rgba(0, 65, 98, 0.12)',

    primary: brandColors.navy,
    accent: brandColors.copper,
    onPrimary: brandColors.white,

    inputSurface: brandColors.white,
    inputBorder: brandColors.lightCopper,
    inputBorderFocused: brandColors.navy,
    inputText: brandColors.darkGrey,
    inputPlaceholder: brandColors.darkGrey,

    success: statusColors.light.success.text,
    warning: statusColors.light.warning.text,
    danger: statusColors.light.danger.text,

    tabBarBackground: brandColors.offWhite,
    tabBarIndicator: 'rgba(230, 164, 107, 0.22)',
    tabBarSelected: brandColors.copper,
    tabBarDefault: brandColors.darkGrey,
    tabBarRipple: 'rgba(184, 115, 51, 0.15)',

    modalSurface: brandColors.white,
  },

  dark: {
    background: brandColors.navy,

    surface: 'rgba(251, 252, 248, 0.08)',
    surfaceSelected: brandColors.copper,

    text: brandColors.offWhite,
    textMuted: 'rgba(251, 252, 248, 0.82)',

    border: 'rgba(251, 252, 248, 0.22)',

    primary: brandColors.lightCopper,
    accent: brandColors.copper,
    onPrimary: brandColors.navy,

    inputSurface: 'rgba(251, 252, 248, 0.10)',
    inputBorder: 'rgba(251, 252, 248, 0.28)',
    inputBorderFocused: brandColors.lightCopper,
    inputText: brandColors.offWhite,
    inputPlaceholder: 'rgba(251, 252, 248, 0.70)',

    success: statusColors.dark.success.text,
    warning: statusColors.dark.warning.text,
    danger: statusColors.dark.danger.text,

    tabBarBackground: '#002D45',
    tabBarIndicator: 'rgba(230, 164, 107, 0.25)',
    tabBarSelected: brandColors.lightCopper,
    tabBarDefault: 'rgba(251, 252, 248, 0.76)',
    tabBarRipple: 'rgba(230, 164, 107, 0.15)',

    modalSurface: '#00324E',
  },
} as const;

export type ColorScheme = keyof typeof semanticColors;

export type SemanticColor =
  keyof typeof semanticColors.light;