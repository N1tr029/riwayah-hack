import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BriefView } from '@/components/brief-view';
import { ThemedText } from '@/components/themed-text';
import { PressScale } from '@/components/ui/press-scale';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate, todayKey } from '@/lib/format';
import { useBrief } from '@/lib/store';

export default function BriefScreen() {
  const theme = useTheme();
  const { today, records } = useBrief();

  if (!today) return <Redirect href="/(tabs)" />;

  const history = records.filter((r) => r.date !== today.date);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              Today’s Brief
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {friendlyDate(todayKey())}
            </ThemedText>
          </View>
          <PressScale onPress={() => router.dismissTo('/(tabs)')}>
            <ThemedText style={{ color: theme.accent, fontWeight: '600' }}>Done</ThemedText>
          </PressScale>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <BriefView
            record={today}
            history={history}
            onViewDetails={() => router.push('/details')}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  content: {
    padding: Spacing.four,
    paddingTop: 0,
    paddingBottom: Spacing.six,
  },
});
