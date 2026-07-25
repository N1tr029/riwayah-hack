import { findPatterns, streakLength } from '@/lib/patterns';
import type { DayRecord, Workout } from '@/lib/types';

function day(date: string, recovery: number, extras: Partial<DayRecord> = {}): DayRecord {
  return {
    date,
    recovery,
    statusWord: 'Steady.',
    energy: 'Steady',
    stress: 'Low',
    sleep: 'Adequate',
    sleepHours: 7.2,
    bedtimeHour: 22.5,
    hr: 72,
    rhr: 58,
    hrv: 62,
    confidence: 'good',
    explanation: '',
    recommendation: '',
    mission: '',
    ...extras,
  };
}

function pad(n: number): string {
  return `${n}`.padStart(2, '0');
}

describe('findPatterns', () => {
  it('spots that volleyball recovers better than weights', () => {
    const records: DayRecord[] = [];
    const schedule: (Workout | undefined)[] = [
      'volleyball', undefined, 'weights', undefined,
      'volleyball', undefined, 'weights', undefined,
      'volleyball', undefined, 'weights', undefined, undefined, undefined,
    ];
    schedule.forEach((w, i) => {
      const prev = schedule[i - 1];
      const recovery = prev === 'volleyball' ? 86 : prev === 'weights' ? 66 : 75;
      records.push(day(`2026-07-${pad(i + 1)}`, recovery, { workout: w }));
    });

    const workout = findPatterns(records).find((p) => p.id === 'workout');
    expect(workout).toBeDefined();
    expect(workout!.detail).toMatch(/volleyball/);
    expect(workout!.detail).toMatch(/weightlifting/);
  });

  it('ignores walks in the workout comparison', () => {
    const records: DayRecord[] = [];
    for (let i = 1; i <= 14; i++) {
      records.push(
        day(`2026-07-${pad(i)}`, 90, { workout: i % 2 === 0 ? 'walk' : undefined })
      );
    }
    expect(findPatterns(records).find((p) => p.id === 'workout')).toBeUndefined();
  });

  it('flags after-midnight sleep costing recovery', () => {
    const records: DayRecord[] = [];
    for (let i = 1; i <= 14; i++) {
      const late = i % 2 === 0;
      records.push(day(`2026-07-${pad(i)}`, late ? 62 : 82, { bedtimeHour: late ? 24.5 : 22.5 }));
    }
    const bedtime = findPatterns(records).find((p) => p.id === 'bedtime');
    expect(bedtime).toBeDefined();
    expect(bedtime!.detail).toMatch(/midnight/);
  });

  it('stays quiet without enough history', () => {
    expect(findPatterns([day('2026-07-01', 80)])).toHaveLength(0);
  });
});

describe('streakLength', () => {
  it('counts consecutive days', () => {
    const records = [1, 2, 3, 4, 5].map((i) => day(`2026-07-${pad(i)}`, 80));
    expect(streakLength(records)).toBe(5);
  });

  it('resets at a gap', () => {
    const records = [day('2026-07-01', 80), day('2026-07-05', 80), day('2026-07-06', 80)];
    expect(streakLength(records)).toBe(2);
  });

  it('handles empty history', () => {
    expect(streakLength([])).toBe(0);
  });
});
