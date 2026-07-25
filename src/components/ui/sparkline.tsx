import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useMeasuredWidth } from '@/hooks/use-measured-width';

interface Props {
  values: number[];
  height?: number;
  color: string;
  /** Optional soft fill under the line. */
  fill?: string;
}

/** Single-series trend line: 2px stroke, dot on the latest point, no chrome. */
export function Sparkline({ values, height = 56, color, fill }: Props) {
  const { ref, width, onLayout } = useMeasuredWidth();

  if (values.length < 2) return <View style={{ height }} />;

  const pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(values.length - 1).toFixed(1)} ${height} L ${x(0).toFixed(1)} ${height} Z`;

  return (
    <View ref={ref} style={{ height }} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {fill && <Path d={area} fill={fill} />}
          <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
          <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3.5} fill={color} />
        </Svg>
      )}
    </View>
  );
}
