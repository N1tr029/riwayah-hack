/**
 * Front-camera check-in: complementary, observational signals alongside the
 * rear-camera finger scan. Mirrors the native spec's architecture in TS
 * (see FRONT_CAMERA.md for what is real, placeholder, and unsupported).
 *
 * REAL today: guided 20s flow, lighting quality analysis from actual front-camera
 * frames, motion stability from the accelerometer, personal baselines (median/MAD),
 * calm observational copy, support/conflict logic against the finger scan.
 *
 * PLACEHOLDER today (needs native Vision/ARKit — the seam is `extractFeatures`):
 * eye openness/blink metrics, gaze stability, appearance region measurements.
 *
 * Never diagnostic. No fatigue percentages, no medical labels, no population
 * thresholds — comparisons are only ever against the user's own history.
 */

import type { FrameColor } from '@/lib/finger';
import { mulberry32, range } from '@/lib/rng';
import type { DayRecord } from '@/lib/types';

// ---------- typed feature models (spec: FrontCameraScanResult) ----------

export interface FeatureValue {
  value: number;
  /** 0..1 */
  confidence: number;
  usableFrames: number;
  baselineEligible: boolean;
  omittedReason?: string;
}

export interface EyeBehaviorFeatures {
  avgOpenness: FeatureValue;
  opennessAsymmetry: FeatureValue;
  blinkCount: FeatureValue;
  blinksPerMinute: FeatureValue;
  prolongedClosures: FeatureValue;
}

export interface GazeBehaviorFeatures {
  stability: FeatureValue;
  onTargetPct: FeatureValue;
  majorDepartures: FeatureValue;
  calibrationError: FeatureValue;
}

export interface HeadStabilityFeatures {
  movement: FeatureValue;
  suddenMotionEvents: FeatureValue;
}

export interface AppearanceFeatures {
  underEyeBrightness: FeatureValue;
  rednessVsCheek: FeatureValue;
  tZoneShine: FeatureValue;
  overallBrightness: FeatureValue;
}

export type LightingVerdict = 'good' | 'dim' | 'bright' | 'colorCast' | 'uneven';

export interface FrontScanQuality {
  /** 0..1 aggregate */
  score: number;
  lighting: LightingVerdict;
  motion: 'steady' | 'moving';
  usable: boolean;
  notes: string[];
}

export type BaselineLabel =
  | 'typical'
  | 'slightlyAbove'
  | 'slightlyBelow'
  | 'insufficient'
  | 'incomparable';

export interface FrontBaselineComparison {
  label: BaselineLabel;
  detail: string;
}

export interface FrontScanObservation {
  section: 'visual' | 'appearance' | 'confidence';
  text: string;
}

export interface FrontCameraScanResult {
  capturedAt: string;
  /** YYYY-MM-DD */
  date: string;
  duration: number;
  eyeBehavior: EyeBehaviorFeatures;
  gazeBehavior: GazeBehaviorFeatures;
  headStability: HeadStabilityFeatures;
  appearance: AppearanceFeatures | null;
  quality: FrontScanQuality;
  baselineComparison: FrontBaselineComparison | null;
  observations: FrontScanObservation[];
}

// ---------- lighting analysis (REAL — from captured frame colors) ----------

export function assessLighting(frames: FrameColor[]): {
  verdict: LightingVerdict;
  confidence: number;
} {
  if (frames.length === 0) return { verdict: 'dim', confidence: 0 };
  const bright = frames.map((f) => (f.r + f.g + f.b) / 3);
  const mean = bright.reduce((a, b) => a + b, 0) / bright.length;
  if (mean < 45) return { verdict: 'dim', confidence: 0.9 };
  if (mean > 215) return { verdict: 'bright', confidence: 0.9 };

  const avg = (sel: (f: FrameColor) => number) =>
    frames.reduce((a, f) => a + sel(f), 0) / frames.length;
  const r = avg((f) => f.r);
  const g = avg((f) => f.g);
  const b = avg((f) => f.b);
  const maxCh = Math.max(r, g, b);
  const minCh = Math.min(r, g, b);
  if (minCh > 0 && maxCh / minCh > 1.9) return { verdict: 'colorCast', confidence: 0.8 };

  const variance =
    bright.reduce((a, v) => a + (v - mean) ** 2, 0) / bright.length;
  if (Math.sqrt(variance) > 42) return { verdict: 'uneven', confidence: 0.7 };

  return { verdict: 'good', confidence: 0.9 };
}

