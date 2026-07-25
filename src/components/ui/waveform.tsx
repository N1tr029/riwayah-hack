import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

interface Props {
  color: string;
  height?: number;
  /** Beat period in ms — one pulse scrolls past per period. */
  period?: number;
}

/** One PPG-style pulse: flat, sharp systolic rise, dicrotic notch, settle. */
function pulsePath(cycle: number, h: number, cycles: number): string {
  const mid = h * 0.62;
  const parts: string[] = [`M 0 ${mid}`];
  for (let i = 0; i < cycles; i++) {
    const o = i * cycle;
    parts.push(
      `L ${o + cycle * 0.3} ${mid}`,
      `C ${o + cycle * 0.36} ${mid} ${o + cycle * 0.38} ${h * 0.12} ${o + cycle * 0.44} ${h * 0.1}`,
      `C ${o + cycle * 0.5} ${h * 0.12} ${o + cycle * 0.52} ${h * 0.52} ${o + cycle * 0.58} ${h * 0.5}`,
      `C ${o + cycle * 0.62} ${h * 0.46} ${o + cycle * 0.64} ${h * 0.38} ${o + cycle * 0.68} ${h * 0.42}`,
      `C ${o + cycle * 0.76} ${h * 0.52} ${o + cycle * 0.85} ${mid} ${o + cycle} ${mid}`
    );
  }
  return parts.join(' ');
}

/** Endless scrolling pulse waveform for the scan screen. */
export function Waveform({ color, height = 90, period = 920 }: Props) {
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  const cycle = 150;

  useEffect(() => {
    shift.value = 0;
    shift.value = withRepeat(withTiming(-cycle, { duration: period, easing: Easing.linear }), -1);
  }, [period, shift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  const cycles = width > 0 ? Math.ceil(width / cycle) + 2 : 0;

  return (
    <View style={[styles.clip, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View style={[{ width: cycles * cycle }, style]}>
          <Svg width={cycles * cycle} height={height}>
            <Path
              d={pulsePath(cycle, height, cycles)}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
});
