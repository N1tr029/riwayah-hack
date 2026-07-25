import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PressScale } from '@/components/ui/press-scale';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, scoreColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate, isToday } from '@/lib/format';
import { useBrief } from '@/lib/store';
import type { DayRecord } from '@/lib/types';

const WORKOUT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  volleyball: 'tennisball-outline',
  weights: 'barbell-outline',
  run: 'walk-outline',
  walk: 'footsteps-outline',
};

function DayRow({ record }: { record: DayRecord }) {
  const theme = useTheme();
  const chipColor = scoreColor(record.recovery, theme);
  const pos = Math.max(6, Math.min(94, record.recovery));

  return (
    <PressScale
      onPress={() => router.push({ pathname: '/day/[date]', params: { date: record.date } })}
      style={[styles.row, { backgroundColor: theme.card }]}>
      <View style={styles.scoreCol}>
        <ThemedText style={[styles.scoreText, { color: chipColor }]}>{record.recovery}</ThemedText>
        <View style={[styles.miniTrack, { backgroundColor: theme.track }]}>
          <View style={[styles.miniDot, { left: `${pos}%`, backgroundColor: chipColor }]} />
        </View>
      </View>
      <View style={styles.rowText}>
        <ThemedText style={{ fontWeight: '600' }}>
          {isToday(record.date) ? 'Today' : friendlyDate(record.date)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {record.statusWord} {record.journal ?? record.mission}
        </ThemedText>
      </View>
      <View style={styles.rowIcons}>
        {record.workout && record.workout !== 'rest' && (
          <Ionicons name={WORKOUT_ICON[record.workout] ?? 'walk-outline'} size={15} color={theme.textSecondary} />
        )}
        {record.journal && <Ionicons name="create-outline" size={15} color={theme.textSecondary} />}
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </View>
    </PressScale>
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { ready, records } = useBrief();

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const newestFirst = [...records].reverse();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={newestFirst}
          keyExtractor={(r) => r.date}
          renderItem={({ item }) => <DayRow record={item} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="subtitle">History</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tap any day to revisit its briefing.
              </ThemedText>
            </View>
          }
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}
        />
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
    gap: Spacing.two + 2,
  },
  header: {
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  scoreCol: {
    width: 46,
    alignItems: 'center',
    gap: 5,
  },
  scoreText: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 18,
  },
  miniTrack: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  miniDot: {
    position: 'absolute',
    top: -2.5,
    marginLeft: -4.5,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
