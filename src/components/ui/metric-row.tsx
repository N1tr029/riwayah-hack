import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Dot color hinting at state; stays muted, never alarming. */
  tint?: string;
}

export function MetricRow({ icon, label, value, tint }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name={icon} size={17} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary">{label}</ThemedText>
      </View>
      <View style={styles.right}>
        {tint && <View style={[styles.dot, { backgroundColor: tint }]} />}
        <ThemedText style={styles.value}>{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two + 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  value: {
    fontWeight: '600',
  },
});
