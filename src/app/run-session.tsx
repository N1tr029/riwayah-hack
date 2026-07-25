import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { Sparkline } from '@/components/ui/sparkline';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dateKey } from '@/lib/format';
import {
  METERS_PER_MILE,
  drainPoints,
  formatMiles,
  formatPace,
  haversineMeters,
  startRunTracking,
  type GeoPoint,
  type TrackingMode,
} from '@/lib/geo';
import { readLatestHeartRate, requestHealthPermissions } from '@/lib/health';
import { success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import {
  runName,
  summarize,
  type RoutePoint,
  type RunType,
  type WorkoutSample,
} from '@/lib/workout';

const STRAVA_ORANGE = '#FC4C02';

function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

function SplitsBars({
  splitPaces,
  currentPace,
  theme,
}: {
  splitPaces: number[];
  currentPace: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const slots = Math.max(3, splitPaces.length + 1);
  const shown = [
    ...splitPaces.map((pace) => ({ pace, current: false })),
    { pace: null, current: true },
  ];
  while (shown.length < slots) shown.push({ pace: null, current: false });
  const fastest = Math.min(...splitPaces, 8 * 60);

  return (
    <View style={styles.splitsWrap}>
      <View style={styles.splitsRow}>
        {shown.slice(-4).map((split, index) => {
          const height = split.pace
            ? Math.max(28, Math.min(64, (fastest / split.pace) * 64))
            : split.current
              ? 56
              : 24;
          return (
            <View key={index} style={styles.splitCol}>
              {split.current && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.splitPaceLabel}>
                  {currentPace}
                </ThemedText>
              )}
              <View
                style={[
                  styles.splitBar,
                  {
                    height,
                    backgroundColor: split.current
                      ? theme.accent
                      : split.pace
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                  },
                ]}
              />
              {split.current && (
                <View style={[styles.splitUnderline, { backgroundColor: STRAVA_ORANGE }]} />
              )}
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

type Phase = 'running' | 'done';
type HeartStatus = 'connecting' | 'waiting' | 'live' | 'unavailable';

export default function RunSessionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ type: RunType; minutes: string }>();
  const validTypes: RunType[] = ['free', 'easy', 'tempo', 'long'];
  const type: RunType = validTypes.includes(params.type as RunType)
    ? (params.type as RunType)
    : 'free';
  const plannedMin =
    type === 'free' ? 0 : Math.max(5, parseInt(params.minutes ?? '30', 10) || 30);
  const { addWorkout, updateDay, byDate } = useBrief();

  const [phase, setPhase] = useState<Phase>('running');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<WorkoutSample[]>([]);
  const [distance, setDistance] = useState(0);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('unavailable');
  const [heartStatus, setHeartStatus] = useState<HeartStatus>('connecting');

  const startedRef = useRef(false);
  const savedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());
  const segStartRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const pausedRef = useRef(false);
  const healthAuthorizedRef = useRef(false);
  const lastHeartIdRef = useRef<string | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const distanceRef = useRef(0);
  const routeRef = useRef<RoutePoint[]>([]);
  const splitsRef = useRef<number[]>([]);
  const stopTrackingRef = useRef<() => void>(() => {});

  const elapsedNow = useCallback(() => {
    if (segStartRef.current === null) return accumRef.current;
    return accumRef.current + (pausedRef.current ? 0 : (Date.now() - segStartRef.current) / 1000);
  }, []);

  const beginRun = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startedAtRef.current = Date.now();
    segStartRef.current = Date.now();
    success();

    startRunTracking().then(({ mode, stop }) => {
      stopTrackingRef.current = stop;
      setTrackingMode(mode);
    });
    requestHealthPermissions().then((authorized) => {
      healthAuthorizedRef.current = authorized;
      setHeartStatus(authorized ? 'waiting' : 'unavailable');
    });
  }, []);

  useEffect(() => {
    beginRun();
    if (Platform.OS !== 'web') activateKeepAwakeAsync('run').catch(() => {});
    return () => {
      stopTrackingRef.current();
      if (Platform.OS !== 'web') {
        Promise.resolve(deactivateKeepAwake('run')).catch(() => {});
      }
    };
  }, [beginRun]);

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
    lastPointRef.current = null;
    setPaused(false);
    tapLight();
  }, []);

  const finishRun = useCallback(() => {
    stopTrackingRef.current();
    if (!pausedRef.current && segStartRef.current !== null) {
      accumRef.current += (Date.now() - segStartRef.current) / 1000;
    }
    pausedRef.current = true;
    segStartRef.current = null;
    setPaused(true);
    setElapsed(accumRef.current);
    setPhase('done');
  }, []);

  // Poll the health store for samples written after this run actually started.
  useEffect(() => {
    if (phase !== 'running') return;
    let stopped = false;
    const poll = async () => {
      if (!healthAuthorizedRef.current || pausedRef.current) return;
      const sample = await readLatestHeartRate(new Date(startedAtRef.current));
      if (stopped || !sample || sample.id === lastHeartIdRef.current) return;
      lastHeartIdRef.current = sample.id;
      const atSec = Math.max(
        0,
        Math.round((new Date(sample.at).getTime() - startedAtRef.current) / 1000)
      );
      setSamples((previous) => [...previous, { atSec, hr: sample.bpm, captured: true }]);
      setHeartStatus('live');
    };
    poll();
    const timer = setInterval(poll, 10_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase]);

  // Clock, real GPS distance, and mile splits.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => {
      const currentElapsed = elapsedNow();
      setElapsed(currentElapsed);

      const points = drainPoints();
      if (!pausedRef.current) {
        for (const point of points) {
          if (lastPointRef.current) {
            const delta = haversineMeters(lastPointRef.current, point);
            if (delta > 0.5 && delta < 100) distanceRef.current += delta;
          }
          lastPointRef.current = point;
          const atSec = Math.round(currentElapsed);
          const lastRoute = routeRef.current[routeRef.current.length - 1];
          if (!lastRoute || atSec - lastRoute.atSec >= 3) {
            routeRef.current.push({ lat: point.lat, lon: point.lon, atSec });
          }
        }
        setDistance(distanceRef.current);
        if (distanceRef.current >= (splitsRef.current.length + 1) * METERS_PER_MILE) {
          splitsRef.current.push(currentElapsed);
        }
        if (plannedMin > 0 && currentElapsed >= plannedMin * 60) finishRun();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [elapsedNow, finishRun, phase, plannedMin]);

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
  }, [addWorkout, byDate, plannedMin, samples, type, updateDay]);

  const discardRun = useCallback(() => {
    stopTrackingRef.current();
    router.dismissTo('/(tabs)/run');
  }, []);

  const { avgHr, maxHr } = summarize(samples);
  const lastHr = samples.length ? samples[samples.length - 1].hr : null;
  const splitStartSec = splitsRef.current.length
    ? splitsRef.current[splitsRef.current.length - 1]
    : 0;
  const splitDistance = distance - splitsRef.current.length * METERS_PER_MILE;
  const currentSplitPace = formatPace(splitDistance, elapsed - splitStartSec);
  const completedSplitPaces = splitsRef.current.map((split, index) =>
    index === 0 ? split : split - splitsRef.current[index - 1]
  );

  const heartLine =
    heartStatus === 'live' && lastHr
      ? `${lastHr} bpm · Apple Health`
      : heartStatus === 'unavailable'
        ? 'Heart rate unavailable'
        : heartStatus === 'connecting'
          ? 'Connecting to Apple Health…'
          : 'Waiting for a new Apple Health sample';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {phase === 'running' && (
          <View style={styles.runLayout}>
            <View style={styles.topRow}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                {type === 'free' ? 'Just Run' : `${runName(type)} · ${plannedMin} min`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {trackingMode === 'unavailable' ? 'GPS unavailable' : 'GPS on'}
              </ThemedText>
            </View>

            <ThemedText style={styles.clock}>{formatClock(elapsed)}</ThemedText>

            <View style={styles.bigStat}>
              <ThemedText style={styles.bigStatValue}>{currentSplitPace}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.bigStatLabel}>
                Current pace (/mi)
              </ThemedText>
            </View>

            <View style={styles.bigStat}>
              <ThemedText style={styles.bigStatValue}>{formatMiles(distance)}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.bigStatLabel}>
                Distance (mi)
              </ThemedText>
            </View>

            <View style={styles.hrRow}>
              <Ionicons name="heart" size={15} color={theme.heart} />
              <ThemedText type="small" themeColor="textSecondary">
                {heartLine}
              </ThemedText>
            </View>

            <SplitsBars
              splitPaces={completedSplitPaces}
              currentPace={currentSplitPace}
              theme={theme}
            />

            <View style={styles.controls}>
              <PressScale
                onPress={paused ? resumeRun : pauseRun}
                style={[styles.bigButton, { backgroundColor: STRAVA_ORANGE, flex: 1 }]}>
                <Ionicons name={paused ? 'play' : 'pause'} size={20} color="#FFF" />
                <ThemedText style={styles.bigButtonLabel}>{paused ? 'Resume' : 'Pause'}</ThemedText>
              </PressScale>
              <PressScale
                onPress={finishRun}
                style={[styles.bigButton, { backgroundColor: theme.backgroundSelected, flex: 1 }]}>
                <Ionicons name="flag" size={18} color={theme.text} />
                <ThemedText style={[styles.bigButtonLabel, { color: theme.text }]}>Finish</ThemedText>
              </PressScale>
            </View>
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.body}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Run complete
            </ThemedText>
            <Card style={styles.summaryCard}>
              <View style={styles.statGrid}>
                <Stat value={formatClock(elapsed)} label="Time" />
                <Stat value={formatMiles(distance)} label="Miles" />
                <Stat value={formatPace(distance, elapsed)} label="/Mile" />
              </View>
              <View style={styles.statGrid}>
                <Stat value={avgHr || '—'} label="Avg bpm" />
                <Stat value={maxHr || '—'} label="Max bpm" />
                <Stat value={samples.length} label="HR samples" />
              </View>
              {samples.length >= 2 && (
                <Sparkline values={samples.map((sample) => sample.hr)} color={theme.heart} height={54} />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                GPS and heart rate are included only when your devices recorded them.
              </ThemedText>
            </Card>
            <PressScale
              onPress={saveRun}
              style={[styles.bigButton, { backgroundColor: STRAVA_ORANGE, minWidth: 230 }]}>
              <ThemedText style={styles.bigButtonLabel}>Save Run</ThemedText>
            </PressScale>
            <PressScale onPress={discardRun}>
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

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
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
  centerText: { textAlign: 'center' },
  runLayout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  clock: {
    fontSize: 58,
    lineHeight: 66,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -1,
  },
  bigStat: { alignItems: 'center', gap: 2 },
  bigStatValue: {
    fontSize: 66,
    lineHeight: 74,
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
    minHeight: 24,
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
    width: 80,
    justifyContent: 'flex-end',
  },
  splitPaceLabel: { marginBottom: 2 },
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
    flexDirection: 'row',
    gap: Spacing.two + 2,
    paddingTop: Spacing.two,
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
  summaryCard: { alignSelf: 'stretch' },
  statGrid: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    minWidth: 88,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: Fonts.rounded,
    letterSpacing: -1,
  },
});
