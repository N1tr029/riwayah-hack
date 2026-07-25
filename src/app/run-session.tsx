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
import {
  drainPoints,
  formatMiles,
  formatPace,
  haversineMeters,
  simulatedSpeed,
  startRunTracking,
  type GeoPoint,
  type TrackingMode,
} from '@/lib/geo';
import { gentleWarning, heartbeat, success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import {
  checkpointsFor,
  runHeartRate,
  runName,
  summarize,
  type RoutePoint,
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

type Phase = 'calibrate' | 'running' | 'check' | 'done';

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
  const checkpoints = useRef(checkpointsFor(type, plannedMin)).current;
  const startRef = useRef<number | null>(null);
  const seedRef = useRef((Date.now() % 1e9) | 0);
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('calibrate');
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<WorkoutSample[]>([]);
  const [distance, setDistance] = useState(0);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('simulated');
  const [checkStartedAt, setCheckStartedAt] = useState(0);
  const nextCheckIdx = useRef(0);
  const savedRef = useRef(false);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const distanceRef = useRef(0);
  const routeRef = useRef<RoutePoint[]>([]);
  const stopTrackingRef = useRef<() => void>(() => {});

  const useCam = !isWeb && permission?.granted === true;

  // Keep the screen on for the whole run (native only — web denies wake locks).
  useEffect(() => {
    if (isWeb) return;
    activateKeepAwakeAsync('run').catch(() => {});
    return () => {
      Promise.resolve(deactivateKeepAwake('run')).catch(() => {});
    };
  }, [isWeb]);

  useEffect(() => {
    if (!isWeb && !permission?.granted) requestPermission().catch(() => {});
    return () => {
      cancelReminders();
      stopTrackingRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsedNow = useCallback(
    () => (startRef.current === null ? 0 : (Date.now() - startRef.current) / 1000),
    []
  );

  const captureSample = useCallback(
    (captured: boolean) => {
      const at = Math.round(elapsedNow());
      const hr = runHeartRate(type, at, seedRef.current);
      setSamples((prev) => [...prev, { atSec: at, hr, captured }]);
      if (captured) success();
      setPhase('running');
    },
    [type, elapsedNow]
  );

  /** Calibration success: stamp t=0, start GPS + reminders, go. */
  const beginRun = useCallback(async () => {
    startRef.current = Date.now();
    const at0 = runHeartRate(type, 0, seedRef.current);
    setSamples([{ atSec: 0, hr: at0, captured: true }]);
    success();
    setPhase('running');
    scheduleCheckReminders(checkpoints);
    const { mode, stop } = await startRunTracking();
    stopTrackingRef.current = stop;
    setTrackingMode(mode);
  }, [type, checkpoints]);

  // Clock + distance. Fires checkpoints, ends at planned duration.
  useEffect(() => {
    if (phase === 'done' || phase === 'calibrate') return;
    const timer = setInterval(() => {
      const e = elapsedNow();
      setElapsed(e);

      // Distance: GPS points when we have them, simulated pace otherwise.
      const pts = drainPoints();
      if (pts.length > 0) {
        for (const p of pts) {
          if (lastPointRef.current) {
            const d = haversineMeters(lastPointRef.current, p);
            if (d > 0.5 && d < 100) distanceRef.current += d;
          }
          lastPointRef.current = p;
          const at = Math.round(e);
          const lastRoute = routeRef.current[routeRef.current.length - 1];
          if (!lastRoute || at - lastRoute.atSec >= 3) {
            routeRef.current.push({ lat: p.lat, lon: p.lon, atSec: at });
          }
        }
      } else if (trackingMode === 'simulated') {
        distanceRef.current = e * simulatedSpeed(type);
      }
      setDistance(distanceRef.current);

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
    }, 500);
    return () => clearInterval(timer);
  }, [phase, checkpoints, plannedMin, checkStartedAt, captureSample, elapsedNow, trackingMode, type]);

  // The buzz: insistent haptic pattern while a check is waiting.
  useEffect(() => {
    if (phase !== 'check') return;
    gentleWarning();
    const buzz = setInterval(() => gentleWarning(), 1200);
    return () => clearInterval(buzz);
  }, [phase]);

  // Fingertip detection: calibration at start and each mid-run check.
  useEffect(() => {
    if (phase !== 'check' && phase !== 'calibrate') return;
    const onSuccess = phase === 'calibrate' ? beginRun : () => captureSample(true);
    let stopped = false;

    if (!useCam) {
      const t = setTimeout(() => { if (!stopped) onSuccess(); }, 2500);
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
              onSuccess();
              return;
            }
          } else {
            consecutive = 0;
          }
        } catch {
          failures += 1;
          if (failures > 4) {
            onSuccess();
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
  }, [phase, useCam, captureSample, beginRun]);

  const finishRun = useCallback(() => {
    cancelReminders();
    stopTrackingRef.current();
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
      startedAt: new Date(startRef.current ?? Date.now()).toISOString(),
      durationSec,
      samples,
      avgHr,
      maxHr,
      distanceMeters: Math.round(distanceRef.current),
      route: routeRef.current,
    });
    if (byDate(today)) updateDay(today, { workout: 'run' });
    tapLight();
    router.dismissTo('/(tabs)/run');
  }, [elapsed, samples, type, plannedMin, addWorkout, byDate, updateDay]);

  const captured = samples.filter((s) => s.captured).length;
  const nextCheck = checkpoints[nextCheckIdx.current];
  const { avgHr, maxHr } = summarize(samples);
  const lastHr = samples.length > 0 ? samples[samples.length - 1].hr : null;

  const fingerPrompt = (headline: string, caption: string) => (
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
        {headline}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {caption}
      </ThemedText>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <View>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              {runName(type)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {plannedMin} min planned · {captured}/{checkpoints.length + 1} checks
              {trackingMode === 'simulated' ? ' · GPS simulated' : ''}
            </ThemedText>
          </View>
          {phase !== 'done' && phase !== 'calibrate' && (
            <PressScale onPress={finishRun} accessibilityRole="button">
              <ThemedText style={{ color: theme.low, fontWeight: '700' }}>End Run</ThemedText>
            </PressScale>
          )}
          {phase === 'calibrate' && (
            <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel run">
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </PressScale>
          )}
        </View>

        {phase === 'calibrate' && (
          <View style={styles.body}>
            {fingerPrompt(
              'Finger on the camera.',
              'Quick calibration reading — the run starts the moment we lock on.'
            )}
          </View>
        )}

        {(phase === 'running' || phase === 'check') && (
          <View style={styles.body}>
            <View style={styles.heroStat}>
              <ThemedText style={styles.clock}>{formatClock(elapsed)}</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                Time
              </ThemedText>
            </View>

            <View style={styles.statGrid}>
              <View style={styles.stat}>
                <ThemedText style={styles.statValue}>{formatMiles(distance)}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                  Miles
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={styles.statValue}>{formatPace(distance, elapsed)}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                  /Mile
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, lastHr ? { color: theme.heart } : null]}>
                  {lastHr ?? '—'}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                  BPM
                </ThemedText>
              </View>
            </View>

            {phase === 'check' ? (
              fingerPrompt('Finger on the camera.', 'Quick heart rate check — keep moving.')
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {nextCheck !== undefined
                  ? `Next heart rate check in ${formatClock(Math.max(0, nextCheck - elapsed))}`
                  : 'No more checks — finish strong.'}
              </ThemedText>
            )}
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.body}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Nice run.
            </ThemedText>
            <Card style={styles.summaryCard}>
              <View style={styles.statGrid}>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{formatClock(elapsed)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Time</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{formatMiles(distance)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Miles</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{formatPace(distance, elapsed)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">/Mile</ThemedText>
                </View>
              </View>
              <View style={styles.statGrid}>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{avgHr || '—'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Avg bpm</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{maxHr || '—'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Max bpm</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statValue}>{captured}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">HR checks</ThemedText>
                </View>
              </View>
              {samples.length >= 2 && (
                <Sparkline values={samples.map((s) => s.hr)} color={theme.heart} height={54} />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Save it, then upload to Strava from the Run tab — distance, route and heart rate
                all come along.
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
    paddingBottom: Spacing.five,
  },
  centerText: {
    textAlign: 'center',
  },
  heroStat: {
    alignItems: 'center',
    gap: 2,
  },
  clock: {
    fontSize: 84,
    lineHeight: 92,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -2,
  },
  statGrid: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    minWidth: 90,
  },
  statValue: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -1,
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
  summaryCard: {
    alignSelf: 'stretch',
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
