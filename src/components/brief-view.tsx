import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
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

/** Quiet, staggered entrance — short, ease-out, no bounce. */
const enter = (step: number) => FadeInDown.duration(320).delay(step * 70);

/** Apple-Health-style stat tile: metric identity color, bold value. */
function StatTile({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.tile}>
      <View style={styles.tileHeader}>
        <Ionicons name={icon} size={15} color={color} />
        <ThemedText type="smallBold" style={[styles.tileLabel, { color }]}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
    </Card>
  );
}

/** The heart of the app: one bold, readable briefing. */
export function BriefView({ record, history, onViewDetails }: Props) {
  const theme = useTheme();
  const color = scoreColor(record.recovery, theme);

  return (
    <View style={styles.container}>
      <Animated.View entering={enter(0)} style={styles.hero}>
        <ScoreRing score={record.recovery} />
        <ThemedText style={styles.status}>{record.statusWord}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {baselineLine(record.recovery, history, record.date)}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.tileRow}>
        <StatTile icon="flash" color={theme.energy} label="Energy" value={record.energy} />
        <StatTile icon="water" color={theme.stress} label="Stress" value={record.stress} />
        <StatTile icon="moon" color={theme.sleep} label="Sleep" value={record.sleep} />
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
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  status: {
    marginTop: Spacing.two,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  tile: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.one,
    borderRadius: Radius.card,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tileLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tileValue: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  recommendation: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
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
