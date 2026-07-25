import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { ScoreRing } from '@/components/ui/score-ring';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import type { Mood, Workout } from '@/lib/types';

const MOODS: { value: Mood; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'great', label: 'Great', icon: 'sunny-outline' },
  { value: 'good', label: 'Good', icon: 'partly-sunny-outline' },
  { value: 'okay', label: 'Okay', icon: 'cloud-outline' },
  { value: 'low', label: 'Low', icon: 'rainy-outline' },
];

const WORKOUTS: { value: Workout; label: string }[] = [
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'weights', label: 'Weights' },
  { value: 'run', label: 'Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'rest', label: 'Rest' },
];

export default function DayScreen() {
  const theme = useTheme();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { byDate, updateDay } = useBrief();
  const record = byDate(date ?? '');
  const [journal, setJournal] = useState(record?.journal ?? '');

  if (!record) return <Redirect href="/(tabs)/history" />;

  const chip = (selected: boolean) => ({
    backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
    borderColor: selected ? theme.accent : 'transparent',
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <ThemedText style={{ fontWeight: '600' }}>{friendlyDate(record.date)}</ThemedText>
            <PressScale onPress={() => router.back()}>
              <ThemedText style={{ color: theme.accent, fontWeight: '600' }}>Done</ThemedText>
            </PressScale>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Card style={styles.summaryCard}>
              <ScoreRing score={record.recovery} size={104} strokeWidth={9} delay={100} />
              <View style={styles.summaryText}>
                <ThemedText type="subtitle">{record.statusWord}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {record.recommendation}
                </ThemedText>
              </View>
            </Card>

            <Card>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                That morning
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {record.explanation}
              </ThemedText>
              <View style={[styles.missionRow, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="navigate-outline" size={14} color={theme.accent} />
                <ThemedText type="small" style={{ flex: 1, fontWeight: '600' }}>
                  {record.mission}
                </ThemedText>
              </View>
            </Card>

            <Card>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                Mood
              </ThemedText>
              <View style={styles.chipRow}>
                {MOODS.map((m) => (
                  <PressScale
                    key={m.value}
                    onPress={() => { tapLight(); updateDay(record.date, { mood: m.value }); }}
                    style={[styles.chip, chip(record.mood === m.value)]}>
                    <Ionicons
                      name={m.icon}
                      size={15}
                      color={record.mood === m.value ? theme.accent : theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ fontWeight: '600' }}>
                      {m.label}
                    </ThemedText>
                  </PressScale>
                ))}
              </View>

              <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.caps, { marginTop: Spacing.three }]}>
                Workout
              </ThemedText>
              <View style={styles.chipRow}>
                {WORKOUTS.map((w) => (
                  <PressScale
                    key={w.value}
                    onPress={() => { tapLight(); updateDay(record.date, { workout: w.value }); }}
                    style={[styles.chip, chip(record.workout === w.value)]}>
                    <ThemedText type="small" style={{ fontWeight: '600' }}>
                      {w.label}
                    </ThemedText>
                  </PressScale>
                ))}
              </View>

              <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.caps, { marginTop: Spacing.three }]}>
                Journal
              </ThemedText>
              <TextInput
                multiline
                placeholder="How did the day feel?"
                placeholderTextColor={theme.textSecondary}
                value={journal}
                onChangeText={setJournal}
                onEndEditing={() => updateDay(record.date, { journal: journal.trim() || undefined })}
                onBlur={() => updateDay(record.date, { journal: journal.trim() || undefined })}
                style={[
                  styles.journal,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  summaryText: {
    flex: 1,
    gap: Spacing.one,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  journal: {
    minHeight: 84,
    borderRadius: Radius.small,
    padding: Spacing.three,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
