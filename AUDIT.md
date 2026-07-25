# Brief — feature & UI audit

Audited 2026-07-25 against the product spec, then against ui-craft's production-quality bar
("would a designer retouch this?"). Verified by full click-through on web (light + dark) and
on-device in Expo Go.

## Feature coverage vs spec

| Spec area | Status | Notes |
|---|---|---|
| Morning flow (greeting → scan → brief) | ✅ | Camera + torch + real motion detection on device; simulated on web |
| Today's Brief (one card, <10s readable) | ✅ | Ring, status word, Energy/Stress/Sleep, one recommendation |
| Explain WHY in natural language | ✅ | Template engine keyed to HRV/RHR/sleep deltas vs personal baseline |
| Advanced metrics behind "View details" | ✅ | HR, RHR, HRV (RMSSD), sleep, signal quality, 14-day trends, weekly/monthly averages |
| Daily timeline (journal, mood, workout) | ✅ | History tab + per-day editor |
| Pattern recognition | ✅ | Real computation: workout comparison, midnight bedtimes, strongest weekday, weekly trend |
| Daily mission (exactly one) | ✅ | Score-banded pools, calm imperative copy |
| Tone (never scary/clinical/judgmental) | ✅ | Unit-tested: no "poor/bad/fail", no RMSSD/SDNN/LF-HF outside details |
| Confidence indicator | ✅ | Excellent/Good/Weak from real accelerometer movement; weak → retry prompt |
| Personal baseline (never population) | ✅ | All comparisons vs user's own 14-day averages |
| Design language (calm, muted, no red) | ✅ | Palette contrast validated by script in light + dark |
| Settings | ✅ | Reminder time, haptics, advanced toggle, units field, export, reset |
| Notifications | ⚠️ stub | Preference stored; scheduling needs expo-notifications in a dev build |
| HealthKit / Health Connect | ✅ (dev build) | Writes HR + resting HR (both), HRV RMSSD (Android); toggle self-disables in Expo Go |
| Real camera PPG | ⚠️ seam | `makeScanMetrics` in src/lib/engine.ts is the swap-in point; Expo Go cannot read camera frames |
| Unit tests | ✅ | 18 tests over engine scoring, tone, determinism, patterns, streaks |
| Snapshot tests | ❌ | Not yet |
| Widgets / Watch / Live Activities | ❌ | Future (native builds) |

## Fixes from this audit

- **Scan heart rate realism** — generated HR was anchored ~4–10 bpm above resting (read like a
  sleeping HR during a daytime scan; user's watch showed 70s). Now +12–22 bpm over RHR, i.e. an
  awake sitting heart rate. Regression-tested.
- **Charts vanishing on modal screens (web)** — react-native-screens modals can mount without
  firing `onLayout`, leaving zero-width charts. Added `useMeasuredWidth` hook with an imperative
  `measure()` fallback.
- **Walks skewing workout insights** — walks ride along with rest days; excluded from the
  next-day-recovery comparison.

## ui-craft pass

- Motion: staggered 320 ms ease-out entrances on the brief, count-up score synced to the ring
  sweep, spring press feedback. No bounce, no parallax, motion budget kept small.
- States: loading (activity indicator), empty (patterns before 2 weeks of data), error
  (+not-found route), weak-signal retry state.
- Accessibility: labeled icon-only buttons (settings, cancel scan), labeled switches, ring exposes
  "Recovery N out of 100", text never relies on color alone (dots + words).
- Brand: custom generated icon set (readiness arc), splash light + dark, no leftover Expo/React
  branding anywhere.

## Known gaps for a real launch

1. Real PPG (vision-camera frame processor + peak detection) — requires `eas build` dev client.
2. Local notification scheduling behind the existing preference.
3. Snapshot/component tests and CI (`npm test` exists; wire to GitHub Actions).
4. HealthKit read (sleep, workouts) to replace seeded lifestyle data.
5. App Store assets: screenshots, privacy nutrition label (easy: everything stays on device).
