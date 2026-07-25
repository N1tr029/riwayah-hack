import {
  assessLighting,
  buildObservations,
  buildQuality,
  compareToBaseline,
  experimentalFacePulse,
  extractFeatures,
  mad,
  median,
  type FrontCameraScanResult,
} from '@/lib/face';
import type { DayRecord } from '@/lib/types';

const goodFrames = Array.from({ length: 10 }, () => ({ r: 150, g: 135, b: 125 }));

function fingerScan(recovery: number): DayRecord {
  return {
    date: '2026-07-25', recovery, statusWord: 'Ready.', energy: 'High', stress: 'Low',
    sleep: 'Recovered', sleepHours: 7.5, bedtimeHour: 22.5, hr: 72, rhr: 58, hrv: 70,
    confidence: 'excellent', explanation: '', recommendation: '', mission: '',
  };
}

function makeScan(quality = buildQuality(goodFrames, 0), history: FrontCameraScanResult[] = []): FrontCameraScanResult {
  const features = extractFeatures(quality, history, 42);
  const partial = {
    capturedAt: '2026-07-25T08:00:00Z', date: '2026-07-25', duration: 18, ...features, quality,
  };
  const { observations, baselineComparison } = buildObservations(partial, history, fingerScan(85));
  return { ...partial, observations, baselineComparison };
}

describe('robust statistics', () => {
  it('median handles odd, even, empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('MAD resists a single outlier', () => {
    const clean = mad([10, 11, 10, 12, 11]);
    const withOutlier = mad([10, 11, 10, 12, 11, 90]);
    expect(withOutlier).toBeLessThan(clean * 4);
  });
});

describe('lighting rejection', () => {
  it('rejects dim, bright, and color-cast frames', () => {
    expect(assessLighting(Array(5).fill({ r: 20, g: 20, b: 22 })).verdict).toBe('dim');
    expect(assessLighting(Array(5).fill({ r: 245, g: 240, b: 235 })).verdict).toBe('bright');
    expect(assessLighting(Array(5).fill({ r: 190, g: 90, b: 80 })).verdict).toBe('colorCast');
  });

  it('accepts even, neutral light and unusable quality omits appearance', () => {
    expect(assessLighting(goodFrames).verdict).toBe('good');
    const dimQuality = buildQuality(Array(5).fill({ r: 20, g: 20, b: 22 }), 0);
    expect(dimQuality.usable).toBe(false);
    expect(extractFeatures(dimQuality, [], 1).appearance).toBeNull();
  });
});

describe('personal baseline comparisons', () => {
  const history = [0.8, 0.82, 0.81, 0.79, 0.8, 0.83, 0.81];

  it('requires seven valid scans before trend language', () => {
    expect(compareToBaseline(0.8, history.slice(0, 4), true)).toBe('insufficient');
    expect(compareToBaseline(0.8, history, true)).toBe('typical');
  });

  it('labels deviations relative to the user only', () => {
    expect(compareToBaseline(0.95, history, true)).toBe('slightlyAbove');
    expect(compareToBaseline(0.6, history, true)).toBe('slightlyBelow');
  });

  it('marks bad scan conditions incomparable rather than misleading', () => {
    expect(compareToBaseline(0.8, history, false)).toBe('incomparable');
  });
});

describe('observations', () => {
  it('returns at most three calm sections and never diagnoses', () => {
    const scan = makeScan();
    expect(scan.observations.length).toBeLessThanOrEqual(3);
    const text = scan.observations.map((o) => o.text).join(' ');
    expect(text).not.toMatch(/fatigued|disorder|deficien|disease|anemia|dehydrat|\d+%/i);
  });

  it('contradictory signals soften language instead of manufacturing a score', () => {
    const quality = buildQuality(goodFrames, 0);
    const features = extractFeatures(quality, [], 7);
    features.eyeBehavior.prolongedClosures.value = 3;
    const partial = { capturedAt: 'x', date: '2026-07-25', duration: 18, ...features, quality };
    const { observations } = buildObservations(partial, [], fingerScan(85));
    expect(observations[0].text).toMatch(/body signals look typical, although/i);
  });
});

describe('experimental face pulse gating', () => {
  const quality = buildQuality(goodFrames, 0);

  it('returns null when the flag is off, regardless of quality', () => {
    expect(experimentalFacePulse(false, quality, fingerScan(80), 1)).toBeNull();
  });

  it('returns null on weak quality or motion even when enabled', () => {
    const moving = buildQuality(goodFrames, 20);
    expect(experimentalFacePulse(true, moving, fingerScan(80), 1)).toBeNull();
  });

  it('never overwrites the finger scan — only reports agreement', () => {
    const pulse = experimentalFacePulse(true, quality, fingerScan(80), 1);
    expect(pulse).not.toBeNull();
    expect(typeof pulse!.agreesWithFingerScan).toBe('boolean');
  });
});
