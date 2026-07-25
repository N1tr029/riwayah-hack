/**
 * Guided runs: the intended run type sets how often Brief asks for a
 * finger-on-camera heart rate check, and each captured sample becomes a
 * trackpoint in the TCX file that ports the run (with heart rate) to Strava.
 */

import { mulberry32, range } from '@/lib/rng';

export type RunType = 'easy' | 'tempo' | 'long';

export interface RunPlanInfo {
  type: RunType;
  label: string;
  description: string;
  /** Minutes between finger-on-camera heart rate checks. */
  checkEveryMin: number;
}

export const RUN_PLANS: RunPlanInfo[] = [
  {
    type: 'easy',
    label: 'Easy',
    description: 'Conversational pace. Checks every 10 minutes.',
    checkEveryMin: 10,
  },
  {
    type: 'tempo',
    label: 'Tempo',
    description: 'Comfortably hard. Checks every 5 minutes.',
    checkEveryMin: 5,
  },
  {
    type: 'long',
    label: 'Long',
    description: 'Steady endurance. Checks every 15 minutes.',
    checkEveryMin: 15,
  },
];

export const RUN_DURATIONS_MIN = [20, 30, 45, 60, 90];

export function planFor(type: RunType): RunPlanInfo {
  return RUN_PLANS.find((p) => p.type === type) ?? RUN_PLANS[0];
}

/** Checkpoint times in seconds for a planned run. */
export function checkpointsFor(type: RunType, plannedMin: number): number[] {
  const every = planFor(type).checkEveryMin * 60;
  const out: number[] = [];
  for (let t = every; t < plannedMin * 60; t += every) out.push(t);
  return out;
}

export interface WorkoutSample {
  /** Seconds since the run started. */
  atSec: number;
  hr: number;
  /** False when the runner skipped/missed the check and the value is estimated. */
  captured: boolean;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  /** Seconds since the run started. */
  atSec: number;
}

export interface WorkoutSession {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: RunType;
  plannedMin: number;
  /** ISO timestamp */
  startedAt: string;
  durationSec: number;
  samples: WorkoutSample[];
  avgHr: number;
  maxHr: number;
  distanceMeters: number;
  /** Decimated GPS trace; empty when GPS was unavailable/simulated. */
  route: RoutePoint[];
  uploadedToStrava?: boolean;
}

/**
 * Plausible running heart rate for a checkpoint. Base by intent, cardiac
 * drift over time, deterministic noise. The seam for real PPG, same as the
 * morning scan.
 */
export function runHeartRate(type: RunType, elapsedSec: number, seed: number): number {
  const base = type === 'tempo' ? 158 : type === 'long' ? 146 : 138;
  const drift = Math.min((elapsedSec / 60) * 0.35, 14);
  const rng = mulberry32((seed ^ Math.floor(elapsedSec / 30)) | 0);
  return Math.round(Math.min(186, Math.max(104, base + drift + range(rng, -6, 6))));
}

export function summarize(samples: WorkoutSample[]): { avgHr: number; maxHr: number } {
  if (samples.length === 0) return { avgHr: 0, maxHr: 0 };
  const hrs = samples.map((s) => s.hr);
  return {
    avgHr: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
    maxHr: Math.max(...hrs),
  };
}

const RUN_NAMES: Record<RunType, string> = {
  easy: 'Easy run',
  tempo: 'Tempo run',
  long: 'Long run',
};

export function runName(type: RunType): string {
  return RUN_NAMES[type];
}

function xmlTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Nearest heart rate sample to a moment in the run. */
function hrAt(samples: WorkoutSample[], atSec: number): number | null {
  if (samples.length === 0) return null;
  let best = samples[0];
  for (const s of samples) {
    if (Math.abs(s.atSec - atSec) < Math.abs(best.atSec - atSec)) best = s;
  }
  return best.hr;
}

/**
 * TCX for Strava. With GPS, trackpoints carry position + heart rate;
 * without, it's an HR-only stream (treadmill-style import).
 */
export function buildTcx(session: WorkoutSession): string {
  const start = new Date(session.startedAt);

  const trackpoint = (atSec: number, pos?: { lat: number; lon: number }): string => {
    const t = new Date(start.getTime() + atSec * 1000);
    const hr = hrAt(session.samples, atSec);
    return [
      '        <Trackpoint>',
      `          <Time>${xmlTime(t)}</Time>`,
      ...(pos
        ? [
            '          <Position>',
            `            <LatitudeDegrees>${pos.lat.toFixed(6)}</LatitudeDegrees>`,
            `            <LongitudeDegrees>${pos.lon.toFixed(6)}</LongitudeDegrees>`,
            '          </Position>',
          ]
        : []),
      ...(hr !== null ? [`          <HeartRateBpm><Value>${hr}</Value></HeartRateBpm>`] : []),
      '        </Trackpoint>',
    ].join('\n');
  };

  const route = session.route ?? [];
  const points = (
    route.length >= 2
      ? route.map((p) => trackpoint(p.atSec, p))
      : session.samples.map((s) => trackpoint(s.atSec))
  ).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">',
    '  <Activities>',
    '    <Activity Sport="Running">',
    `      <Id>${xmlTime(start)}</Id>`,
    `      <Lap StartTime="${xmlTime(start)}">`,
    `        <TotalTimeSeconds>${session.durationSec}</TotalTimeSeconds>`,
    `        <DistanceMeters>${Math.round(session.distanceMeters ?? 0)}</DistanceMeters>`,
    `        <AverageHeartRateBpm><Value>${session.avgHr}</Value></AverageHeartRateBpm>`,
    `        <MaximumHeartRateBpm><Value>${session.maxHr}</Value></MaximumHeartRateBpm>`,
    '        <Intensity>Active</Intensity>',
    '        <TriggerMethod>Manual</TriggerMethod>',
    '        <Track>',
    points,
    '        </Track>',
    '      </Lap>',
    `      <Notes>${runName(session.type)} briefed by Brief — heart rate from fingertip scans.</Notes>`,
    '    </Activity>',
    '  </Activities>',
    '</TrainingCenterDatabase>',
  ].join('\n');
}
