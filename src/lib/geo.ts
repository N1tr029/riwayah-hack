/**
 * GPS tracking for runs. Background updates work in a dev build (UIBackgroundModes
 * location via the expo-location plugin) so music can stay open and the screen can
 * lock; Expo Go falls back to foreground-only tracking.
 *
 * expo-location/expo-task-manager are lazy-loaded so a build that predates the
 * native module (or Expo Go on Android) reports GPS as unavailable instead of
 * inventing distance.
 */

import { Platform } from 'react-native';

export const RUN_LOCATION_TASK = 'brief-run-location';

export interface GeoPoint {
  lat: number;
  lon: number;
  /** epoch ms */
  t: number;
}

// Background task and foreground watcher both append here; the run screen drains it.
const buffer: GeoPoint[] = [];

export function pushPoint(p: GeoPoint): void {
  buffer.push(p);
}

export function drainPoints(): GeoPoint[] {
  return buffer.splice(0, buffer.length);
}

let locationModule: any | null | undefined;
let taskManagerModule: any | null | undefined;

function loc(): any | null {
  if (locationModule === undefined) {
    try {
      locationModule = require('expo-location');
    } catch {
      locationModule = null;
    }
  }
  return locationModule;
}

function tasks(): any | null {
  if (taskManagerModule === undefined) {
    try {
      taskManagerModule = require('expo-task-manager');
    } catch {
      taskManagerModule = null;
    }
  }
  return taskManagerModule;
}

let taskDefined = false;
function ensureTaskDefined(): boolean {
  if (taskDefined) return true;
  const tm = tasks();
  if (!tm) return false;
  try {
    tm.defineTask(RUN_LOCATION_TASK, async ({ data, error }: any) => {
      if (error || !data) return;
      for (const l of data.locations ?? []) {
        pushPoint({ lat: l.coords.latitude, lon: l.coords.longitude, t: l.timestamp });
      }
    });
    taskDefined = true;
    return true;
  } catch {
    // fast refresh may have defined it already
    taskDefined = true;
    return true;
  }
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type TrackingMode = 'background' | 'foreground' | 'unavailable';

/** Start GPS tracking, preferring background updates. Never throws. */
export async function startRunTracking(): Promise<{
  mode: TrackingMode;
  stop: () => void;
}> {
  const Location = Platform.OS === 'web' ? null : loc();
  if (!Location) return { mode: 'unavailable', stop: () => {} };

  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { mode: 'unavailable', stop: () => {} };

    // Background needs a dev build + "Always" permission; fall through on any failure.
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted' && ensureTaskDefined()) {
        await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          activityType: Location.ActivityType.Fitness,
          distanceInterval: 5,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
        });
        return {
          mode: 'background',
          stop: () => {
            Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)
              .then((on: boolean) =>
                on ? Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK) : undefined
              )
              .catch(() => {});
          },
        };
      }
    } catch {
      // fall through to foreground
    }

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      (l: any) => pushPoint({ lat: l.coords.latitude, lon: l.coords.longitude, t: l.timestamp })
    );
    return { mode: 'foreground', stop: () => sub.remove() };
  } catch {
    return { mode: 'unavailable', stop: () => {} };
  }
}

export const METERS_PER_MILE = 1609.344;

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

/** "7:58" min/mile pace, or "-:--" when too little data. */
export function formatPace(distanceMeters: number, elapsedSec: number): string {
  const miles = metersToMiles(distanceMeters);
  if (miles < 0.02 || elapsedSec < 20) return '-:--';
  const secPerMile = elapsedSec / miles;
  if (!isFinite(secPerMile) || secPerMile > 30 * 60) return '-:--';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

export function formatMiles(distanceMeters: number): string {
  return metersToMiles(distanceMeters).toFixed(2);
}