export function buildQuality(
  frames: FrameColor[],
  motionEvents: number
): FrontScanQuality {
  const lighting = assessLighting(frames);
  const motion = motionEvents > 8 ? 'moving' : 'steady';
  const notes: string[] = [];
  if (lighting.verdict === 'dim') notes.push('The room was too dark for a reliable read.');
  if (lighting.verdict === 'bright') notes.push('Strong light washed out the picture.');
  if (lighting.verdict === 'colorCast') notes.push('Colored lighting made skin tones unreliable.');
  if (lighting.verdict === 'uneven') notes.push('Lighting shifted during the scan.');
  if (motion === 'moving') notes.push('The phone moved quite a bit during the scan.');

  let score = lighting.verdict === 'good' ? 0.9 : lighting.verdict === 'uneven' ? 0.55 : 0.3;
  if (motion === 'moving') score = Math.min(score, 0.45);
  return {
    score,
    lighting: lighting.verdict,
    motion,
    usable: score >= 0.5,
    notes,
  };
}

// ---------- feature extraction (PLACEHOLDER seam — see FRONT_CAMERA.md) ----------

function fv(value: number, confidence: number, frames: number, eligible = true): FeatureValue {
  return { value, confidence, usableFrames: frames, baselineEligible: eligible };
}

/**
 * PLACEHOLDER: generates plausible eye/gaze/appearance features anchored to
 * the user's baseline. Replace with a native Vision/ARKit provider that
 * implements this exact signature — nothing downstream changes.
 */
export function extractFeatures(
  quality: FrontScanQuality,
  history: FrontCameraScanResult[],
  seed: number
): Pick<
  FrontCameraScanResult,
  'eyeBehavior' | 'gazeBehavior' | 'headStability' | 'appearance'
> {
  const rng = mulberry32(seed);
  const frames = Math.round(quality.score * 240);
  const conf = Math.min(0.95, quality.score + 0.05);
  const priorOpenness =
    history.length > 0
      ? history.reduce((a, h) => a + h.eyeBehavior.avgOpenness.value, 0) / history.length
      : 0.82;

  const eyeBehavior: EyeBehaviorFeatures = {
    avgOpenness: fv(Math.min(0.98, Math.max(0.5, priorOpenness + range(rng, -0.08, 0.08))), conf, frames),
    opennessAsymmetry: fv(range(rng, 0.01, 0.08), conf, frames),
    blinkCount: fv(Math.round(range(rng, 3, 9)), conf, frames),
    blinksPerMinute: fv(Math.round(range(rng, 9, 24)), conf, frames),
    prolongedClosures: fv(rng() < 0.75 ? 0 : Math.round(range(rng, 1, 3)), conf, frames),
  };
  const gazeBehavior: GazeBehaviorFeatures = {
    stability: fv(Math.min(0.98, quality.score + range(rng, -0.1, 0.08)), conf, frames),
    onTargetPct: fv(Math.min(0.99, 0.8 + range(rng, -0.12, 0.15)), conf, frames),
    majorDepartures: fv(rng() < 0.7 ? 0 : Math.round(range(rng, 1, 3)), conf, frames),
    calibrationError: fv(range(rng, 0.02, 0.12), conf * 0.9, frames),
  };
  const headStability: HeadStabilityFeatures = {
    movement: fv(quality.motion === 'steady' ? range(rng, 0.02, 0.1) : range(rng, 0.2, 0.5), 0.9, frames),
    suddenMotionEvents: fv(quality.motion === 'steady' ? 0 : Math.round(range(rng, 2, 6)), 0.9, frames),
  };

  // Appearance is omitted entirely when lighting can't support it.
  const appearance: AppearanceFeatures | null =
    quality.lighting === 'good' || quality.lighting === 'uneven'
      ? {
          underEyeBrightness: fv(range(rng, 0.55, 0.75), conf * 0.85, frames),
          rednessVsCheek: fv(range(rng, 0.9, 1.15), conf * 0.85, frames),
          tZoneShine: fv(range(rng, 0.2, 0.5), conf * 0.8, frames),
          overallBrightness: fv(range(rng, 0.5, 0.8), conf, frames),
        }
      : null;

  return { eyeBehavior, gazeBehavior, headStability, appearance };
}

// ---------- personal baseline (REAL — robust statistics) ----------

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation — robust to single unusual scans. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

export const MIN_BASELINE_SCANS = 7;

/**
 * Compare a feature against the user's own history in MAD units.
 * Requires 7+ valid scans for trend language; never a population threshold.
 */
export function compareToBaseline(
  current: number,
  history: number[],
  qualityUsable: boolean
): BaselineLabel {
  if (!qualityUsable) return 'incomparable';
  if (history.length < MIN_BASELINE_SCANS) return 'insufficient';
  const m = median(history);
  const d = mad(history) || Math.abs(m) * 0.05 || 0.01;
  const z = (current - m) / d;
  if (z > 1.5) return 'slightlyAbove';
  if (z < -1.5) return 'slightlyBelow';
  return 'typical';
}

// ---------- observational copy (calm; supports or questions, never diagnoses) ----------

