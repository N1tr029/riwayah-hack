import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import { WeekBars } from '@/components/ui/week-bars';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShort } from '@/lib/format';
import { findPatterns, streakLength } from '@/lib/patterns';
import { useBrief } from '@/lib/store';

export default function InsightsScreen() {
  const theme = useTheme();
  const { ready, records } = useBrief();

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const last7 = records.slice(-7);
  const prior7 = records.slice(-14, -7);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const weekAvg = Math.round(avg(last7.map((r) => r.recovery)));
  const priorAvg = Math.round(avg(prior7.map((r) => r.recovery)));
  const delta = weekAvg - priorAvg;
  const deltaLine =
    prior7.length === 0
      ? `Averaging ${weekAvg} this week.`
      : delta >= 2
        ? `Averaging ${weekAvg} this week — up ${delta} from last week.`
        : delta <= -2
          ? `Averaging ${weekAvg} this week, a touch below last week.`
          : `Averaging ${weekAvg} this week — right on your usual.`;

  const monthValues = records.slice(-30).map((r) => r.recovery);
  const bestIdx = last7.reduce((best, r, i) => (r.recovery > last7[best].recovery ? i : best), 0);
  const patterns = findPatterns(records);
  const streak = streakLength(records);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Insights</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Patterns from your own baseline — never anyone else’s.
            </ThemedText>
          </View>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              This week
            </ThemedText>
            <WeekBars
              bars={last7.map((r, i) => ({
                label: weekdayShort(r.date),
                value: r.recovery,
                emphasized: i === bestIdx,
              }))}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {deltaLine}
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              This month
            </ThemedText>
            <Sparkline values={monthValues} color={theme.good} fill={theme.goodSoft} height={64} />
            <ThemedText type="small" themeColor="textSecondary">
              {monthValues.length} briefings — readiness averaging {Math.round(avg(monthValues))}.
            </ThemedText>
          </Card>

          <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.caps, styles.sectionTitle]}>
            What we’ve noticed
          </ThemedText>

          {patterns.length === 0 ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Keep scanning each morning — patterns start to appear after a couple of weeks.
              </ThemedText>
            </Card>
          ) : (
            patterns.map((p) => (
              <Card key={p.id} style={styles.patternCard}>
                <View style={[styles.patternIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons
                    name={p.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={theme.accent}
                  />
                </View>
                <View style={styles.patternText}>
                  <ThemedText style={{ fontWeight: '600' }}>{p.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {p.detail}
                  </ThemedText>
                </View>
              </Card>
            ))
          )}

          {streak >= 3 && (
            <Card style={[styles.patternCard, { backgroundColor: theme.goodSoft }]}>
              <View style={[styles.patternIcon, { backgroundColor: theme.card }]}>
                <Ionicons name="checkmark-done-outline" size={18} color={theme.good} />
              </View>
              <View style={styles.patternText}>
                <ThemedText style={{ fontWeight: '600' }}>
                  {streak} morning check-ins in a row
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Showing up is the whole habit. Nicely done.
                </ThemedText>
              </View>
            </Card>
          )}
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
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: Spacing.two,
    marginLeft: Spacing.two,
  },
  patternCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  patternIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternText: {
    flex: 1,
    gap: 2,
  },
});
