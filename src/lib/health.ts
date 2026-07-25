/**
 * Health sync: writes scan results to Apple Health (HealthKit) on iOS and
 * Google Health Connect on Android.
 *
 * Both require native modules, so this whole file degrades gracefully:
 * in Expo Go / web the lazy require() throws, healthSupported() returns
 * false, and the Settings toggle explains that a development build is needed
 * (`npx expo run:ios` / `npx expo run:android`).
 */

import { Platform } from 'react-native';

import { parseKey } from '@/lib/format';
import type { DayRecord } from '@/lib/types';

let hkModule: unknown | null | undefined;
let hcModule: unknown | null | undefined;

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
        toShare: ['HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierRestingHeartRate'],
      });
      return true;
    }
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc) return false;
      const initialized = await hc.initialize();
      if (!initialized) return false;
      const granted = await hc.requestPermission([
        { accessType: 'write', recordType: 'HeartRateRecord' },
        { accessType: 'write', recordType: 'RestingHeartRateRecord' },
        { accessType: 'write', recordType: 'HeartRateVariabilityRmssdRecord' },
      ]);
      return Array.isArray(granted) && granted.length > 0;
    }
  } catch {
    // fall through
  }
  return false;
}

/**
 * Write one scan's heart data. The scan heart rate is stamped at scan time;
 * overnight resting HR (and HRV on Android) are stamped at 7:00 that morning.
 * Note: HealthKit's HRV type is SDNN and ours is RMSSD — different metrics,
 * so HRV is deliberately only written to Health Connect (which has RMSSD).
 */
export async function exportRecordToHealth(record: DayRecord): Promise<boolean> {
  try {
    const now = new Date();
    const morning = parseKey(record.date);
    morning.setHours(7, 0, 0, 0);

    if (Platform.OS === 'ios') {
      const hk = healthKit();
      if (!hk) return false;
      await hk.saveQuantitySample('HKQuantityTypeIdentifierHeartRate', 'count/min', record.hr, {
        startDate: now,
        endDate: now,
      });
      await hk.saveQuantitySample(
        'HKQuantityTypeIdentifierRestingHeartRate',
        'count/min',
        record.rhr,
        { startDate: morning, endDate: morning }
      );
      return true;
    }

    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc) return false;
      await hc.initialize();
      await hc.insertRecords([
        {
          recordType: 'HeartRateRecord',
          startTime: now.toISOString(),
          endTime: new Date(now.getTime() + 1000).toISOString(),
          samples: [{ time: now.toISOString(), beatsPerMinute: record.hr }],
        },
        {
          recordType: 'RestingHeartRateRecord',
          time: morning.toISOString(),
          beatsPerMinute: record.rhr,
        },
        {
          recordType: 'HeartRateVariabilityRmssdRecord',
          time: morning.toISOString(),
          heartRateVariabilityMillis: record.hrv,
        },
      ]);
      return true;
    }
  } catch {
    // Health write failures must never break the briefing flow.
  }
  return false;
}
