import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { MetricRow } from '@/components/ui/metric-row';
import { PressScale } from '@/components/ui/press-scale';
import { Sparkline } from '@/components/ui/sparkline';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CONFIDENCE_LABEL } from '@/lib/engine';
import { useBrief } from '@/lib/store';

/**
 * Advanced metrics — deliberately tucked behind "View details".
 * The only place raw numbers are allowed to live.
 */
export default function DetailsScreen() {
  const theme = useTheme();
  const { records, today } = useBrief();

  const record = today ?? records.at(-1);
  const last14 = records.slice(-14);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const weekAvg = Math.round(avg(records.slice(-7).map((r) => r.recovery)));
  const monthAvg = Math.round(avg(records.slice(-30).map((r) => r.recovery)));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText style={{ fontWeight: '600' }}>Details</ThemedText>
          <PressScale onPress={() => router.back()}>
            <ThemedText style={{ color: theme.accent, fontWeight: '600' }}>Done</ThemedText>
          </PressScale>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {record && (
            <Card style={{ paddingVertical: Spacing.two }}>
              <MetricRow icon="heart-outline" label="Heart rate" value={`${record.hr} bpm`} />
              <MetricRow icon="pulse-outline" label="Resting heart rate" value={`${record.rhr} bpm`} />
              <MetricRow icon="analytics-outline" label="HRV (RMSSD)" value={`${record.hrv} ms`} />
              <MetricRow icon="moon-outline" label="Sleep" value={`${record.sleepHours} h`} />
              <MetricRow
                icon="radio-outline"
                label="Signal quality"
                value={CONFIDENCE_LABEL[record.confidence]}
              />
            </Card>
          )}

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              Heart rate variability · 14 days
            </ThemedText>
            <Sparkline values={last14.map((r) => r.hrv)} color={theme.accent} height={60} />
            <ThemedText type="small" themeColor="textSecondary">
              RMSSD in milliseconds. Higher than your baseline generally means better recovery.
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              Resting heart rate · 14 days
            </ThemedText>
            <Sparkline values={last14.map((r) => r.rhr)} color={theme.sage} height={60} />
            <ThemedText type="small" themeColor="textSecondary">
              Overnight beats per minute. Lower than your baseline is usually a good sign.
            </ThemedText>
          </Card>

          <Card style={{ paddingVertical: Spacing.two }}>
            <MetricRow icon="calendar-outline" label="Weekly average" value={`${weekAvg}`} />
            <MetricRow icon="calendar-clear-outline" label="Monthly average" value={`${monthAvg}`} />
          </Card>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            These numbers power your briefing — you never need them to use Brief.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  content: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  footnote: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
});
