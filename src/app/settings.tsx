import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Platform, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';

const REMINDER_TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM'];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText>{label}</ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, setSettings, records, resetAll } = useBrief();

  const exportData = async () => {
    try {
      await Share.share({
        title: 'Brief data export',
        message: JSON.stringify(records, null, 2),
      });
    } catch {
      // user cancelled — nothing to do
    }
  };

  const confirmReset = () => {
    if (Platform.OS === 'web') {
      resetAll();
      return;
    }
    Alert.alert('Reset demo data?', 'This replaces your history with fresh sample data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetAll },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText style={{ fontWeight: '600' }}>Settings</ThemedText>
          <PressScale onPress={() => router.back()}>
            <ThemedText style={{ color: theme.accent, fontWeight: '600' }}>Done</ThemedText>
          </PressScale>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.group}>
            <Row label="Morning reminder" hint="Ready for today’s briefing?">
              <Switch
                value={settings.reminderEnabled}
                onValueChange={(v) => setSettings({ reminderEnabled: v })}
                trackColor={{ true: theme.accent }}
              />
            </Row>
            {settings.reminderEnabled && (
              <View style={styles.chipRow}>
                {REMINDER_TIMES.map((t) => {
                  const selected = settings.reminderTime === t;
                  return (
                    <PressScale
                      key={t}
                      onPress={() => { tapLight(); setSettings({ reminderTime: t }); }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                          borderColor: selected ? theme.accent : 'transparent',
                        },
                      ]}>
                      <ThemedText type="small" style={{ fontWeight: '600' }}>
                        {t}
                      </ThemedText>
                    </PressScale>
                  );
                })}
              </View>
            )}
            <Row label="Haptics" hint="Soft pulse feedback during scans">
              <Switch
                value={settings.haptics}
                onValueChange={(v) => setSettings({ haptics: v })}
                trackColor={{ true: theme.accent }}
              />
            </Row>
            <Row label="Advanced metrics" hint="Show raw numbers in your briefing">
              <Switch
                value={settings.showAdvanced}
                onValueChange={(v) => setSettings({ showAdvanced: v })}
                trackColor={{ true: theme.accent }}
              />
            </Row>
          </Card>

          <Card style={styles.group}>
            <Row label="Apple Health" hint="Coming soon — needs a development build">
              <Ionicons name="heart-circle-outline" size={22} color={theme.textSecondary} />
            </Row>
            <PressScale onPress={exportData}>
              <Row label="Export data" hint="Share your history as JSON">
                <Ionicons name="share-outline" size={20} color={theme.accent} />
              </Row>
            </PressScale>
            <PressScale onPress={confirmReset}>
              <Row label="Reset demo data" hint="Start over with fresh sample history">
                <Ionicons name="refresh-outline" size={20} color={theme.clay} />
              </Row>
            </PressScale>
          </Card>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
              Every measurement stays on this device. Nothing is uploaded, ever.
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Brief 0.1 — hackathon build
          </ThemedText>
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
  content: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  group: {
    gap: 0,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  footerText: {
    flexShrink: 1,
    textAlign: 'center',
  },
  version: {
    textAlign: 'center',
  },
});
