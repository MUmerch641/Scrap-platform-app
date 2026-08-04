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

export const typography = {
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

export const semanticColors = {
  light: {
    background: '#ffffff',
    surface: '#f4f4f5',
    surfaceSelected: '#e4e4e7',
    text: '#18181b',
    textMuted: '#52525b',
    border: '#d4d4d8',
    primary: '#2563eb',
    onPrimary: '#ffffff',
    success: '#15803d',
    warning: '#a16207',
    danger: '#b91c1c',
  },
  dark: {
    background: '#09090b',
    surface: '#27272a',
    surfaceSelected: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    border: '#52525b',
    primary: '#60a5fa',
    onPrimary: '#172554',
    success: '#4ade80',
    warning: '#facc15',
    danger: '#f87171',
  },
} as const;

export type ColorScheme = keyof typeof semanticColors;
export type SemanticColor = keyof typeof semanticColors.light;
