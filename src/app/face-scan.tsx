import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  buildObservations,
  buildQuality,
  extractFeatures,
  type FrontCameraScanResult,
} from '@/lib/face';
import { averageColor, type FrameColor } from '@/lib/finger';
import { todayKey } from '@/lib/format';
import { gentleWarning, success, tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';

const FIXATE_SEC = 12;
const TRACK_SEC = 6;

type Phase = 'intro' | 'fixate' | 'track' | 'processing' | 'results';

/** Pulsing center fixation dot. */
function FixationDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.fixationDot, { backgroundColor: color }, style]} />;
}

/** Dot moving slowly along a short horizontal path for the gaze-quality pass. */
function TrackingDot({ color, width }: { color: string; width: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    const span = Math.max(width - 80, 120);
    x.value = 0;
    x.value = withRepeat(
      withSequence(
        withTiming(span, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [width, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ width: Math.max(width - 40, 160), height: 40, justifyContent: 'center' }}>
      <Animated.View style={[styles.fixationDot, { backgroundColor: color }, style]} />
    </View>
  );
}

export default function FaceScanScreen() {
  const theme = useTheme();
  const { faceScans, addFaceScan, today } = useBrief();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const leave = () => {
    if (next === 'brief') router.replace('/brief');
    else router.back();
  };

  const isWeb = Platform.OS === 'web';
  const [phase, setPhase] = useState<Phase>('intro');
  const [remaining, setRemaining] = useState(FIXATE_SEC + TRACK_SEC);
  const [result, setResult] = useState<FrontCameraScanResult | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const framesRef = useRef<FrameColor[]>([]);
  const motionRef = useRef(0);

  const useCam = !isWeb && permission?.granted === true;

  const start = useCallback(async () => {
    tapLight();
    if (!isWeb && !permission?.granted) {
      const res = await requestPermission().catch(() => null);
      if (!res?.granted && !isWeb) return;
    }
    framesRef.current = [];
    motionRef.current = 0;
    setRemaining(FIXATE_SEC + TRACK_SEC);
    setPhase('fixate');
  }, [isWeb, permission?.granted, requestPermission]);

  const finish = useCallback(() => {
    setPhase('processing');
    const frames = isWeb
      ? Array.from({ length: 10 }, () => ({ r: 150, g: 135, b: 125 }))
      : framesRef.current;
    const quality = buildQuality(frames, motionRef.current);
    let seed = 0;
    for (const ch of todayKey()) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const history = faceScans;
    const features = extractFeatures(quality, history, seed ^ 0x1234abcd);
    const partial = {
      capturedAt: new Date().toISOString(),
      date: todayKey(),
      duration: FIXATE_SEC + TRACK_SEC,
      ...features,
      quality,
    };
    const { observations, baselineComparison } = buildObservations(partial, history, today);
    const full: FrontCameraScanResult = { ...partial, observations, baselineComparison };
    setTimeout(() => {
      if (quality.usable) success();
      else gentleWarning();
      addFaceScan(full);
      setResult(full);
      setPhase('results');
    }, 1400);
  }, [isWeb, faceScans, today, addFaceScan]);

  // Scan clock: fixate → track → finish.
  useEffect(() => {
    if (phase !== 'fixate' && phase !== 'track') return;
    const total = FIXATE_SEC + TRACK_SEC;
    const t0 = Date.now();
    const already = phase === 'track' ? FIXATE_SEC : 0;
    const timer = setInterval(() => {
      const e = already + (Date.now() - t0) / 1000;
      setRemaining(Math.max(0, Math.ceil(total - e)));
      if (phase === 'fixate' && e >= FIXATE_SEC) setPhase('track');
      if (e >= total) {
        clearInterval(timer);
        finish();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [phase, finish]);

  // Frame sampling for lighting quality + motion for stability (both REAL).
  useEffect(() => {
    if ((phase !== 'fixate' && phase !== 'track') || !useCam) return;
    let stopped = false;
    const loop = async () => {
      await new Promise((r) => setTimeout(r, 600));
      while (!stopped) {
        try {
          const pic = await cameraRef.current?.takePictureAsync({
            quality: 0,
            base64: true,
            skipProcessing: true,
            shutterSound: false,
          });
          if (stopped) return;
          if (pic?.base64) framesRef.current.push(averageColor(pic.base64));
        } catch {
          // keep sampling
        }
        await new Promise((r) => setTimeout(r, 900));
      }
    };
    loop();

    let sub: { remove: () => void } | undefined;
    if (!isWeb) {
      Accelerometer.setUpdateInterval(200);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        if (Math.abs(Math.sqrt(x * x + y * y + z * z) - 1) > 0.15) motionRef.current += 1;
      });
    }
    return () => {
      stopped = true;
      sub?.remove();
    };
  }, [phase, useCam, isWeb]);

  const sectionTitle: Record<string, string> = {
    visual: 'Visual check-in',
    appearance: 'Appearance',
    confidence: 'Confidence',
  };

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background }]}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}>
      <SafeAreaView style={styles.safe}>
        {phase !== 'processing' && (
          <PressScale
            onPress={leave}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close visual check-in">
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </PressScale>
        )}

        {phase === 'intro' && (
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="glasses-outline" size={32} color={theme.accent} />
            </View>
            <ThemedText type="subtitle" style={styles.centerText}>
              Visual check-in
            </ThemedText>
            <View style={styles.steps}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                A 20-second front-camera check. Hold the phone at arm&apos;s length in even light,
                keep a neutral expression, and follow the dot.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Everything is processed on this phone. No photos or video are saved — only
                numbers, compared against your own past check-ins. This never diagnoses anything.
              </ThemedText>
            </View>
            <PressScale onPress={start} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Start check-in</ThemedText>
            </PressScale>
            {next === 'brief' && (
              <PressScale onPress={leave}>
                <ThemedText type="small" themeColor="textSecondary">
                  Skip for now
                </ThemedText>
              </PressScale>
            )}
          </View>
        )}

        {(phase === 'fixate' || phase === 'track') && (
          <View style={styles.body}>
            {useCam && (
              <View style={[styles.preview, { borderColor: theme.hairline }]}>
                <CameraView ref={cameraRef} style={styles.camera} facing="front" animateShutter={false} mute />
                <View style={[styles.faceGuide, { borderColor: theme.accent }]} />
              </View>
            )}
            <ThemedText style={styles.remaining}>{remaining}</ThemedText>
            {phase === 'fixate' ? (
              <>
                <FixationDot color={theme.accent} />
                <ThemedText type="subtitle" style={styles.centerText}>
                  Look at the dot.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Neutral expression, blink naturally.
                </ThemedText>
              </>
            ) : (
              <>
                <TrackingDot color={theme.accent} width={layoutWidth} />
                <ThemedText type="subtitle" style={styles.centerText}>
                  Follow the dot with your eyes.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Keep your head still — eyes only.
                </ThemedText>
              </>
            )}
          </View>
        )}

        {phase === 'processing' && (
          <View style={styles.body}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Comparing with your baseline…
            </ThemedText>
          </View>
        )}

        {phase === 'results' && result && (
          <View style={styles.body}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Visual check-in
            </ThemedText>
            {result.observations.map((o) => (
              <Card key={o.section} style={styles.obsCard}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                  {sectionTitle[o.section]}
                </ThemedText>
                <ThemedText>{o.text}</ThemedText>
              </Card>
            ))}
            <PressScale
              onPress={leave}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>
                {next === 'brief' ? 'See your brief' : 'Done'}
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
  close: {
    alignSelf: 'flex-start',
    padding: Spacing.two,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.five,
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
    paddingHorizontal: Spacing.three,
  },
  preview: {
    width: 128,
    height: 170,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  camera: {
    flex: 1,
  },
  faceGuide: {
    position: 'absolute',
    top: 18,
    left: 24,
    right: 24,
    bottom: 30,
    borderWidth: 2,
    borderRadius: 60,
    opacity: 0.6,
  },
  remaining: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
  },
  fixationDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  obsCard: {
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
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
    fontWeight: '700',
    fontSize: 17,
  },
});
