/**
 * Brief's design tokens — Apple Health in light mode, WHOOP in dark.
 * Light: white cards on system gray, vivid metric colors, bold numerals.
 * Dark: near-black, elevated charcoal cards, punchy traffic-light accents.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#F2F2F7',
    backgroundElement: '#EFEFF4',
    backgroundSelected: '#E5E5EA',
    textSecondary: '#6C6C70',
    card: '#FFFFFF',
    hairline: '#E5E5EA',
    accent: '#007AFF',
    accentSoft: '#E9F2FF',
    good: '#34C759',
    goodSoft: '#E6F8EC',
    warn: '#FF9500',
    warnSoft: '#FFF2E0',
    low: '#FF3B30',
    lowSoft: '#FFEAE8',
    heart: '#FF2D55',
    energy: '#FF9500',
    stress: '#32ADE6',
    sleep: '#5E5CE6',
    track: '#E5E5EA',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0B0D10',
    backgroundElement: '#22262B',
    backgroundSelected: '#2C3138',
    textSecondary: '#9BA1A8',
    card: '#16191E',
    hairline: '#24282E',
    accent: '#0A84FF',
    accentSoft: '#132A42',
    good: '#30D158',
    goodSoft: '#12291A',
    warn: '#FFD60A',
    warnSoft: '#2E2912',
    low: '#FF453A',
    lowSoft: '#331512',
    heart: '#FF375F',
    energy: '#FF9F0A',
    stress: '#64D2FF',
    sleep: '#7D7AFF',
    track: '#23272D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Recovery score → WHOOP-style traffic light. */
export function scoreColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.good;
  if (score >= 50) return theme.warn;
  return theme.low;
}

export function scoreSoftColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.goodSoft;
  if (score >= 50) return theme.warnSoft;
  return theme.lowSoft;
}

/** Mix a hex color toward white — used for ring gradients. */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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
  card: 20,
  pill: 999,
  small: 12,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
