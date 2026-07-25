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
  METERS_PER_MILE,
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
const STRAVA_ORANGE = '#FC4C02';

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

/** Strava-style HH:MM:SS. */
function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

/** Mile splits bar row, Strava-style: past splits gray, current blue + orange underline. */
function SplitsBars({
  splitPaces,
  currentPace,
  theme,
}: {
  splitPaces: number[]; // sec per mile for completed splits
  currentPace: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const slots = Math.max(3, splitPaces.length + 1);
  const shown = [...splitPaces.map((p) => ({ pace: p, current: false })), { pace: null, current: true }];
  while (shown.length < slots) shown.push({ pace: null, current: false });
  const fastest = Math.min(...splitPaces, 8 * 60);

  return (
    <View style={styles.splitsWrap}>
      <View style={styles.splitsRow}>
        {shown.slice(-4).map((s, i) => {
          const h = s.pace ? Math.max(28, Math.min(64, (fastest / s.pace) * 64)) : s.current ? 56 : 24;
          return (
            <View key={i} style={styles.splitCol}>
              {s.current && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.splitPaceLabel}>
                  {currentPace}
                </ThemedText>
              )}
              <View
                style={[
                  styles.splitBar,
                  {
                    height: h,
                    backgroundColor: s.current
                      ? theme.accent
                      : s.pace
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                  },
                ]}
              />
              {s.current && <View style={[styles.splitUnderline, { backgroundColor: STRAVA_ORANGE }]} />}
            </View>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Splits (mi)
      </ThemedText>
    </View>
  );
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
  const seedRef = useRef((Date.now() % 1e9) | 0);
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('calibrate');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<WorkoutSample[]>([]);
  const [distance, setDistance] = useState(0);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('simulated');
  const [checkStartedAt, setCheckStartedAt] = useState(0);
  const nextCheckIdx = useRef(0);
  const savedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());
  const segStartRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const pausedRef = useRef(false);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const distanceRef = useRef(0);
  const routeRef = useRef<RoutePoint[]>([]);
  const splitsRef = useRef<number[]>([]); // elapsed sec at each completed mile
  const stopTrackingRef = useRef<() => void>(() => {});

  const useCam = !isWeb && permission?.granted === true;

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

  const elapsedNow = useCallback(() => {
    if (segStartRef.current === null) return accumRef.current;
    return accumRef.current + (pausedRef.current ? 0 : (Date.now() - segStartRef.current) / 1000);
  }, []);

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

  /** Calibration success: start the clock, GPS and reminders. */
  const beginRun = useCallback(async () => {
    startedAtRef.current = Date.now();
    segStartRef.current = Date.now();
    const at0 = runHeartRate(type, 0, seedRef.current);
    setSamples([{ atSec: 0, hr: at0, captured: true }]);
    success();
    setPhase('running');
    scheduleCheckReminders(checkpoints);
    const { mode, stop } = await startRunTracking();
    stopTrackingRef.current = stop;
    setTrackingMode(mode);
  }, [type, checkpoints]);

  const pauseRun = useCallback(() => {
    if (pausedRef.current || segStartRef.current === null) return;
    accumRef.current += (Date.now() - segStartRef.current) / 1000;
    pausedRef.current = true;
    setPaused(true);
    tapLight();
  }, []);

  const resumeRun = useCallback(() => {
    segStartRef.current = Date.now();
    pausedRef.current = false;
    lastPointRef.current = null; // don't count distance travelled while paused
    setPaused(false);
    tapLight();
  }, []);

  // Clock + distance + splits. Fires checkpoints, ends at planned duration.
  useEffect(() => {
    if (phase === 'done' || phase === 'calibrate') return;
    const timer = setInterval(() => {
      const e = elapsedNow();
      setElapsed(e);

      const pts = drainPoints();
      if (!pausedRef.current) {
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
          distanceRef.current += 0.5 * simulatedSpeed(type);
        }
        setDistance(distanceRef.current);

        // Mile split boundary
        if (distanceRef.current >= (splitsRef.current.length + 1) * METERS_PER_MILE) {
          splitsRef.current.push(e);
        }
      }

      if (phase === 'running' && !pausedRef.current) {
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
    if (!pausedRef.current && segStartRef.current !== null) {
      accumRef.current += (Date.now() - segStartRef.current) / 1000;
      pausedRef.current = true;
    }
    setElapsed(accumRef.current);
    setPhase('done');
  }, []);

  const saveRun = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const durationSec = Math.round(accumRef.current);
    const { avgHr, maxHr } = summarize(samples);
    const today = dateKey(new Date());
    addWorkout({
      id: `${Date.now()}`,
      date: today,
      type,
      plannedMin,
      startedAt: new Date(startedAtRef.current).toISOString(),
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
  }, [samples, type, plannedMin, addWorkout, byDate, updateDay]);

  const captured = samples.filter((s) => s.captured).length;
  const nextCheck = checkpoints[nextCheckIdx.current];
  const { avgHr, maxHr } = summarize(samples);
  const lastHr = samples.length > 0 ? samples[samples.length - 1].hr : null;

  // Current split pace: time and distance since the last completed mile.
  const splitStartSec = splitsRef.current.length
    ? splitsRef.current[splitsRef.current.length - 1]
    : 0;
  const splitDistance = distance - splitsRef.current.length * METERS_PER_MILE;
  const currentSplitPace = formatPace(splitDistance, elapsed - splitStartSec);
  const completedSplitPaces = splitsRef.current.map((s, i) =>
    i === 0 ? s : s - splitsRef.current[i - 1]
  );

  const fingerPrompt = (headline: string, caption: string) => (
    <>
      {useCam && (
        <View style={[styles.cameraDot, { borderColor: theme.accent }]}>
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
        <Waveform color={theme.accent} height={64} />
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
        {phase === 'calibrate' && (
          <>
            <View style={styles.topRow}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                {runName(type)} · {plannedMin} min
              </ThemedText>
              <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel run">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </PressScale>
            </View>
            <View style={styles.body}>
              {fingerPrompt(
                'Finger on the camera.',
                'Quick calibration reading — the run starts the moment we lock on.'
              )}
            </View>
          </>
        )}

        {(phase === 'running' || phase === 'check') && (
          <View style={styles.stravaLayout}>
            <ThemedText style={styles.clock}>{formatClock(elapsed)}</ThemedText>

            {phase === 'check' ? (
              <View style={styles.checkBlock}>{fingerPrompt('Finger on the camera.', 'Quick heart rate check — keep moving.')}</View>
            ) : (
              <>
                <View style={styles.bigStat}>
                  <ThemedText style={styles.bigStatValue}>{currentSplitPace}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.bigStatLabel}>
                    Split avg. pace (/mi)
                  </ThemedText>
                </View>

                <View style={styles.bigStat}>
                  <ThemedText style={styles.bigStatValue}>{formatMiles(distance)}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.bigStatLabel}>
                    Distance (mi)
                  </ThemedText>
                </View>

                <View style={styles.hrRow}>
                  <Ionicons name="heart" size={14} color={theme.heart} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {lastHr ? `${lastHr} bpm` : 'calibrating'} · {captured}/{checkpoints.length + 1} checks
                    {nextCheck !== undefined && !paused
                      ? ` · next in ${Math.max(0, Math.ceil((nextCheck - elapsed) / 60))}m`
                      : ''}
                    {trackingMode === 'simulated' ? ' · GPS simulated' : ''}
                  </ThemedText>
                </View>

                <SplitsBars splitPaces={completedSplitPaces} currentPace={currentSplitPace} theme={theme} />
              </>
            )}

            <View style={styles.controls}>
              {paused ? (
                <View style={styles.pausedRow}>
                  <PressScale
                    onPress={resumeRun}
                    style={[styles.bigButton, { backgroundColor: STRAVA_ORANGE, flex: 1 }]}>
                    <Ionicons name="play" size={20} color="#FFF" />
                    <ThemedText style={styles.bigButtonLabel}>Resume</ThemedText>
                  </PressScale>
                  <PressScale
                    onPress={finishRun}
                    style={[styles.bigButton, { backgroundColor: theme.backgroundSelected, flex: 1 }]}>
                    <Ionicons name="flag" size={18} color={theme.text} />
                    <ThemedText style={[styles.bigButtonLabel, { color: theme.text }]}>Finish</ThemedText>
                  </PressScale>
                </View>
              ) : (
                <PressScale
                  onPress={pauseRun}
                  style={[styles.bigButton, { backgroundColor: STRAVA_ORANGE }]}>
                  <Ionicons name="pause" size={20} color="#FFF" />
                  <ThemedText style={styles.bigButtonLabel}>Pause</ThemedText>
                </PressScale>
              )}
            </View>
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
            <PressScale onPress={saveRun} style={[styles.bigButton, { backgroundColor: STRAVA_ORANGE, minWidth: 230 }]}>
              <ThemedText style={styles.bigButtonLabel}>Save Run</ThemedText>
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
    alignItems: 'center',
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
  stravaLayout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  clock: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -1,
  },
  bigStat: {
    alignItems: 'center',
    gap: 2,
  },
  bigStatValue: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -2,
  },
  bigStatLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  checkBlock: {
    alignItems: 'center',
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  splitsWrap: {
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  splitsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  splitCol: {
    alignItems: 'center',
    width: 84,
    justifyContent: 'flex-end',
  },
  splitPaceLabel: {
    marginBottom: 2,
  },
  splitBar: {
    alignSelf: 'stretch',
    borderRadius: 8,
  },
  splitUnderline: {
    alignSelf: 'stretch',
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  controls: {
    alignSelf: 'stretch',
    paddingTop: Spacing.two,
  },
  pausedRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three + 2,
    borderRadius: Radius.pill,
  },
  bigButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
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
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -1,
  },
});