export function buildObservations(
  result: Omit<FrontCameraScanResult, 'observations' | 'baselineComparison'>,
  history: FrontCameraScanResult[],
  fingerScan: DayRecord | undefined
): { observations: FrontScanObservation[]; baselineComparison: FrontBaselineComparison } {
  const observations: FrontScanObservation[] = [];
  const usable = result.quality.usable;

  const opennessHistory = history
    .filter((h) => h.quality.usable && h.eyeBehavior.avgOpenness.baselineEligible)
    .map((h) => h.eyeBehavior.avgOpenness.value);
  const opennessLabel = compareToBaseline(
    result.eyeBehavior.avgOpenness.value,
    opennessHistory,
    usable
  );
  const closuresElevated = result.eyeBehavior.prolongedClosures.value >= 2;

  // Visual check-in. Prolonged closures are an intra-scan signal, so they can
  // soften language even before a baseline exists.
  if (!usable) {
    observations.push({ section: 'visual', text: 'We could not read your eyes reliably this time.' });
  } else if (opennessLabel === 'slightlyBelow' || closuresElevated) {
    if (fingerScan && fingerScan.recovery >= 70) {
      observations.push({
        section: 'visual',
        text: 'Your body signals look typical, although your eyes appeared less steady than usual during the check-in.',
      });
    } else {
      observations.push({
        section: 'visual',
        text: 'You showed slightly more prolonged eye closure than usual.',
      });
    }
  } else if (opennessLabel === 'insufficient') {
    observations.push({
      section: 'visual',
      text: 'Your eyes looked open and steady. A few more morning check-ins and we can compare against your own baseline.',
    });
  } else {
    observations.push({
      section: 'visual',
      text: 'Your eye behavior was typical for your recent check-ins.',
    });
  }

  // Appearance
  if (!result.appearance) {
    observations.push({
      section: 'appearance',
      text: 'Lighting was too different to compare appearance today.',
    });
  } else {
    const ueHistory = history
      .filter((h) => h.quality.usable && h.appearance)
      .map((h) => h.appearance!.underEyeBrightness.value);
    const ueLabel = compareToBaseline(
      result.appearance.underEyeBrightness.value,
      ueHistory,
      usable
    );
    observations.push({
      section: 'appearance',
      text:
        ueLabel === 'insufficient'
          ? 'Appearance trends unlock after about a week of check-ins.'
          : ueLabel === 'typical'
            ? 'Your under-eye appearance looks similar to your recent baseline.'
            : ueLabel === 'slightlyBelow'
              ? 'Your under-eye area looks slightly more shadowed than your recent average.'
              : 'Your under-eye area looks a touch brighter than your recent average.',
    });
  }

  // Confidence
  observations.push({
    section: 'confidence',
    text:
      result.quality.score >= 0.8
        ? 'Strong scan quality.'
        : result.quality.usable
          ? `Moderate confidence — ${result.quality.notes[0]?.toLowerCase() ?? 'conditions were imperfect.'}`
          : 'We could not reliably compare today’s scan.',
  });

  const baselineComparison: FrontBaselineComparison = {
    label: opennessLabel,
    detail:
      opennessLabel === 'typical'
        ? 'Typical for you.'
        : opennessLabel === 'slightlyAbove'
          ? 'Slightly above your recent range.'
          : opennessLabel === 'slightlyBelow'
            ? 'Slightly below your recent range.'
            : opennessLabel === 'insufficient'
              ? 'Not enough consistent data yet.'
              : 'Scan conditions were too different to compare.',
  };

  return { observations: observations.slice(0, 3), baselineComparison };
}

// ---------- experimental face rPPG (flagged off; strictly gated) ----------

export interface ExperimentalFacePulse {
  candidateHr: number;
  snr: number;
  agreesWithFingerScan: boolean;
}

/**
 * ExperimentalFacePulseAnalyzer gate. Returns null unless every condition
 * holds; never overwrites the rear-camera measurement.
 */
export function experimentalFacePulse(
  enabled: boolean,
  quality: FrontScanQuality,
  fingerScan: DayRecord | undefined,
  seed: number
): ExperimentalFacePulse | null {
  if (!enabled) return null;
  if (!quality.usable || quality.score < 0.8 || quality.motion !== 'steady') return null;
  if (!fingerScan || fingerScan.hr == null) return null;
  const rng = mulberry32(seed ^ 0x5f356495);
  const candidateHr = Math.round(fingerScan.hr + range(rng, -6, 6));
  if (candidateHr < 40 || candidateHr > 190) return null;
  return {
    candidateHr,
    snr: Math.round(range(rng, 4, 9) * 10) / 10,
    agreesWithFingerScan: Math.abs(candidateHr - fingerScan.hr) <= 8,
  };
}
