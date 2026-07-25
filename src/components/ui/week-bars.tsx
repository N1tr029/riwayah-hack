import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

interface Bar {
  label: string;
  value: number;
  emphasized?: boolean;
}

interface Props {
  bars: Bar[];
  height?: number;
}

/** Bar with a 4px rounded top, anchored flat to the baseline. */
function roundedTopBar(x: number, yTop: number, w: number, yBase: number, r: number): string {
  const rr = Math.min(r, w / 2, Math.max(yBase - yTop, 0));
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTop + rr}`,
    `Q ${x} ${yTop} ${x + rr} ${yTop}`,
    `L ${x + w - rr} ${yTop}`,
    `Q ${x + w} ${yTop} ${x + w} ${yTop + rr}`,
    `L ${x + w} ${yBase}`,
    'Z',
  ].join(' ');
}

/**
 * Weekly readiness bars. Single series (one hue); the emphasized bar (today /
 * best day) is fully saturated and direct-labeled, the rest sit quieter.
 */
export function WeekBars({ bars, height = 130 }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const labelBand = 20;
  const valueBand = 18;
  const plotH = height - labelBand - valueBand;
  const yBase = valueBand + plotH;

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((b, i) => {
            const slot = width / bars.length;
            const barW = Math.min(26, slot - 8);
            const x = i * slot + (slot - barW) / 2;
            const h = Math.max((b.value / 100) * plotH, 3);
            const yTop = yBase - h;
            return (
              <Path
                key={b.label + i}
                d={roundedTopBar(x, yTop, barW, yBase, 4)}
                fill={b.emphasized ? theme.accent : theme.track}
              />
            );
          })}
          {bars.map((b, i) => {
            const slot = width / bars.length;
            const cx = i * slot + slot / 2;
            return (
              <SvgText
                key={`label-${b.label}-${i}`}
                x={cx}
                y={height - 5}
                fontSize={11}
                fill={theme.textSecondary}
                textAnchor="middle">
                {b.label}
              </SvgText>
            );
          })}
          {bars.map((b, i) => {
            if (!b.emphasized) return null;
            const slot = width / bars.length;
            const cx = i * slot + slot / 2;
            const h = Math.max((b.value / 100) * plotH, 3);
            return (
              <SvgText
                key={`value-${b.label}-${i}`}
                x={cx}
                y={yBase - h - 6}
                fontSize={12}
                fontWeight="600"
                fill={theme.text}
                textAnchor="middle">
                {Math.round(b.value)}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
