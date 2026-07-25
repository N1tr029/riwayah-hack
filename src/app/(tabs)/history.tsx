import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PressScale } from '@/components/ui/press-scale';
import {
  BottomTabInset,
  MaxContentWidth,
  Radius,
  Spacing,
  scoreColor,
  scoreSoftColor,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate, isToday, parseKey } from '@/lib/format';
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
  const d = parseKey(record.date);
  const chipBg = scoreSoftColor(record.recovery, theme);
  const chipColor = scoreColor(record.recovery, theme);

  return (
    <PressScale
      onPress={() => router.push({ pathname: '/day/[date]', params: { date: record.date } })}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <View style={[styles.scoreChip, { backgroundColor: chipBg }]}>
        <ThemedText style={[styles.scoreText, { color: chipColor }]}>{record.recovery}</ThemedText>
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  scoreChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '700',
    fontSize: 16,
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
