/**
 * Health data access.
 *
 * Brief reads real samples when the native health module is present. Queries
 * deliberately return null when data is missing or permission is denied; no
 * metric in this file is estimated.
 */

import { Platform } from 'react-native';

import type { DayRecord } from '@/lib/types';

let hkModule: unknown | null | undefined;
let hcModule: unknown | null | undefined;

const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';
const RESTING_HEART_RATE = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';

function healthKit(): any | null {
  if (hkModule === undefined) {
    try {
      hkModule = require('@kingstinct/react-native-healthkit');
    } catch {
      hkModule = null;
    }
  }
  return hkModule as any;
}

function healthConnect(): any | null {
  if (hcModule === undefined) {
    try {
      hcModule = require('react-native-health-connect');
    } catch {
      hcModule = null;
    }
  }
  return hcModule as any;
}

export interface HealthSnapshot {
  heartRate: number | null;
  heartRateAt: string | null;
  restingHeartRate: number | null;
  hrv: number | null;
  sleepHours: number | null;
  bedtimeHour: number | null;
  missing: string[];
}

export interface HeartRateSample {
  bpm: number;
  at: string;
  id: string;
}

interface Interval {
  start: number;
  end: number;
}

export function healthPlatformName(): string {
  return Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
}

/** True when the native health module is actually present (dev build). */
export function healthSupported(): boolean {
  if (Platform.OS === 'ios') return healthKit() != null;
  if (Platform.OS === 'android') return healthConnect() != null;
  return false;
}

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const hk = healthKit();
      if (!hk) return false;
      await hk.requestAuthorization({
        toRead: [HEART_RATE, RESTING_HEART_RATE, HRV, SLEEP],
      });
      return true;
    }
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc) return false;
      const initialized = await hc.initialize();
      if (!initialized) return false;
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'HeartRateRecord' },
        { accessType: 'read', recordType: 'RestingHeartRateRecord' },
        { accessType: 'read', recordType: 'HeartRateVariabilityRmssdRecord' },
        { accessType: 'read', recordType: 'SleepSessionRecord' },
      ]);
      return Array.isArray(granted) && granted.length > 0;
    }
  } catch {
    // Permission failures become an honest unavailable state in the UI.
  }
  return false;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

async function latestQuantity(
  identifier: string,
  unit: string,
  startDate: Date,
  endDate = new Date()
): Promise<any | null> {
  const hk = healthKit();
  if (!hk) return null;
  const samples = await hk.queryQuantitySamples(identifier, {
    limit: 1,
    ascending: false,
    unit,
    filter: { date: { startDate, endDate } },
  });
  return samples[0] ?? null;
}

/**
 * Fetch the newest real HealthKit heart-rate sample in the requested window.
 * This does not synthesize a value when Apple Watch/Health has not published one.
 */
export async function readLatestHeartRate(after = new Date(Date.now() - 5 * 60_000)): Promise<HeartRateSample | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const sample = await latestQuantity(HEART_RATE, 'count/min', after);
    if (!sample || !Number.isFinite(sample.quantity)) return null;
    return {
      bpm: Math.round(sample.quantity),
      at: toDate(sample.startDate).toISOString(),
      id: String(sample.uuid ?? `${sample.startDate}-${sample.quantity}`),
    };
  } catch {
    return null;
  }
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }
  return merged;
}

async function readSleep(): Promise<{ hours: number; bedtimeHour: number } | null> {
  const hk = healthKit();
  if (!hk) return null;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 36 * 60 * 60_000);
  const samples = await hk.queryCategorySamples(SLEEP, {
    limit: 0,
    ascending: true,
    filter: { date: { startDate, endDate } },
  });

  // HealthKit values 1, 3, 4, and 5 are asleep states. Value 0 is
  // "in bed" and value 2 is awake, neither counts as sleep.
  const asleep = samples
    .filter((sample: any) => [1, 3, 4, 5].includes(Number(sample.value)))
    .map((sample: any) => ({
      start: toDate(sample.startDate).getTime(),
      end: toDate(sample.endDate).getTime(),
    }))
    .filter((interval: Interval) => interval.end > interval.start);
  if (!asleep.length) return null;

  const latestEnd = Math.max(...asleep.map((interval: Interval) => interval.end));
  const episodeStart = latestEnd - 18 * 60 * 60_000;
  const merged = mergeIntervals(asleep.filter((interval: Interval) => interval.end >= episodeStart));
  if (!merged.length) return null;

  const totalMs = merged.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  const bedtime = new Date(merged[0].start);
  let bedtimeHour = bedtime.getHours() + bedtime.getMinutes() / 60;
  if (bedtimeHour < 12) bedtimeHour += 24;
  return {
    hours: Math.round((totalMs / 3_600_000) * 10) / 10,
    bedtimeHour,
  };
}

/** Read the current briefing inputs directly from Apple Health. */
export async function readHealthSnapshot(): Promise<HealthSnapshot> {
  const empty: HealthSnapshot = {
    heartRate: null,
    heartRateAt: null,
    restingHeartRate: null,
    hrv: null,
    sleepHours: null,
    bedtimeHour: null,
    missing: ['sleep', 'resting heart rate', 'HRV'],
  };
  if (Platform.OS !== 'ios' || !healthKit()) return empty;

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60_000);
    const recentHeartRate = new Date(now.getTime() - 30 * 60_000);
    const [heart, resting, variability, sleep] = await Promise.all([
      latestQuantity(HEART_RATE, 'count/min', recentHeartRate),
      latestQuantity(RESTING_HEART_RATE, 'count/min', threeDaysAgo),
      latestQuantity(HRV, 'ms', threeDaysAgo),
      readSleep(),
    ]);

    const snapshot: HealthSnapshot = {
      heartRate: heart && Number.isFinite(heart.quantity) ? Math.round(heart.quantity) : null,
      heartRateAt: heart ? toDate(heart.startDate).toISOString() : null,
      restingHeartRate:
        resting && Number.isFinite(resting.quantity) ? Math.round(resting.quantity) : null,
      hrv: variability && Number.isFinite(variability.quantity)
        ? Math.round(variability.quantity)
        : null,
      sleepHours: sleep?.hours ?? null,
      bedtimeHour: sleep?.bedtimeHour ?? null,
      missing: [],
    };
    if (snapshot.sleepHours == null) snapshot.missing.push('sleep');
    if (snapshot.restingHeartRate == null) snapshot.missing.push('resting heart rate');
    if (snapshot.hrv == null) snapshot.missing.push('HRV');
    return snapshot;
  } catch {
    return empty;
  }
}

/**
 * Brief no longer writes imported measurements back into HealthKit. Kept as a
 * compatibility shim for older callers while the app transitions to read-only.
 */
export async function exportRecordToHealth(_record: DayRecord): Promise<boolean> {
  return false;
}
