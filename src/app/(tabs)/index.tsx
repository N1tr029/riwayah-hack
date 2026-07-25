import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { Sparkline } from '@/components/ui/sparkline';
import { SpectrumBar } from '@/components/ui/spectrum-bar';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { baselineLine } from '@/lib/engine';
import { friendlyDate, greeting, todayKey } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import type { DayRecord } from '@/lib/types';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function formatSleep(hours: number): string {
  let hh = Math.floor(hours);
  let mm = Math.round((hours - hh) * 60);
  if (mm === 60) {
    hh += 1;
    mm = 0;
  }
  return `${hh} h ${mm} m`;
}

/** One physiology tile — value, its own trend, a plain-language note. */
function MetricTile({
  label,
  color,
  value,
  unit,
  series,
  note,
}: {
  label: string;
  color: string;
  value: string;
  unit?: string;
  series: number[];
  note: string;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.tile}>
      <ThemedText type="smallBold" style={[styles.tileLabel, { color }]}>
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>
        {value}
        {unit ? <ThemedText style={[styles.tileUnit, { color: theme.textSecondary }]}>{unit}</ThemedText> : null}
      </ThemedText>
      <Sparkline values={series} color={color} height={30} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.tileNote}>
        {note}
      </ThemedText>
    </Card>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { ready, records, today } = useBrief();

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const history = records.filter((r) => r.date !== todayKey());
  const baseline = Math.round(avg(records.slice(-30).map((r) => r.recovery))) || (today?.recovery ?? 0);
  const yesterday = history.at(-1);

  const hrvSeries = records.slice(-8).map((r) => r.hrv);
  const rhrSeries = records.slice(-8).map((r) => r.rhr);
  const sleepSeries = records.slice(-8).map((r) => r.sleepHours);
  const hrSeries = records.slice(-8).map((r) => r.hr);
  const baseHrv = avg(records.map((r) => r.hrv));
  const baseRhr = avg(records.map((r) => r.rhr));

  const hrvNote = (r: DayRecord) =>
    r.hrv - baseHrv > 2 ? 'above your usual' : r.hrv - baseHrv < -2 ? 'below your usual' : 'on your usual';
  const rhrNote = (r: DayRecord) =>
    r.rhr - baseRhr < -1 ? 'settling lower' : r.rhr - baseRhr > 1 ? 'running higher' : 'steady';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                {friendlyDate(todayKey())}
              </ThemedText>
              <ThemedText type="subtitle">{greeting()}</ThemedText>
            </View>
            <PressScale
              onPress={() => router.push('/settings')}
              style={styles.gear}
              accessibilityRole="button"
              accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
            </PressScale>
          </View>

          {today ? (
            <>
              <PressScale onPress={() => { tapLight(); router.push('/brief'); }}>
                <Card style={styles.todayCard}>
                  <View style={styles.todayRow}>
                    <View>
                      <ThemedText type="smallBold" style={[styles.tileLabel, { color: theme.textSecondary }]}>
                        Recovery
                      </ThemedText>
                      <ThemedText style={styles.bigScore}>{today.recovery}</ThemedText>
                    </View>
                    <View style={styles.verdict}>
                      <ThemedText style={styles.status}>{today.statusWord}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.verdictText}>
                        {baselineLine(today.recovery, history, today.date)}
                      </ThemedText>
                    </View>
                  </View>

                  <SpectrumBar score={today.recovery} baseline={baseline} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.baselineNote}>
                    │ your 30-day usual sits at {baseline}
                  </ThemedText>

                  <View style={[styles.missionRow, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons name="navigate" size={15} color={theme.accent} />
                    <ThemedText type="small" style={{ flex: 1, fontWeight: '600' }}>
                      {today.mission}
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
                  </View>
                </Card>
              </PressScale>

              <View style={styles.grid}>
                <MetricTile
                  label="HRV"
                  color={theme.accent}
                  value={`${today.hrv}`}
                  unit=" ms"
                  series={hrvSeries}
                  note={hrvNote(today)}
                />
                <MetricTile
                  label="Resting HR"
                  color={theme.good}
                  value={`${today.rhr}`}
                  unit=" bpm"
                  series={rhrSeries}
                  note={rhrNote(today)}
                />
                <MetricTile
                  label="Sleep"
                  color={theme.warn}
                  value={formatSleep(today.sleepHours)}
                  series={sleepSeries}
                  note={today.sleep.toLowerCase()}
                />
                <MetricTile
                  label="Pulse"
                  color={theme.text}
                  value={`${today.hr}`}
                  unit=" bpm"
                  series={hrSeries}
                  note="during this scan"
                />
              </View>

              <PressScale onPress={() => router.push('/scan')} style={styles.rescanLink}>
                <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Scan again
                </ThemedText>
              </PressScale>
            </>
          ) : (
            <Card style={styles.heroCard}>
              <View style={styles.heroInner}>
                <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="sunny" size={30} color={theme.accent} />
                </View>
                <ThemedText type="subtitle" style={styles.centerText}>
                  Ready for today’s briefing?
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  A calm, one-minute check-in with your body.
                </ThemedText>
                <PressScale
                  onPress={() => { tapLight(); router.push('/scan'); }}
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
                  <ThemedText style={styles.primaryLabel}>Start Today’s Brief</ThemedText>
                </PressScale>
                {yesterday && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Yesterday: {yesterday.recovery} · {yesterday.statusWord.replace('.', '')}
                  </ThemedText>
                )}
              </View>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  gear: {
    padding: Spacing.two,
  },
  todayCard: {
    gap: Spacing.three,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  bigScore: {
    fontSize: 54,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -2,
  },
  verdict: {
    flex: 1,
    alignItems: 'flex-end',
    gap: Spacing.half,
    paddingTop: Spacing.half,
  },
  status: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '600',
  },
  verdictText: {
    textAlign: 'right',
  },
  baselineNote: {
    marginTop: -Spacing.two,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: Spacing.three,
    gap: Spacing.one + 1,
    borderRadius: Radius.small,
  },
  tileLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tileValue: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tileUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  tileNote: {
    fontSize: 12,
  },
  rescanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  heroCard: {
    paddingVertical: Spacing.five,
  },
  heroInner: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    alignItems: 'center',
    minWidth: 230,
    marginTop: Spacing.two,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 17,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
});
