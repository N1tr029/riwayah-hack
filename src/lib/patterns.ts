/**
 * Pattern recognition: turns stored history into plain-language observations.
 * Real computation over the user's own records — no population averages.
 */

import { parseKey, weekdayName } from '@/lib/format';
import type { DayRecord, PatternObservation, Workout } from '@/lib/types';

const WORKOUT_NAMES: Record<Workout, string> = {
  volleyball: 'volleyball',
  weights: 'weightlifting',
  run: 'running',
  walk: 'walking',
  rest: 'rest',
};

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Recovery the morning AFTER each kind of training session (walks excluded —
 * they ride along with rest days and would skew the comparison). */
function nextDayRecoveryByWorkout(records: DayRecord[]): Map<Workout, number[]> {
  const out = new Map<Workout, number[]>();
  for (let i = 0; i < records.length - 1; i++) {
    const w = records[i].workout;
    if (!w || w === 'rest' || w === 'walk') continue;
    const list = out.get(w) ?? [];
    list.push(records[i + 1].recovery);
    out.set(w, list);
  }
  return out;
}

export function findPatterns(records: DayRecord[]): PatternObservation[] {
  const found: PatternObservation[] = [];
  if (records.length < 7) return found;

  // Workout comparison: needs 2+ samples of two different workouts.
  const byWorkout = nextDayRecoveryByWorkout(records);
  const pairs = [...byWorkout.entries()].filter(([, v]) => v.length >= 2);
  if (pairs.length >= 2) {
    pairs.sort((a, b) => avg(b[1]) - avg(a[1]));
    const [bestW, bestVals] = pairs[0];
    const [worstW, worstVals] = pairs[pairs.length - 1];
    if (avg(bestVals) - avg(worstVals) >= 5) {
      found.push({
        id: 'workout',
        icon: 'tennisball-outline',
        title: `${WORKOUT_NAMES[bestW]} suits you`,
        detail: `You consistently recover better after ${WORKOUT_NAMES[bestW]} than ${WORKOUT_NAMES[worstW]} — about ${Math.round(avg(bestVals) - avg(worstVals))} points higher the next morning.`,
      });
    }
  }

  // Late bedtimes.
  const late = records.filter((r) => r.bedtimeHour >= 24).map((r) => r.recovery);
  const early = records.filter((r) => r.bedtimeHour < 24).map((r) => r.recovery);
  if (late.length >= 3 && early.length >= 3 && avg(early) - avg(late) >= 4) {
    found.push({
      id: 'bedtime',
      icon: 'moon-outline',
      title: 'Midnight matters',
      detail: `Your recovery drops when you sleep after midnight — roughly ${Math.round(avg(early) - avg(late))} points below your earlier nights.`,
    });
  }

  // Strongest weekday.
  const byDow = new Map<number, number[]>();
  for (const r of records) {
    const dow = parseKey(r.date).getDay();
    const list = byDow.get(dow) ?? [];
    list.push(r.recovery);
    byDow.set(dow, list);
  }
  const dowAvgs = [...byDow.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([dow, v]) => ({ dow, mean: avg(v) }))
    .sort((a, b) => b.mean - a.mean);
  if (dowAvgs.length >= 4 && dowAvgs[0].mean - avg(records.map((r) => r.recovery)) >= 4) {
    const name = weekdayName(records.find((r) => parseKey(r.date).getDay() === dowAvgs[0].dow)!.date);
    found.push({
      id: 'weekday',
      icon: 'sunny-outline',
      title: `${name}s are your strongest`,
      detail: `${name} is consistently your highest recovery day of the week.`,
    });
  }

  // Trend: last 7 vs the 7 before.
  if (records.length >= 14) {
    const last7 = avg(records.slice(-7).map((r) => r.recovery));
    const prior7 = avg(records.slice(-14, -7).map((r) => r.recovery));
    if (last7 - prior7 >= 3) {
      found.push({
        id: 'trend',
        icon: 'trending-up-outline',
        title: 'Recovery is improving',
        detail: `Your average readiness is up ${Math.round(last7 - prior7)} points over the past week.`,
      });
    } else if (prior7 - last7 >= 4) {
      found.push({
        id: 'trend',
        icon: 'leaf-outline',
        title: 'A softer week',
        detail: 'Readiness has dipped a little this week — a couple of earlier nights would go a long way.',
      });
    }
  }

  return found.slice(0, 4);
}

/** Consecutive days ending at the last record. */
export function streakLength(records: DayRecord[]): number {
  if (records.length === 0) return 0;
  let streak = 1;
  for (let i = records.length - 1; i > 0; i--) {
    const gap = (parseKey(records[i].date).getTime() - parseKey(records[i - 1].date).getTime()) / 86_400_000;
    if (Math.round(gap) === 1) streak++;
    else break;
  }
  return streak;
}
