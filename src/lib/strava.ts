/**
 * Strava sync. Needs an API application from https://www.strava.com/settings/api —
 * put its credentials in a `.env` file (see `.env.example`):
 *
 *   EXPO_PUBLIC_STRAVA_CLIENT_ID=12345
 *   EXPO_PUBLIC_STRAVA_CLIENT_SECRET=...
 *
 * Without credentials the Run tab explains how to set this up and falls back
 * to sharing the TCX file, which can be uploaded to Strava manually.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildTcx, runName, type WorkoutSession } from '@/lib/workout';

const TOKEN_KEY = 'brief.strava.v1';

export const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
export const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';

export function stravaConfigured(): boolean {
  return STRAVA_CLIENT_ID.length > 0 && STRAVA_CLIENT_SECRET.length > 0;
}

export interface StravaToken {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds */
  expiresAt: number;
}

export async function getStoredToken(): Promise<StravaToken | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StravaToken) : null;
  } catch {
    return null;
  }
}

export async function storeToken(token: StravaToken): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(token)).catch(() => {});
}

export async function disconnectStrava(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

function parseTokenResponse(json: any): StravaToken {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
  };
}

/** Exchange the OAuth authorization code for tokens. */
export async function exchangeCode(code: string): Promise<StravaToken> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  const token = parseTokenResponse(await res.json());
  await storeToken(token);
  return token;
}

/** Valid access token, refreshing if expired. Null when not connected. */
export async function freshAccessToken(): Promise<string | null> {
  const stored = await getStoredToken();
  if (!stored) return null;
  if (stored.expiresAt * 1000 > Date.now() + 60_000) return stored.accessToken;
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: stored.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const token = parseTokenResponse(await res.json());
    await storeToken(token);
    return token.accessToken;
  } catch {
    return null;
  }
}

function writeTcxFile(session: WorkoutSession): File {
  const file = new File(Paths.cache, `brief-run-${session.id}.tcx`);
  try {
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
  file.create();
  file.write(buildTcx(session));
  return file;
}

/** Upload a run (with heart rate stream) to Strava. */
export async function uploadToStrava(session: WorkoutSession): Promise<boolean> {
  const token = await freshAccessToken();
  if (!token) return false;

  const file = writeTcxFile(session);
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: `${session.id}.tcx`,
    type: 'application/xml',
  } as any);
  form.append('data_type', 'tcx');
  form.append('name', runName(session.type));
  form.append('description', 'Heart rate captured with Brief fingertip scans.');
  form.append('activity_type', 'run');

  const res = await fetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.ok;
}

/** Share the TCX file (AirDrop, Files, email) — works without any Strava setup. */
export async function shareTcx(session: WorkoutSession): Promise<void> {
  const file = writeTcxFile(session);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/xml',
      dialogTitle: 'Share run (TCX with heart rate)',
    });
  }
}
