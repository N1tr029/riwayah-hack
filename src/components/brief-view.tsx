import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { MetricRow } from '@/components/ui/metric-row';
import { PressScale } from '@/components/ui/press-scale';
import { ScoreRing } from '@/components/ui/score-ring';
import { Radius, Spacing, scoreColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CONFIDENCE_LABEL, baselineLine } from '@/lib/engine';
import type { DayRecord } from '@/lib/types';

interface Props {
  record: DayRecord;
  history: DayRecord[];
  onViewDetails?: () => void;
}

const ENERGY_ICON = 'flash-outline' as const;
const STRESS_ICON = 'water-outline' as const;
const SLEEP_ICON = 'moon-outline' as const;

/** Quiet, staggered entrance — short, ease-out, no bounce. */
const enter = (step: number) => FadeInDown.duration(320).delay(step * 70);

/** The heart of the app: one calm, readable briefing. */
export function BriefView({ record, history, onViewDetails }: Props) {
  const theme = useTheme();
  const color = scoreColor(record.recovery, theme);

  const stressTint =
    record.stress === 'Low' ? theme.sage : record.stress === 'Balanced' ? theme.accent : theme.clay;
  const energyTint =
    record.energy === 'High' ? theme.sage : record.energy === 'Steady' ? theme.accent : theme.clay;
  const sleepTint =
    record.sleep === 'Recovered' ? theme.sage : record.sleep === 'Adequate' ? theme.accent : theme.clay;

  return (
    <View style={styles.container}>
      <Animated.View entering={enter(0)} style={styles.hero}>
        <ScoreRing score={record.recovery} />
        <ThemedText type="subtitle" style={styles.status}>
          {record.statusWord}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {baselineLine(record.recovery, history, record.date)}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card style={styles.metricsCard}>
          <MetricRow icon={ENERGY_ICON} label="Energy" value={record.energy} tint={energyTint} />
          <MetricRow icon={STRESS_ICON} label="Stress" value={record.stress} tint={stressTint} />
          <MetricRow icon={SLEEP_ICON} label="Sleep" value={record.sleep} tint={sleepTint} />
        </Card>
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
        <Card style={{ backgroundColor: theme.accentSoft, borderColor: 'transparent' }}>
          <View style={styles.missionHeader}>
            <Ionicons name="navigate-outline" size={16} color={theme.accent} />
            <ThemedText type="smallBold" style={[styles.caps, { color: theme.accent }]}>
              Today’s mission
            </ThemedText>
          </View>
          <ThemedText style={styles.recommendation}>{record.mission}</ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(4)} style={styles.footerRow}>
        <View style={styles.confidence}>
          <View style={[styles.confidenceDot, { backgroundColor: record.confidence === 'weak' ? theme.clay : color }]} />
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
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  status: {
    marginTop: Spacing.two,
  },
  metricsCard: {
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  recommendation: {
    fontSize: 19,
    lineHeight: 26,
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
