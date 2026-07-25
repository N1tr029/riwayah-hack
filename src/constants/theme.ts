/**
 * Brief's design tokens — the "Spectrum" direction (Brief Redesign 2a).
 * Light: warm paper, white cards, calm sage / slate / tan accents — recovery
 * read as a position on a RECOVER · STEADY · READY spectrum, never a progress ring.
 * Dark: a coordinated warm-charcoal counterpart of the same palette.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#26262A',
    background: '#EEEAE3',
    backgroundElement: '#E7E2D9',
    backgroundSelected: '#DED8CC',
    textSecondary: '#6E6E76',
    card: '#FFFFFF',
    hairline: '#E8E6E1',
    accent: '#5E7E9B', // slate — links, HRV, energy
    accentSoft: '#E9EEF3',
    good: '#6F9A80', // sage — "ready", resting HR
    goodSoft: '#E9F0EB',
    warn: '#B08D57', // tan — "recover", sleep
    warnSoft: '#F4EDE1',
    low: '#B0736A', // muted clay — used sparingly, never red
    lowSoft: '#F1E4DF',
    heart: '#5E7E9B',
    energy: '#5E7E9B',
    stress: '#6F9A80',
    sleep: '#B08D57',
    track: '#ECEAE4',
    zoneRecover: '#EFE5D2',
    zoneSteady: '#DCE5EC',
    zoneReady: '#DDE9E1',
    baseline: '#B9B6AE',
  },
  dark: {
    text: '#F3F0E9',
    background: '#1A1917',
    backgroundElement: '#26241F',
    backgroundSelected: '#2F2C25',
    textSecondary: '#A6A199',
    card: '#221F1A',
    hairline: '#322E27',
    accent: '#8AA8C2',
    accentSoft: '#233240',
    good: '#88B79B',
    goodSoft: '#1F2C24',
    warn: '#C9A876',
    warnSoft: '#2E2717',
    low: '#C48C82',
    lowSoft: '#2E211E',
    heart: '#8AA8C2',
    energy: '#8AA8C2',
    stress: '#88B79B',
    sleep: '#C9A876',
    track: '#322E27',
    zoneRecover: '#3A3327',
    zoneSteady: '#28323C',
    zoneReady: '#27342C',
    baseline: '#6A665E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Recovery score → spectrum position color: sage (ready) · slate (steady) · tan (recover). */
export function scoreColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.good;
  if (score >= 55) return theme.accent;
  return theme.warn;
}

export function scoreSoftColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.goodSoft;
  if (score >= 55) return theme.accentSoft;
  return theme.warnSoft;
}

/** Mix a hex color toward white — used for soft fills and gradients. */
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
  card: 24,
  pill: 999,
  small: 14,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
