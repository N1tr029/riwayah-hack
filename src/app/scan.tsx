import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PressScale } from '@/components/ui/press-scale';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { composeRecord, type DayMetrics } from '@/lib/engine';
import {
  healthPlatformName,
  healthSupported,
  readHealthSnapshot,
  requestHealthPermissions,
} from '@/lib/health';
import { todayKey } from '@/lib/format';
import { gentleWarning, success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';

type Phase = 'intro' | 'syncing' | 'missing';

export default function ScanScreen() {
  const theme = useTheme();
  const { records, saveRecord, setSettings } = useBrief();
  const [phase, setPhase] = useState<Phase>('intro');
  const [missing, setMissing] = useState<string[]>([]);

  const syncHealth = useCallback(async () => {
    tapLight();
    setPhase('syncing');

    if (!healthSupported()) {
      setMissing([`${healthPlatformName()} is unavailable in this build`]);
      setPhase('missing');
      gentleWarning();
      return;
    }

    const authorized = await requestHealthPermissions();
    if (!authorized) {
      setMissing([`${healthPlatformName()} permission`]);
      setPhase('missing');
      gentleWarning();
      return;
    }

    const snapshot = await readHealthSnapshot();
    if (
      snapshot.sleepHours == null ||
      snapshot.bedtimeHour == null ||
      snapshot.restingHeartRate == null ||
      snapshot.hrv == null
    ) {
      setMissing(snapshot.missing.length ? snapshot.missing : ['health data']);
      setPhase('missing');
      gentleWarning();
      return;
    }

    const tk = todayKey();
    const history = records.filter((record) => record.date !== tk);
    const metrics: DayMetrics = {
      hr: snapshot.heartRate,
      rhr: snapshot.restingHeartRate,
      hrv: snapshot.hrv,
      sleepHours: snapshot.sleepHours,
      bedtimeHour: snapshot.bedtimeHour,
    };
    const record = composeRecord(
      tk,
      metrics,
      history,
      snapshot.heartRate == null ? 'good' : 'excellent'
    );
    saveRecord(record);
    setSettings({ healthSync: true });
    success();
    // Morning flow: health sync → visual check-in (skippable) → brief.
    router.replace('/face-scan?next=brief');
  }, [records, saveRecord, setSettings]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {phase !== 'syncing' && (
          <PressScale
            onPress={() => router.back()}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </PressScale>
        )}

        {phase === 'intro' && (
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="heart-circle-outline" size={42} color={theme.accent} />
            </View>
            <ThemedText type="subtitle" style={styles.centerText}>
              Sync your real health data
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Brief reads last night’s sleep, resting heart rate, and HRV from{' '}
              {healthPlatformName()}. It does not estimate a pulse with the camera.
            </ThemedText>
            <View style={styles.steps}>
              <Step icon="moon-outline" text="Sleep comes from the Health app’s recorded sleep sessions." />
              <Step icon="pulse-outline" text="Heart metrics come from samples already saved in Health." />
              <Step icon="lock-closed-outline" text="Your data stays on this device." />
            </View>
            <PressScale
              onPress={syncHealth}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Sync Apple Health</ThemedText>
            </PressScale>
          </View>
        )}

        {phase === 'syncing' && (
          <View style={styles.body}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText type="subtitle" style={styles.centerText}>
              Reading Apple Health…
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Only saved Health data is used.
            </ThemedText>
          </View>
        )}

        {phase === 'missing' && (
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: theme.warnSoft }]}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.warn} />
            </View>
            <ThemedText type="subtitle" style={styles.centerText}>
              Not enough Health data yet
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Missing: {missing.join(', ')}. Brief will not invent values. Check Health access and
              make sure those measurements exist, then try again.
            </ThemedText>
            <PressScale
              onPress={syncHealth}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Try again</ThemedText>
            </PressScale>
            <PressScale onPress={() => router.back()} style={styles.secondaryButton}>
              <ThemedText themeColor="textSecondary">Not now</ThemedText>
            </PressScale>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function Step({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stepRow}>
      <Ionicons name={icon} size={20} color={theme.accent} />
      <ThemedText themeColor="textSecondary" style={styles.stepText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
  },
  close: {
    alignSelf: 'flex-start',
    padding: Spacing.two,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
    maxWidth: 360,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    marginVertical: Spacing.two,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  stepText: { flex: 1 },
  primaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    alignItems: 'center',
    minWidth: 240,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 17,
  },
  secondaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
