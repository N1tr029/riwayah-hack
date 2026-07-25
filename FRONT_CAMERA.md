# Front-camera visual check-in — status and boundaries

A 20-second guided front-camera check-in that supplements (never replaces) the rear-camera
finger scan. This documents exactly what is real, what is placeholder, and what is out of
scope — per the module spec's deliverable #10.

## Architecture (TS mirror of the native spec)

| Spec component | Here | File |
|---|---|---|
| FrontScanCoordinator / ViewModel / Views | `face-scan.tsx` guided flow (intro → fixate → track → results) | src/app/face-scan.tsx |
| FrontScanQualityAnalyzer | `assessLighting` + `buildQuality` | src/lib/face.ts |
| Eye/Gaze/HeadPose/Appearance analyzers | `extractFeatures` (single seam) | src/lib/face.ts |
| FrontReadinessBaselineStore | `median`/`mad`/`compareToBaseline` + AsyncStorage (`brief.face.v1`) | src/lib/face.ts, store.tsx |
| ExperimentalFacePulseAnalyzer | `experimentalFacePulse`, gated by settings flag (default OFF) | src/lib/face.ts |

## Observational vs. experimental vs. unsupported

**Real (measured):**
- Lighting quality from actual front-camera frames: under/over-exposure, color cast,
  uneven illumination → appearance comparisons are omitted (not fudged) when lighting fails.
- Device motion during the scan (accelerometer) → scan-quality gating.
- Guided flow mechanics: fixation target, moving-target pass, haptics, restart-on-bad-quality.
- Personal baselines: median/MAD robust statistics, 7-scan minimum before trend language,
  time-anchored history. All comparisons are user-vs-their-own-history, never population.
- Support/conflict integration: contradictory front-camera signals soften language
  ("…although your eyes appeared less steady than usual") and never produce a number.

**Placeholder (plausible values behind the real interface):**
- Eye openness/blink metrics, gaze stability/dispersion, appearance region measurements.
  These require native face landmarks (Vision `VNDetectFaceLandmarksRequest`) or ARKit
  blend shapes, which React Native cannot reach without a custom native module.
  The swap-in seam is `extractFeatures()` in src/lib/face.ts — a native provider that
  fills the same typed structs replaces it without touching anything downstream.

**Unsupported / intentionally absent:**
- Any diagnosis: fatigue percentages, eye disease, dehydration, deficiencies, stress
  disorders, gut health. The copy layer is tested to never emit such language.
- Face-derived HRV, blood pressure, SpO2, respiratory rate.
- Identity recognition of any kind.

## Privacy

All processing is on-device and in-memory. No video is recorded; no frames, face geometry
or images are persisted — only numeric features and quality metadata (`brief.face.v1`).
There is currently no image-retention option (spec's opt-in) — if added, it must be a
separate toggle with explicit wording and full deletion.

## Experimental face rPPG

`Settings → Experimental face pulse` (default off). Even when on, a candidate HR is only
produced when quality ≥ 0.8, motion steady, a same-day finger scan exists, and the value is
physiologically plausible — and it is only ever reported as agreement/disagreement with the
finger scan, never as a replacement. Enforced by tests.

## Validation required before anything here influences readiness scoring

1. Native Vision/ARKit feature extraction replacing the placeholder seam.
2. Replay-clip test suite (stable / poor lighting / glasses / occlusion / movement /
   multiple faces / deliberate blinking) across diverse skin tones and face shapes.
3. Baseline stability study: ≥14 morning scans per user, MAD-based drift check.
4. Agreement study between face-pulse candidate HR and finger PPG before un-flagging.
5. Accessibility pass for users who cannot hold a fixation gaze.
