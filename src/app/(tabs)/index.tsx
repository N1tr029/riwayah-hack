import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { ScoreRing } from '@/components/ui/score-ring';
import { Sparkline } from '@/components/ui/sparkline';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate, greeting, todayKey } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';

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

  const last7 = records.slice(-7);
  const avg7 = last7.length
    ? Math.round(last7.reduce((s, r) => s + r.recovery, 0) / last7.length)
    : 0;
  const yesterday = records.filter((r) => r.date !== todayKey()).at(-1);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <ThemedText type="subtitle">{greeting()}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {friendlyDate(todayKey())}
              </ThemedText>
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
            <PressScale onPress={() => { tapLight(); router.push('/brief'); }}>
              <Card style={styles.todayCard}>
                <View style={styles.todayRow}>
                  <ScoreRing score={today.recovery} size={110} strokeWidth={9} delay={100} />
                  <View style={styles.todayText}>
                    <ThemedText type="subtitle">{today.statusWord}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {today.recommendation}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.missionRow, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="navigate-outline" size={15} color={theme.accent} />
                  <ThemedText type="small" style={{ flex: 1, fontWeight: '600' }}>
                    {today.mission}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
                </View>
              </Card>
            </PressScale>
          ) : (
            <Card style={styles.heroCard}>
              <LinearGradient
                colors={[theme.accentSoft, theme.sageSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroInner}>
                <View style={[styles.heroIcon, { backgroundColor: theme.card }]}>
                  <Ionicons name="sunny-outline" size={30} color={theme.accent} />
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

          <Card>
            <View style={styles.trendHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                Last 7 days
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                averaging {avg7}
              </ThemedText>
            </View>
            <Sparkline values={last7.map((r) => r.recovery)} color={theme.accent} fill={theme.accentSoft} />
          </Card>

          {today && (
            <PressScale onPress={() => router.push('/scan')} style={styles.rescanLink}>
              <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Scan again
              </ThemedText>
            </PressScale>
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
    alignItems: 'center',
    gap: Spacing.four,
  },
  todayText: {
    flex: 1,
    gap: Spacing.one,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  heroCard: {
    overflow: 'hidden',
    borderColor: 'transparent',
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
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  rescanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
