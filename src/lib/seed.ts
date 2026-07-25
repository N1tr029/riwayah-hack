/**
 * Three weeks of plausible history so Insights, History, and pattern
 * recognition feel alive from the first launch. Deterministic (seeded PRNG),
 * anchored to real dates ending yesterday. Today is left for the user's scan.
 *
 * The data deliberately encodes real patterns the patterns engine can find:
 * volleyball days recover better than weight days, late bedtimes hurt,
 * Sundays are consistently strongest.
 */

import { composeRecord } from '@/lib/engine';
import { addDays, dateKey } from '@/lib/format';
import { mulberry32, pick, range } from '@/lib/rng';
import type { DayRecord, Mood, Workout } from '@/lib/types';

const JOURNALS = [
  'Long day, but a good one.',
  'Felt sharp in the morning, faded after lunch.',
  'Great session with the team.',
  'Slept badly — too much on my mind.',
  'Quiet day. Needed it.',
  'Presentation prep ran late.',
  'Best game we’ve played in weeks.',
  'Legs felt heavy all day.',
] as const;

const EVENTS = ['Presentation at work', 'Travel day', 'Family dinner', 'Deadline week'] as const;

export function buildSeedHistory(days = 21): DayRecord[] {
  const rng = mulberry32(20260725);
  const records: DayRecord[] = [];
  const start = addDays(new Date(), -days);

  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = dateKey(d);
    const dow = d.getDay(); // 0 = Sunday

    // Weekly rhythm: volleyball Tue/Thu, weights Mon/Fri, long walk Sat.
    let workout: Workout = 'rest';
    if (dow === 2 || dow === 4) workout = 'volleyball';
    else if (dow === 1 || dow === 5) workout = 'weights';
    else if (dow === 6) workout = rng() < 0.6 ? 'walk' : 'run';

    // Bedtime: later on Fri/Sat, occasionally after midnight midweek.
    const lateNight = dow === 5 || dow === 6 ? rng() < 0.55 : rng() < 0.18;
    const bedtimeHour = lateNight
      ? Math.round(range(rng, 24, 25.5) * 2) / 2
      : Math.round(range(rng, 22, 23.5) * 2) / 2;
    const sleepHours =
      Math.round((range(rng, 6.9, 8.3) - (lateNight ? 0.9 : 0) + (dow === 0 ? 0.5 : 0)) * 10) / 10;

    // Physiology: yesterday's workout ripples into this morning.
    const prev = records[records.length - 1];
    const prevWorkout = prev?.workout;
    let hrvShift = range(rng, -5, 6);
    let rhrShift = range(rng, -1.5, 1.8);
    if (prevWorkout === 'weights') {
      hrvShift -= 7; // lifting days leave a mark
      rhrShift += 2;
    } else if (prevWorkout === 'volleyball') {
      hrvShift += 4; // play recovers well
      rhrShift -= 0.7;
    }
    if (dow === 0) hrvShift += 6; // Sundays land soft
    if (lateNight) hrvShift -= 3;

    const hrv = Math.round(62 + hrvShift + (sleepHours - 7.3) * 2.5);
    const rhr = Math.round(58 + rhrShift - (sleepHours - 7.3) * 0.6);
    const hr = Math.round(rhr + range(rng, 4, 9));

    const record = composeRecord(
      key,
      { hr, rhr, hrv, sleepHours, bedtimeHour },
      records,
      rng() < 0.7 ? 'excellent' : 'good',
      Math.floor(rng() * 1e9)
    );

    record.workout = workout;
    if (rng() < 0.85) {
      const moods: Mood[] = record.recovery >= 78 ? ['great', 'good'] : record.recovery >= 60 ? ['good', 'okay'] : ['okay', 'low'];
      record.mood = pick(rng, moods);
    }
    if (rng() < 0.4) record.journal = pick(rng, JOURNALS);
    if (rng() < 0.12) record.event = pick(rng, EVENTS);

    records.push(record);
  }

  return records;
}
