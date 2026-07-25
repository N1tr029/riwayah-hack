/**
 * Brief's design tokens. Calm, muted, Apple-Weather-adjacent.
 * Soft whites and warm grays, deep charcoal ink, muted blue accent,
 * subtle sage for good recovery, muted clay (never red) for low days.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#26262A',
    background: '#F6F5F2',
    backgroundElement: '#EFEEE9',
    backgroundSelected: '#E6E5DF',
    textSecondary: '#6E6E76',
    card: '#FFFFFF',
    hairline: '#E8E6E1',
    accent: '#5E7E9B',
    accentSoft: '#E9EEF3',
    sage: '#6F9A80',
    sageSoft: '#E9F0EB',
    clay: '#B08D57',
    claySoft: '#F4EDE1',
    track: '#ECEAE4',
  },
  dark: {
    text: '#F2F2F4',
    background: '#0F0F12',
    backgroundElement: '#1E1E23',
    backgroundSelected: '#2A2A30',
    textSecondary: '#9D9DA6',
    card: '#1A1A1F',
    hairline: '#26262C',
    accent: '#8BA7C0',
    accentSoft: '#1F2A34',
    sage: '#8FB49B',
    sageSoft: '#1E2A22',
    clay: '#C9A874',
    claySoft: '#2E2921',
    track: '#26262B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Recovery score → accent color. High = sage, mid = blue, low = clay. Never red. */
export function scoreColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.sage;
  if (score >= 55) return theme.accent;
  return theme.clay;
}

export function scoreSoftColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.sageSoft;
  if (score >= 55) return theme.accentSoft;
  return theme.claySoft;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 24,
  pill: 999,
  small: 14,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
