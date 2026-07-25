import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { PressScale } from '@/components/ui/press-scale';
import { Waveform } from '@/components/ui/waveform';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { composeRecord, makeScanMetrics } from '@/lib/engine';
import { todayKey } from '@/lib/format';
import { gentleWarning, heartbeat, success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import type { Confidence } from '@/lib/types';

const NATIVE_SECONDS = 30;
const WEB_SECONDS = 8;

type Phase = 'intro' | 'measuring' | 'retry' | 'processing';

export default function ScanScreen() {
  const theme = useTheme();
  const { records, saveRecord, settings } = useBrief();
  const [permission, requestPermission] = useCameraPermissions();

  const isWeb = Platform.OS === 'web';
  const duration = isWeb ? WEB_SECONDS : NATIVE_SECONDS;

  const [phase, setPhase] = useState<Phase>('intro');
  const [elapsed, setElapsed] = useState(0);
  const [moving, setMoving] = useState(false);
  const [processingLine, setProcessingLine] = useState('Reading your morning…');
  const movementCount = useRef(0);
  const movingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useCamera = !isWeb && permission?.granted === true;

  const start = useCallback(async () => {
    tapLight();
    if (!isWeb && !permission?.granted) {
      await requestPermission().catch(() => {});
    }
    movementCount.current = 0;
    setElapsed(0);
    setPhase('measuring');
  }, [isWeb, permission?.granted, requestPermission]);

  const complete = useCallback(
    (confidence: Confidence) => {
      setPhase('processing');
      setProcessingLine('Reading your morning…');
      const line2 = setTimeout(() => setProcessingLine('Comparing to your baseline…'), 950);

      const tk = todayKey();
      const history = records.filter((r) => r.date !== tk);
      let seed = 0;
      for (const ch of tk) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
      seed = (seed ^ (movementCount.current * 2654435761)) | 0;

      const metrics = makeScanMetrics(history, seed);
      const record = composeRecord(tk, metrics, history, confidence, seed);
      saveRecord(record);

      setTimeout(() => {
        clearTimeout(line2);
        success();
        router.replace('/brief');
      }, 2100);
    },
    [records, saveRecord]
  );

  const finish = useCallback(() => {
    const confidence: Confidence =
      movementCount.current < 6 ? 'excellent' : movementCount.current < 16 ? 'good' : 'weak';
    if (confidence === 'weak') {
      gentleWarning();
      setPhase('retry');
      return;
    }
    complete(confidence);
  }, [complete]);

  // Measurement loop: timer + heartbeat haptics + real motion detection.
  useEffect(() => {
    if (phase !== 'measuring') return;

    const t0 = Date.now();
    const timer = setInterval(() => {
      const e = (Date.now() - t0) / 1000;
      setElapsed(Math.min(e, duration));
      if (e >= duration) {
        clearInterval(timer);
        finish();
      }
    }, 200);

    let beat: ReturnType<typeof setInterval> | undefined;
    if (settings.haptics) {
      beat = setInterval(() => heartbeat(), 880);
    }

    let sub: { remove: () => void } | undefined;
    if (!isWeb) {
      Accelerometer.setUpdateInterval(160);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const deviation = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
        if (deviation > 0.16) {
          movementCount.current += 1;
          setMoving(true);
          if (movingTimeout.current) clearTimeout(movingTimeout.current);
          movingTimeout.current = setTimeout(() => setMoving(false), 1100);
        }
      });
    }

    return () => {
      clearInterval(timer);
      if (beat) clearInterval(beat);
      sub?.remove();
    };
  }, [phase, duration, finish, isWeb, settings.haptics]);

  const remaining = Math.max(0, Math.ceil(duration - elapsed));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        {phase !== 'processing' && (
          <PressScale
            onPress={() => router.back()}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Cancel scan">
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </PressScale>
        )}

        {phase === 'intro' && (
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="camera-outline" size={34} color={theme.accent} />
            </View>
            <ThemedText type="subtitle" style={styles.centerText}>
              Today’s Brief
            </ThemedText>
            <View style={styles.steps}>
              <Step theme={theme} icon="hand-left-outline" text="Place your fingertip gently over the rear camera and flash." />
              <Step theme={theme} icon="pause-outline" text="Rest your hand somewhere steady." />
              <Step theme={theme} icon="leaf-outline" text={`Breathe normally — about ${duration} seconds.`} />
            </View>
            {isWeb && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                The camera scan is simulated in the browser — use your phone for the real thing.
              </ThemedText>
            )}
            <PressScale onPress={start} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Start Today’s Brief</ThemedText>
            </PressScale>
          </View>
        )}

        {phase === 'measuring' && (
          <View style={styles.body}>
            {useCamera ? (
              <View style={[styles.cameraDot, { borderColor: theme.hairline }]}>
                <CameraView style={styles.camera} facing="back" enableTorch animateShutter={false} mute />
              </View>
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="pulse" size={30} color={theme.accent} />
              </View>
            )}

            <ProgressRing progress={elapsed / duration} remaining={remaining} />

            <Waveform color={theme.accent} />

            <ThemedText type="subtitle" style={styles.centerText}>
              {moving ? 'Gently hold still.' : 'Reading your pulse…'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Keep your fingertip over the camera and flash.
            </ThemedText>
          </View>
        )}

        {phase === 'retry' && (
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: theme.claySoft }]}>
              <Ionicons name="hand-left-outline" size={32} color={theme.clay} />
            </View>
            <ThemedText type="subtitle" style={styles.centerText}>
              We noticed movement.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Let’s try one more quick scan — it only takes a moment.
            </ThemedText>
            <PressScale onPress={start} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Try again</ThemedText>
            </PressScale>
            <PressScale onPress={() => complete('weak')}>
              <ThemedText type="small" themeColor="textSecondary">
                Use this reading anyway
              </ThemedText>
            </PressScale>
          </View>
        )}

        {phase === 'processing' && (
          <View style={styles.body}>
            <BreathingDot color={theme.accent} soft={theme.accentSoft} />
            <ThemedText type="subtitle" style={styles.centerText}>
              {processingLine}
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function Step({ theme, icon, text }: { theme: ReturnType<typeof useTheme>; icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.stepRow}>
      <Ionicons name={icon} size={18} color={theme.accent} />
      <ThemedText themeColor="textSecondary" style={styles.stepText}>
        {text}
      </ThemedText>
    </View>
  );
}

function ProgressRing({ progress, remaining }: { progress: number; remaining: number }) {
  const theme = useTheme();
  const size = 168;
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(progress, 1))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <ThemedText style={styles.remaining}>{remaining}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        seconds left
      </ThemedText>
    </View>
  );
}

function BreathingDot({ color, soft }: { color: string; soft: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.25, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [scale]);

  const outer = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.breathWrap}>
      <Animated.View style={[styles.breathOuter, { backgroundColor: soft }, outer]} />
      <View style={[styles.breathInner, { backgroundColor: color }]} />
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
  close: {
    alignSelf: 'flex-start',
    padding: Spacing.two,
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
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
  },
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
  cameraDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  camera: {
    flex: 1,
  },
  remaining: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '600',
    letterSpacing: -1,
  },
  breathWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  breathInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
});
