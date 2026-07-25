import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BriefView } from '@/components/brief-view';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate, todayKey } from '@/lib/format';
import { useBrief } from '@/lib/store';

export default function BriefScreen() {
  const theme = useTheme();
  const { today, records, faceScans } = useBrief();

  if (!today) return <Redirect href="/(tabs)" />;

  const history = records.filter((r) => r.date !== today.date);
  const todayFace = faceScans.find((s) => s.date === today.date);

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
          {todayFace ? (
            <Card style={styles.faceCard}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                Visual check-in
              </ThemedText>
              {todayFace.observations.map((o) => (
                <ThemedText key={o.section} type="small" themeColor={o.section === 'confidence' ? 'textSecondary' : 'text'}>
                  {o.text}
                </ThemedText>
              ))}
            </Card>
          ) : (
            <PressScale
              onPress={() => router.push('/face-scan')}
              style={[styles.faceLink, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="glasses-outline" size={16} color={theme.accent} />
              <ThemedText type="small" style={{ flex: 1, fontWeight: '600' }}>
                Add a 20-second visual check-in
              </ThemedText>
              <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
            </PressScale>
          )}
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
  faceCard: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  faceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
});
