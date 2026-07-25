import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { SpectrumBar } from '@/components/ui/spectrum-bar';
import { Radius, Spacing, scoreColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CONFIDENCE_LABEL, baselineLine } from '@/lib/engine';
import type { DayRecord } from '@/lib/types';

interface Props {
  record: DayRecord;
  history: DayRecord[];
  onViewDetails?: () => void;
}

/** Quiet, staggered entrance — short, ease-out, no bounce. */
const enter = (step: number) => FadeInDown.duration(320).delay(step * 70);

const ENERGY_FILL: Record<string, number> = { High: 3, Steady: 2, Low: 1 };
const STRESS_FILL: Record<string, number> = { Low: 1, Balanced: 2, Elevated: 3 };
const SLEEP_FILL: Record<string, number> = { Recovered: 3, Adequate: 2, Light: 1 };

/** A calm strength tile — value plus a 3-segment fill, never a number out of context. */
function StatTile({ label, value, color, fill }: { label: string; value: string; color: string; fill: number }) {
  const theme = useTheme();
  return (
    <Card style={styles.tile}>
      <ThemedText type="smallBold" style={[styles.tileLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.tileValue, { color }]}>{value}</ThemedText>
      <View style={styles.segments}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < fill ? color : theme.track }]} />
        ))}
      </View>
    </Card>
  );
}

/** The heart of the app: one calm, readable briefing. */
export function BriefView({ record, history, onViewDetails }: Props) {
  const theme = useTheme();
  const color = scoreColor(record.recovery, theme);
  const window = history.slice(-30);
  const baseline = window.length
    ? Math.round(window.reduce((s, r) => s + r.recovery, 0) / window.length)
    : record.recovery;

  return (
    <View style={styles.container}>
      <Animated.View entering={enter(0)}>
        <LinearGradient
          colors={[theme.goodSoft, theme.accentSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <ThemedText type="smallBold" style={[styles.eyebrow, { color: theme.textSecondary }]}>
            Recovery
          </ThemedText>
          <ThemedText style={styles.bigNumber}>{record.recovery}</ThemedText>
          <ThemedText style={styles.status}>{record.statusWord}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {baselineLine(record.recovery, history, record.date)}
          </ThemedText>
          <View style={styles.heroSpectrum}>
            <SpectrumBar score={record.recovery} baseline={baseline} onTint />
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.tileRow}>
        <StatTile label="Energy" value={record.energy} color={theme.energy} fill={ENERGY_FILL[record.energy] ?? 2} />
        <StatTile label="Stress" value={record.stress} color={theme.stress} fill={STRESS_FILL[record.stress] ?? 2} />
        <StatTile label="Sleep" value={record.sleep} color={theme.sleep} fill={SLEEP_FILL[record.sleep] ?? 2} />
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <Card>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
            Today’s recommendation
          </ThemedText>
          <ThemedText style={styles.recommendation}>{record.recommendation}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {record.explanation}
          </ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Card style={{ backgroundColor: theme.accentSoft }}>
          <View style={styles.missionHeader}>
            <Ionicons name="navigate" size={15} color={theme.accent} />
            <ThemedText type="smallBold" style={[styles.caps, { color: theme.accent }]}>
              Today’s mission
            </ThemedText>
          </View>
          <ThemedText style={styles.recommendation}>{record.mission}</ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(4)} style={styles.footerRow}>
        <View style={styles.confidence}>
          <View
            style={[
              styles.confidenceDot,
              { backgroundColor: record.confidence === 'weak' ? theme.warn : color },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {CONFIDENCE_LABEL[record.confidence]}
          </ThemedText>
        </View>
        {onViewDetails && (
          <PressScale onPress={onViewDetails} style={styles.detailsLink}>
            <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
              View details
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={theme.accent} />
          </PressScale>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.card,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bigNumber: {
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '700',
    letterSpacing: -3,
  },
  status: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
  },
  centerText: {
    textAlign: 'center',
  },
  heroSpectrum: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  tile: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.one + 2,
    alignItems: 'center',
    borderRadius: Radius.small,
  },
  tileLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tileValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  segments: {
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  recommendation: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
