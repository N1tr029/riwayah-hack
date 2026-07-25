import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { scoreColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  /** 0–100 recovery score — positions the dot. */
  score: number;
  /** Optional personal baseline (0–100) — draws the hairline tick. */
  baseline?: number;
  showLabels?: boolean;
  /** Rendered over a colored gradient (the Brief hero) — zones go translucent white. */
  onTint?: boolean;
}

/**
 * Recovery as a position on your own scale — zones (RECOVER · STEADY · READY),
 * a baseline tick, and a dot. No progress metaphor. (Brief Redesign 2a.)
 */
export function SpectrumBar({ score, baseline, showLabels = true, onTint = false }: Props) {
  const theme = useTheme();
  const dot = scoreColor(score, theme);
  const clamp = (n: number) => Math.max(3, Math.min(97, n));
  const zone = (c: string) => (onTint ? 'rgba(255,255,255,0.85)' : c);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={styles.zones}>
          <View style={[styles.zone, { flex: 55, backgroundColor: zone(theme.zoneRecover) }]} />
          <View style={[styles.zone, { flex: 15, backgroundColor: zone(theme.zoneSteady) }]} />
          <View style={[styles.zone, { flex: 30, backgroundColor: zone(theme.zoneReady) }]} />
        </View>
        {baseline != null && (
          <View
            style={[
              styles.tick,
              { left: `${clamp(baseline)}%`, backgroundColor: onTint ? '#9D9DA6' : theme.baseline },
            ]}
          />
        )}
        <View style={[styles.dot, { left: `${clamp(score)}%`, backgroundColor: dot }]} />
      </View>
      {showLabels && (
        <View style={styles.labels}>
          <ThemedText style={[styles.label, styles.l55, { color: theme.textSecondary }]}>RECOVER</ThemedText>
          <ThemedText style={[styles.label, styles.l15, { color: theme.textSecondary }]}>STEADY</ThemedText>
          <ThemedText style={[styles.label, styles.l30, { color: theme.textSecondary }]}>READY</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  track: {
    height: 10,
    justifyContent: 'center',
  },
  zones: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 3,
  },
  zone: {
    borderRadius: 5,
  },
  tick: {
    position: 'absolute',
    top: -3,
    height: 16,
    width: 1.5,
    borderRadius: 1,
  },
  dot: {
    position: 'absolute',
    top: -3,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  labels: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  l55: { width: '55%' },
  l15: { width: '15%', textAlign: 'center' },
  l30: { width: '30%', textAlign: 'right' },
});
