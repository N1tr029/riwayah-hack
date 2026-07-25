/**
 * The readiness engine.
 *
 * Takes raw physiology (HRV, resting HR, sleep) plus the user's own history
 * and produces one calm, human briefing: a recovery score, soft labels, a
 * natural-language "why", one recommendation, and one mission.
 *
 * Everything is compared against the user's personal baseline — never a
 * population average. Copy is never clinical, never judgmental.
 *
 * NOTE: metrics currently come from a plausible generator seeded by the scan
 * (see makeScanMetrics). Swap `makeScanMetrics` for a real camera-PPG pipeline
 * (e.g. react-native-vision-camera frame processor) without touching the copy.
 */

import { weekdayName } from '@/lib/format';
import { mulberry32, pick, range } from '@/lib/rng';
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
  hr: number;
  rhr: number;
  hrv: number;
  sleepHours: number;
  bedtimeHour: number;
}

export interface RecoveryFactor {
  label: string;
  points: number;
  comparison: string;
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

/** The same four adjustments used by recoveryScore, rounded for plain-language display. */
export function recoveryFactors(m: DayMetrics, base: Baselines): RecoveryFactor[] {
  const hrvDelta = m.hrv - base.hrv;
  const rhrDelta = m.rhr - base.rhr;
  const sleepPoints = (Math.min(m.sleepHours, 8.5) - 7) * 4;

  return [
    {
      label: 'HRV',
      points: Math.round(hrvDelta * 1.1),
      comparison: `${Math.abs(Math.round(hrvDelta))} ms ${hrvDelta >= 0 ? 'above' : 'below'} baseline`,
    },
    {
      label: 'Resting HR',
      points: Math.round(-rhrDelta * 2.2),
      comparison: `${Math.abs(Math.round(rhrDelta))} bpm ${rhrDelta <= 0 ? 'below' : 'above'} baseline`,
    },
    {
      label: 'Sleep',
      points: Math.round(sleepPoints),
      comparison: `${m.sleepHours.toFixed(1)} hours`,
    },
    {
      label: 'Bedtime',
      points: m.bedtimeHour >= 24 ? -4 : 0,
      comparison: m.bedtimeHour >= 24 ? 'after midnight' : 'before midnight',
    },
  ];
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
    const tail = yesterday?.workout && yesterday.workout !== 'rest'
      ? ' Yesterday’s workout may still be settling.'
      : '';
    return `Recovery is a little lower than usual because your resting heart rate stayed slightly elevated overnight.${tail}`;
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
  if (yesterday && yesterday.workout && yesterday.workout !== 'rest' && hrvDelta >= 0) {
    return `Yesterday’s ${yesterday.workout === 'weights' ? 'weightlifting' : yesterday.workout} didn’t dent your recovery — your overnight rhythm held steady.`;
  }
  return 'Everything looks close to your normal — a typical morning for you.';
}

export function recommendation(score: number): string {
  if (score >= 82) return 'Today is a great day for intense work or exercise.';
  if (score >= 68) return 'A solid day — normal training and focused work will land well.';
  if (score >= 55) return 'Keep things moderate today. Light movement will serve you better than max effort.';
  return 'Take it easy today. Your body is asking for a lighter day.';
}

const MISSIONS_HIGH = [
  'Today’s a good day for a hard workout.',
  'Schedule your deep work for this morning.',
  'Push something you’ve been putting off — you have the capacity today.',
] as const;

const MISSIONS_MID = [
  'Take a walk this afternoon.',
  'Prioritize hydration today.',
  'A steady session beats a heroic one today.',
] as const;

const MISSIONS_LOW = [
  'Go to bed earlier tonight.',
  'Skip your second coffee.',
  'Protect your energy today — keep the schedule light.',
] as const;

export function mission(score: number, rng: () => number): string {
  if (score >= 78) return pick(rng, MISSIONS_HIGH);
  if (score >= 58) return pick(rng, MISSIONS_MID);
  return pick(rng, MISSIONS_LOW);
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  excellent: 'Excellent signal',
  good: 'Good signal',
  weak: 'Weak signal',
};

/**
 * Generate this morning's raw metrics.
 * Anchored to the user's recent history with a gentle random walk, so numbers
 * are always plausible relative to their baseline. This is the seam where a
 * real PPG measurement plugs in.
 */
export function makeScanMetrics(history: DayRecord[], seed: number): DayMetrics {
  const rng = mulberry32(seed);
  const base = baselinesFrom(history);
  const last = history[history.length - 1];
  const anchorHrv = last ? (last.hrv + base.hrv) / 2 : base.hrv;
  const anchorRhr = last ? (last.rhr + base.rhr) / 2 : base.rhr;
  const sleepHours = Math.round(range(rng, 6.1, 8.4) * 10) / 10;
  const bedtimeHour = rng() < 0.25 ? Math.round(range(rng, 24, 25.5) * 2) / 2 : Math.round(range(rng, 22, 23.5) * 2) / 2;
  const hrv = Math.round(anchorHrv + range(rng, -9, 10) + (sleepHours - 7) * 2);
  const rhr = Math.round(anchorRhr + range(rng, -2.5, 3) - (sleepHours - 7) * 0.8);
  // Awake sitting HR runs well above overnight resting — a daytime scan
  // should read in the 70s for someone whose RHR is high-50s.
  const hr = Math.round(rhr + range(rng, 12, 22));
  return { hr, rhr, hrv, sleepHours, bedtimeHour };
}

/** Assemble the full day record from metrics + history. */
export function composeRecord(
  date: string,
  m: DayMetrics,
  history: DayRecord[],
  confidence: Confidence,
  seed: number
): DayRecord {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const base = baselinesFrom(history);
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
    mission: mission(score, rng),
  };
}

/** Soft comparison line against personal baseline, e.g. for the score ring. */
export function baselineLine(score: number, history: DayRecord[], date: string): string {
  const base = baselinesFrom(history);
  const delta = score - base.recovery;
  if (Math.abs(delta) < 3) return `Similar to your normal ${weekdayName(date)}.`;
  if (delta >= 8) return 'Well above your recent baseline.';
  if (delta > 0) return 'A little above your recent baseline.';
  if (delta <= -8) return 'Below your weekly baseline — be kind to yourself today.';
  return 'A touch below your recent baseline.';
}
