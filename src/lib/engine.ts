/**
 * The readiness engine.
 *
 * Takes raw physiology (HRV, resting HR, sleep) plus the user's own history
 * and produces one calm, human briefing: a recovery score, soft labels, a
 * natural-language "why", one recommendation, and one mission.
 *
 * Inputs are supplied by Apple Health. Copy is never clinical or judgmental.
 */

import { weekdayName } from '@/lib/format';
import type {
  Confidence,
  DayRecord,
  EnergyLevel,
  SleepLabel,
  StressLevel,
} from '@/lib/types';

export interface Baselines {
  rhr: number;
  hrv: number;
  recovery: number;
}

export interface DayMetrics {
  hr: number | null;
  rhr: number;
  hrv: number;
  sleepHours: number;
  bedtimeHour: number;
}

const DEFAULT_BASELINES: Baselines = { rhr: 58, hrv: 62, recovery: 74 };

export function baselinesFrom(history: DayRecord[]): Baselines {
  const recent = history.slice(-14);
  if (recent.length === 0) return DEFAULT_BASELINES;
  const avg = (f: (r: DayRecord) => number) =>
    recent.reduce((s, r) => s + f(r), 0) / recent.length;
  return {
    rhr: avg((r) => r.rhr),
    hrv: avg((r) => r.hrv),
    recovery: avg((r) => r.recovery),
  };
}

export function recoveryScore(m: DayMetrics, base: Baselines): number {
  const hrvDelta = m.hrv - base.hrv;
  const rhrDelta = m.rhr - base.rhr;
  const sleepAdj = (Math.min(m.sleepHours, 8.5) - 7) * 4;
  const lateAdj = m.bedtimeHour >= 24 ? -4 : 0;
  const raw = 74 + hrvDelta * 1.1 - rhrDelta * 2.2 + sleepAdj + lateAdj;
  return Math.round(Math.min(97, Math.max(28, raw)));
}

export function statusWord(score: number): string {
  if (score >= 82) return 'Ready.';
  if (score >= 68) return 'Steady.';
  if (score >= 55) return 'Ease in.';
  return 'Recover.';
}

export function energyLevel(score: number, sleepHours: number): EnergyLevel {
  if (score >= 78 && sleepHours >= 6.5) return 'High';
  if (score >= 58) return 'Steady';
  return 'Low';
}

export function stressLevel(m: DayMetrics, base: Baselines): StressLevel {
  const rhrDelta = m.rhr - base.rhr;
  const hrvDelta = m.hrv - base.hrv;
  if (rhrDelta > 2.5 || hrvDelta < -9) return 'Elevated';
  if (rhrDelta > 0.8 || hrvDelta < -4) return 'Balanced';
  return 'Low';
}

export function sleepLabel(m: DayMetrics, base: Baselines): SleepLabel {
  if (m.sleepHours >= 7.4 || (m.sleepHours >= 6.6 && m.hrv >= base.hrv)) return 'Recovered';
  if (m.sleepHours >= 6.2) return 'Adequate';
  return 'Light';
}

/** One or two sentences, plain language, always about the user's own baseline. */
export function explain(m: DayMetrics, base: Baselines, yesterday?: DayRecord): string {
  const hrvDelta = m.hrv - base.hrv;
  const rhrDelta = m.rhr - base.rhr;
  const shortSleep = m.sleepHours < 6.5;

  if (hrvDelta >= 3 && rhrDelta <= 0 && shortSleep) {
    return 'You recovered well despite sleeping less, because your heart rate variability stayed strong overnight.';
  }
  if (hrvDelta >= 3 && rhrDelta <= 0.5) {
    return 'You recovered well — your heart settled into a strong overnight rhythm, above your usual baseline.';
  }
  if (rhrDelta > 2.5) {
    return 'Your resting heart rate was a little higher than your recent baseline. Treat that as context, not a diagnosis.';
  }
  if (hrvDelta <= -8) {
    return 'Your body seems to be carrying a bit more tension than your weekly average. Nothing alarming — just worth a gentler pace.';
  }
  if (m.bedtimeHour >= 24 && m.sleepHours < 7) {
    return 'A later night trimmed your recovery slightly. Your body may benefit from an earlier night tonight.';
  }
  if (shortSleep) {
    return 'Sleep ran a little short, and your body is working slightly harder than usual this morning.';
  }
  return 'Everything looks close to your normal — a typical morning for you.';
}

export function recommendation(score: number): string {
  if (score >= 82) return 'If you feel good, your usual training is reasonable today.';
  if (score >= 68) return 'Start normally and adjust the effort based on how you feel.';
  if (score >= 55) return 'Consider starting easy, then decide whether to build the effort.';
  return 'Keep the plan flexible and stop if you feel off.';
}

export function mission(score: number): string {
  if (score >= 78) return 'Check in with how you feel before choosing today’s intensity.';
  if (score >= 58) return 'Give the first ten minutes permission to stay easy.';
  return 'Choose the option that leaves room for recovery today.';
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  excellent: 'Excellent signal',
  good: 'Good signal',
  weak: 'Weak signal',
};

/** Assemble the full day record from metrics + history. */
export function composeRecord(
  date: string,
  m: DayMetrics,
  history: DayRecord[],
  confidence: Confidence
): DayRecord {
  // On day one, treat the current values as the start of the user's own
  // baseline instead of comparing them with a population average.
  const base = history.length
    ? baselinesFrom(history)
    : { rhr: m.rhr, hrv: m.hrv, recovery: 74 };
  const yesterday = history[history.length - 1];
  const score = recoveryScore(m, base);
  return {
    date,
    recovery: score,
    statusWord: statusWord(score),
    energy: energyLevel(score, m.sleepHours),
    stress: stressLevel(m, base),
    sleep: sleepLabel(m, base),
    sleepHours: m.sleepHours,
    bedtimeHour: m.bedtimeHour,
    hr: m.hr,
    rhr: m.rhr,
    hrv: m.hrv,
    confidence,
    explanation: explain(m, base, yesterday),
    recommendation: recommendation(score),
    mission: mission(score),
  };
}

/** Soft comparison line against personal baseline, e.g. for the score ring. */
export function baselineLine(score: number, history: DayRecord[], date: string): string {
  if (history.length < 3) return 'Building your personal baseline.';
  const base = baselinesFrom(history);
  const delta = score - base.recovery;
  if (Math.abs(delta) < 3) return `Similar to your normal ${weekdayName(date)}.`;
  if (delta >= 8) return 'Well above your recent baseline.';
  if (delta > 0) return 'A little above your recent baseline.';
  if (delta <= -8) return 'Below your weekly baseline — be kind to yourself today.';
  return 'A touch below your recent baseline.';
}
