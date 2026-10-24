export const colors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryDark: '#3730A3',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  priority: {
    high: '#EF4444',
    highBg: '#FEE2E2',
    medium: '#F59E0B',
    mediumBg: '#FEF3C7',
    low: '#10B981',
    lowBg: '#D1FAE5',
  },
  categories: {
    work: { bg: '#E0F2FE', text: '#0369A1' },
    personal: { bg: '#F3E8FF', text: '#6B21A8' },
    shopping: { bg: '#FEF3C7', text: '#B45309' },
    health: { bg: '#D1FAE5', text: '#047857' },
    general: { bg: '#F1F5F9', text: '#475569' },
  } as Record<string, { bg: string; text: string }>,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  secondary: { fontSize: 13, color: colors.textSecondary },
};

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
};
