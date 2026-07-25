import {
  baselinesFrom,
  composeRecord,
  energyLevel,
  explain,
  recommendation,
  recoveryScore,
  statusWord,
} from '@/lib/engine';
import type { DayMetrics } from '@/lib/engine';

const BASE = { rhr: 58, hrv: 62, recovery: 74 };

const metrics = (over: Partial<DayMetrics> = {}): DayMetrics => ({
  hr: 72,
  rhr: 58,
  hrv: 62,
  sleepHours: 7.4,
  bedtimeHour: 22.5,
  ...over,
});

describe('recoveryScore', () => {
  it('is higher when HRV is above baseline and RHR below', () => {
    const good = recoveryScore(metrics({ hrv: 72, rhr: 55 }), BASE);
    const bad = recoveryScore(metrics({ hrv: 52, rhr: 63 }), BASE);
    expect(good).toBeGreaterThan(bad);
  });

  it('stays within the calm 28–97 band', () => {
    expect(recoveryScore(metrics({ hrv: 200, rhr: 30, sleepHours: 12 }), BASE)).toBeLessThanOrEqual(97);
    expect(recoveryScore(metrics({ hrv: 5, rhr: 90, sleepHours: 3 }), BASE)).toBeGreaterThanOrEqual(28);
  });

  it('penalizes after-midnight bedtimes', () => {
    const early = recoveryScore(metrics({ bedtimeHour: 22.5 }), BASE);
    const late = recoveryScore(metrics({ bedtimeHour: 24.5 }), BASE);
    expect(early).toBeGreaterThan(late);
  });
});

describe('tone', () => {
  it('status words are calm, never clinical', () => {
    expect(statusWord(90)).toBe('Ready.');
    expect(statusWord(40)).toBe('Recover.');
  });

  it('recommendations never guilt the user', () => {
    for (const s of [30, 60, 75, 95]) {
      const r = recommendation(s);
      expect(r).not.toMatch(/poor|bad|fail|worse/i);
    }
  });

  it('explanations are one or two sentences of plain language', () => {
    const text = explain(metrics({ hrv: 70, rhr: 55, sleepHours: 6.1 }), BASE);
    expect(text.length).toBeGreaterThan(20);
    expect((text.match(/\./g) ?? []).length).toBeLessThanOrEqual(2);
    expect(text).not.toMatch(/RMSSD|SDNN|LF\/HF/);
  });
});

describe('composeRecord', () => {
  it('assembles a full, well-formed day record', () => {
    const r = composeRecord('2026-07-25', metrics(), [], 'excellent');
    expect(r.date).toBe('2026-07-25');
    expect(r.recovery).toBeGreaterThanOrEqual(28);
    expect(r.recovery).toBeLessThanOrEqual(97);
    expect(['High', 'Steady', 'Low']).toContain(r.energy);
    expect(['Low', 'Balanced', 'Elevated']).toContain(r.stress);
    expect(['Recovered', 'Adequate', 'Light']).toContain(r.sleep);
    expect(r.explanation.length).toBeGreaterThan(10);
    expect(r.mission.length).toBeGreaterThan(10);
  });

  it('keeps a missing current heart-rate sample missing', () => {
    const r = composeRecord('2026-07-25', metrics({ hr: null }), [], 'good');
    expect(r.hr).toBeNull();
  });
});

describe('baselinesFrom', () => {
  it('averages recent history and gives sensible defaults when empty', () => {
    expect(baselinesFrom([]).rhr).toBe(58);
    const history = [
      composeRecord('2026-07-23', metrics({ rhr: 60 }), [], 'good'),
      composeRecord('2026-07-24', metrics({ rhr: 56 }), [], 'good'),
    ];
    expect(baselinesFrom(history).rhr).toBe(58);
  });

  it('energy reflects both score and sleep', () => {
    expect(energyLevel(85, 7.5)).toBe('High');
    expect(energyLevel(85, 5)).toBe('Steady');
    expect(energyLevel(40, 8)).toBe('Low');
  });
});
