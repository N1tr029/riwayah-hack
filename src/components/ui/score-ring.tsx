import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { scoreColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  /** Big number in the middle; hide for compact usages. */
  showValue?: boolean;
  delay?: number;
}

/** Animated recovery ring — the centerpiece of the brief. */
export function ScoreRing({ score, size = 190, strokeWidth = 13, showValue = true, delay = 250 }: Props) {
  const theme = useTheme();
  const color = scoreColor(score, theme);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(score / 100, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [score, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showValue && (
        <View style={styles.center}>
          <ThemedText style={[styles.value, { fontSize: size * 0.3, lineHeight: size * 0.34 }]}>
            {score}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Recovery
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '600',
    letterSpacing: -1,
  },
});
