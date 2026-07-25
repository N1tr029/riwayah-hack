import Ionicons from '@expo/vector-icons/Ionicons';
import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { PressScale } from '@/components/ui/press-scale';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyDate } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { useBrief } from '@/lib/store';
import {
  STRAVA_CLIENT_ID,
  disconnectStrava,
  exchangeCode,
  getStoredToken,
  shareTcx,
  stravaConfigured,
  uploadToStrava,
} from '@/lib/strava';
import {
  RUN_DURATIONS_MIN,
  RUN_PLANS,
  checkpointsFor,
  planFor,
  runName,
  type RunType,
  type WorkoutSession,
} from '@/lib/workout';

const STRAVA_DISCOVERY = {
  authorizationEndpoint: 'https://www.strava.com/oauth/mobile/authorize',
  tokenEndpoint: 'https://www.strava.com/oauth/token',
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

export default function RunScreen() {
  const theme = useTheme();
  const { ready, workouts, updateWorkout } = useBrief();
  const [type, setType] = useState<RunType>('easy');
  const [minutes, setMinutes] = useState(30);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'brief', path: 'strava' });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: STRAVA_CLIENT_ID,
      scopes: ['activity:write'],
      redirectUri,
    },
    STRAVA_DISCOVERY
  );

  useEffect(() => {
    getStoredToken().then((t) => setStravaConnected(!!t));
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      exchangeCode(response.params.code)
        .then(() => setStravaConnected(true))
        .catch(() => {
          if (Platform.OS !== 'web') Alert.alert('Strava', 'Connection failed — try again.');
        });
    }
  }, [response]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const plan = planFor(type);
  const checks = checkpointsFor(type, minutes).length;
  const recent = [...workouts].reverse().slice(0, 10);

  const upload = async (w: WorkoutSession) => {
    setBusyId(w.id);
    const ok = await uploadToStrava(w);
    setBusyId(null);
    if (ok) {
      updateWorkout(w.id, { uploadedToStrava: true });
    } else if (Platform.OS !== 'web') {
      Alert.alert('Strava', 'Upload failed. Check your connection and try again.');
    }
  };

  const chip = (selected: boolean) => ({
    backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
    borderColor: selected ? theme.accent : 'transparent',
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              Workouts
            </ThemedText>
            <ThemedText type="subtitle">Run</ThemedText>
          </View>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              Plan your run
            </ThemedText>
            <View style={styles.chipRow}>
              {RUN_PLANS.map((p) => (
                <PressScale
                  key={p.type}
                  onPress={() => { tapLight(); setType(p.type); }}
                  style={[styles.chip, chip(type === p.type)]}>
                  <ThemedText type="small" style={{ fontWeight: '700' }}>
                    {p.label}
                  </ThemedText>
                </PressScale>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {plan.description}
            </ThemedText>

            <View style={[styles.chipRow, { marginTop: Spacing.two }]}>
              {RUN_DURATIONS_MIN.map((m) => (
                <PressScale
                  key={m}
                  onPress={() => { tapLight(); setMinutes(m); }}
                  style={[styles.chip, chip(minutes === m)]}>
                  <ThemedText type="small" style={{ fontWeight: '700' }}>
                    {m}m
                  </ThemedText>
                </PressScale>
              ))}
            </View>

            <View style={[styles.planLine, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="heart" size={14} color={theme.heart} />
              <ThemedText type="small" style={{ flex: 1, fontWeight: '600' }}>
                Your phone will buzz for a fingertip heart rate check every {plan.checkEveryMin} min
                — {checks} {checks === 1 ? 'check' : 'checks'} on this run.
              </ThemedText>
            </View>

            <PressScale
              onPress={() => {
                tapLight();
                router.push({ pathname: '/run-session', params: { type, minutes: `${minutes}` } });
              }}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.primaryLabel}>Start Run</ThemedText>
            </PressScale>
          </Card>

          <Card>
            <View style={styles.stravaHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
                Strava
              </ThemedText>
              {stravaConnected && (
                <View style={styles.connectedRow}>
                  <Ionicons name="checkmark-circle" size={15} color={theme.good} />
                  <ThemedText type="small" style={{ color: theme.good, fontWeight: '700' }}>
                    Connected
                  </ThemedText>
                </View>
              )}
            </View>
            {!stravaConfigured() ? (
              <ThemedText type="small" themeColor="textSecondary">
                To enable one-tap sync, create an API app at strava.com/settings/api and put its
                credentials in .env (see .env.example). Until then, every run can still be shared
                as a TCX file with the full heart rate stream.
              </ThemedText>
            ) : stravaConnected ? (
              <PressScale
                onPress={async () => { await disconnectStrava(); setStravaConnected(false); }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Disconnect
                </ThemedText>
              </PressScale>
            ) : (
              <PressScale
                disabled={!request}
                onPress={() => promptAsync()}
                style={[styles.stravaButton, { backgroundColor: '#FC4C02' }]}>
                <ThemedText style={styles.primaryLabel}>Connect Strava</ThemedText>
              </PressScale>
            )}
          </Card>

          {recent.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.caps, styles.sectionTitle]}>
                Recent runs
              </ThemedText>
              {recent.map((w) => (
                <Card key={w.id} style={styles.runRow}>
                  <View style={[styles.runIcon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons name="walk" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.runText}>
                    <ThemedText style={{ fontWeight: '700' }}>{runName(w.type)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {friendlyDate(w.date)} · {formatDuration(w.durationSec)} · avg {w.avgHr} bpm
                    </ThemedText>
                  </View>
                  {w.uploadedToStrava ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.good} />
                  ) : stravaConnected ? (
                    <PressScale
                      onPress={() => upload(w)}
                      accessibilityRole="button"
                      accessibilityLabel="Upload to Strava">
                      <Ionicons
                        name={busyId === w.id ? 'hourglass-outline' : 'cloud-upload-outline'}
                        size={20}
                        color={theme.accent}
                      />
                    </PressScale>
                  ) : (
                    <PressScale
                      onPress={() => shareTcx(w)}
                      accessibilityRole="button"
                      accessibilityLabel="Share TCX file">
                      <Ionicons name="share-outline" size={20} color={theme.accent} />
                    </PressScale>
                  )}
                </Card>
              ))}
            </>
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
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingVertical: Spacing.three,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: Spacing.two,
    marginLeft: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  planLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  stravaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stravaButton: {
    paddingVertical: Spacing.two + 4,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  runIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runText: {
    flex: 1,
    gap: 1,
  },
});
