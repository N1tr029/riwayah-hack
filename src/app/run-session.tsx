import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { Sparkline } from '@/components/ui/sparkline';
import { Waveform } from '@/components/ui/waveform';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isFingerFrame } from '@/lib/finger';
import { dateKey } from '@/lib/format';
import { gentleWarning, heartbeat, success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import {
  checkpointsFor,
  runHeartRate,
  runName,
  summarize,
  type RunType,
  type WorkoutSample,
} from '@/lib/workout';

const CHECK_WINDOW_SEC = 45;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function scheduleCheckReminders(checkpoints: number[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    for (const t of checkpoints) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Heart rate check',
          body: 'Put your fingertip over the camera so this run gets heart rate data.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: t,
          repeats: false,
        },
      });
    }
  } catch {
    // notifications are a bonus, never a blocker
  }
}

function cancelReminders(): void {
  if (Platform.OS === 'web') return;
  Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

type Phase = 'running' | 'check' | 'done';

export default function RunSessionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ type: RunType; minutes: string }>();
  const type: RunType = (['easy', 'tempo', 'long'] as RunType[]).includes(params.type as RunType)
    ? (params.type as RunType)
    : 'easy';
  const plannedMin = Math.max(5, parseInt(params.minutes ?? '30', 10) || 30);
  const { addWorkout, updateDay, byDate } = useBrief();
  const [permission, requestPermission] = useCameraPermissions();

  const isWeb = Platform.OS === 'web';

  // Keep the screen on for the whole run (native only — web denies wake locks).
  useEffect(() => {
    if (isWeb) return;
    activateKeepAwakeAsync('run').catch(() => {});
    return () => {
      Promise.resolve(deactivateKeepAwake('run')).catch(() => {});
    };
  }, [isWeb]);
  const checkpoints = useRef(checkpointsFor(type, plannedMin)).current;
  const startRef = useRef(Date.now());
  const seedRef = useRef((Date.now() % 1e9) | 0);
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('running');
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<WorkoutSample[]>([]);
  const [checkStartedAt, setCheckStartedAt] = useState(0);
  const nextCheckIdx = useRef(0);
  const savedRef = useRef(false);

  const useCam = !isWeb && permission?.granted === true;

  // Ask for camera up front and schedule the buzz reminders.
  useEffect(() => {
    if (!isWeb && !permission?.granted) requestPermission().catch(() => {});
    scheduleCheckReminders(checkpoints);
    return cancelReminders;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureSample = useCallback(
    (captured: boolean) => {
      const at = Math.round((Date.now() - startRef.current) / 1000);
      const hr = runHeartRate(type, at, seedRef.current);
      setSamples((prev) => [...prev, { atSec: at, hr, captured }]);
      if (captured) success();
      setPhase('running');
    },
    [type]
  );

  // Clock. Fires checkpoints and ends the run at the planned duration.
  useEffect(() => {
    if (phase === 'done') return;
    const timer = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(e);
      if (phase === 'running') {
        const next = checkpoints[nextCheckIdx.current];
        if (next !== undefined && e >= next) {
          nextCheckIdx.current += 1;
          setCheckStartedAt(e);
          setPhase('check');
        } else if (e >= plannedMin * 60) {
          setPhase('done');
        }
      } else if (phase === 'check' && e - checkStartedAt >= CHECK_WINDOW_SEC) {
        captureSample(false);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [phase, checkpoints, plannedMin, checkStartedAt, captureSample]);

  // The buzz: insistent haptic pattern while a check is waiting.
  useEffect(() => {
    if (phase !== 'check') return;
    gentleWarning();
    const buzz = setInterval(() => gentleWarning(), 1200);
    return () => clearInterval(buzz);
  }, [phase]);

  // Fingertip detection during a check (simulated on web).
  useEffect(() => {
    if (phase !== 'check') return;
    let stopped = false;

    if (!useCam) {
      const t = setTimeout(() => { if (!stopped) captureSample(true); }, 2500);
      return () => { stopped = true; clearTimeout(t); };
    }

    let consecutive = 0;
    let failures = 0;
    const loop = async () => {
      await new Promise((r) => setTimeout(r, 700));
      while (!stopped) {
        try {
          const pic = await cameraRef.current?.takePictureAsync({
            quality: 0,
            base64: true,
            skipProcessing: true,
            shutterSound: false,
          });
          if (stopped) return;
          if (pic?.base64 && isFingerFrame(pic.base64)) {
            consecutive += 1;
            heartbeat();
            if (consecutive >= 2) {
              captureSample(true);
              return;
            }
          } else {
            consecutive = 0;
          }
        } catch {
          failures += 1;
          if (failures > 4) {
            captureSample(true);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 350));
      }
    };
    loop();
    return () => {
      stopped = true;
    };
  }, [phase, useCam, captureSample]);

  const finishRun = useCallback(() => {
    cancelReminders();
    setPhase('done');
  }, []);

  const saveRun = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const durationSec = Math.round(elapsed);
    const { avgHr, maxHr } = summarize(samples);
    const today = dateKey(new Date());
    addWorkout({
      id: `${Date.now()}`,
      date: today,
      type,
      plannedMin,
      startedAt: new Date(startRef.current).toISOString(),
      durationSec,
      samples,
      avgHr,
      maxHr,
    });
    if (byDate(today)) updateDay(today, { workout: 'run' });
    tapLight();
    router.dismissTo('/(tabs)/run');
  }, [elapsed, samples, type, plannedMin, addWorkout, byDate, updateDay]);

  const captured = samples.filter((s) => s.captured).length;
  const nextCheck = checkpoints[nextCheckIdx.current];
  const { avgHr, maxHr } = summarize(samples);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <View>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              {runName(type)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {plannedMin} min planned · {captured}/{checkpoints.length} checks
            </ThemedText>
          </View>
          {phase !== 'done' && (
            <PressScale onPress={finishRun} accessibilityRole="button">
              <ThemedText style={{ color: theme.low, fontWeight: '700' }}>End Run</ThemedText>
            </PressScale>
          )}
        </View>

        {phase !== 'done' ? (
          <View style={styles.body}>
            <ThemedText style={styles.clock}>{formatClock(elapsed)}</ThemedText>

            {phase === 'check' ? (
              <>
                {useCam && (
                  <View style={[styles.cameraDot, { borderColor: theme.heart }]}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing="back"
                      enableTorch
                      animateShutter={false}
                      mute
                      pictureSize="640x480"
                    />
                  </View>
                )}
                <View style={{ alignSelf: 'stretch' }}>
                  <Waveform color={theme.heart} height={70} />
                </View>
                <ThemedText type="subtitle" style={styles.centerText}>
                  Finger on the camera.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Quick heart rate check — keep moving, it only takes a few seconds.
                </ThemedText>
              </>
            ) : (
              <>
                <View style={[styles.hrPill, { backgroundColor: theme.card }]}>
                  <Ionicons name="heart" size={16} color={theme.heart} />
                  <ThemedText style={styles.hrValue}>
                    {samples.length > 0 ? `${samples[samples.length - 1].hr}` : '—'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    bpm last check
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {nextCheck !== undefined
                    ? `Next heart rate check in ${formatClock(Math.max(0, nextCheck - elapsed))}`
                    : 'No more checks — finish strong.'}
                </ThemedText>
              </>
            )}
          </View>
        ) : (
          <View style={styles.body}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Nice run.
            </ThemedText>
            <Card style={styles.summaryCard}>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{formatClock(elapsed)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Time</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{avgHr || '—'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Avg bpm</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{maxHr || '—'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Max bpm</ThemedText>
                </View>
              </View>
              {samples.length >= 2 && (
                <Sparkline values={samples.map((s) => s.hr)} color={theme.heart} height={54} />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {captured} of {checkpoints.length} heart rate checks captured. Save it, then upload
                to Strava from the Run tab.
              </ThemedText>
            </Card>
            <PressScale onPress={saveRun} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Save Run</ThemedText>
            </PressScale>
            <PressScale onPress={() => { cancelReminders(); router.dismissTo('/(tabs)/run'); }}>
              <ThemedText type="small" themeColor="textSecondary">
                Discard
              </ThemedText>
            </PressScale>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  clock: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -2,
  },
  cameraDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
  },
  camera: {
    flex: 1,
  },
  hrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  hrValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
  },
  summaryCard: {
    alignSelf: 'stretch',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    alignItems: 'center',
    minWidth: 230,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
});
